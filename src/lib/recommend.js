import { HORROR_GENRE_ID, tmdbGet } from "./tmdb.js";
import { MOOD_PRESETS, moodTextHits } from "./moods.js";
import { isOwnedTitle, titleKey } from "./library.js";
import { diversifySeeds, tagAffinity } from "./taste.js";
import { readJSON, writeJSON } from "./storage.js";

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_SEEDS = 5;
export const MAX_PICKS = 15;
const CACHE_KEY = "horrorhub.recs.cache.v1";
const CACHE_TTL_MS = DAY_MS;

// ---------- seeds: which library titles drive the suggestions ----------

// Titles you loved, most relevant first. Only TMDb-numbered items qualify
// (CSV-imported titles have string ids TMDb can't look up). Weight is mostly
// your rating, plus a bonus for something watched recently and, when a taste
// profile is given, for films whose tags match what you love. The final pick
// is spread across subgenres so one favorite tag can't fill every slot.
export function pickSeeds(items, { max = MAX_SEEDS, now = Date.now(), profile = null } = {}) {
  const usable = (items || []).filter((i) => typeof i.id === "number" && Number.isFinite(i.id));
  const loved = usable.filter((i) => (i.rating || 0) >= 4);
  const pool = loved.length ? loved : usable.filter((i) => (i.rating || 0) >= 3);

  const weight = (item) => {
    const last = Math.max(0, ...(item.watchedDates || []).map((d) => new Date(d).getTime() || 0));
    const ageDays = last ? Math.max(0, (now - last) / DAY_MS) : Infinity;
    const recency = ageDays === Infinity ? 0 : Math.max(0, 1 - ageDays / 730) * 0.3; // fades over 2 years
    const taste = profile ? tagAffinity(item, profile) * 0.25 : 0;
    return (item.rating || 0) / 5 + recency + taste;
  };
  const candidates = pool.map((item) => ({
    id: item.id,
    title: item.title,
    weight: weight(item),
    tags: (item.tags || []).map((t) => String(t).toLowerCase()),
  }));
  return diversifySeeds(candidates, max).map(({ id, title, weight: w }) => ({ id, title, weight: w }));
}

// ---------- ranking ----------

const isReleased = (releaseDate, today) => !releaseDate || releaseDate <= today;

// Combines each seed's TMDb list into one ranked list.
//  - horror only, released, and not already in your library (matched by id, and
//    by title + year so a Letterboxd/IMDb import counts as "seen")
//  - a film suggested by several seeds accumulates score (weighted by seed
//    weight and its position in that seed's list)
//  - well-voted films get a small quality bonus
//  - with a mood selected, films whose title/overview hit the mood's keywords
//    are boosted; with a taste profile, so are films leaning toward the moods
//    you love most (heuristics; nothing is hidden)
//  - each pick carries the reasons it was suggested
export function rankCandidates({ seeds, resultsBySeed, libraryIds, libraryKeys, profile = null, moodId = "all", now = Date.now(), limit = MAX_PICKS }) {
  const owned = new Set([...(libraryIds || [])].map(String));
  const today = new Date(now).toISOString().slice(0, 10);
  const byId = new Map();

  for (const seed of seeds || []) {
    const list = resultsBySeed?.[seed.id] || [];
    list.forEach((r, idx) => {
      if (!r || owned.has(String(r.id))) return;
      if (libraryKeys && isOwnedTitle(libraryKeys, r)) return;
      if (!(r.genreIds || []).includes(HORROR_GENRE_ID)) return;
      if (!isReleased(r.releaseDate, today)) return;
      const entry = byId.get(r.id) || { pick: r, score: 0, best: {}, seeds: 0 };
      const contribution = seed.weight / (1 + idx * 0.12);
      entry.score += contribution;
      entry.seeds += 1;
      if (contribution > (entry.best.contribution ?? -1)) entry.best = { title: seed.title, contribution };
      byId.set(r.id, entry);
    });
  }

  const moodName = MOOD_PRESETS.find((p) => p.id === moodId)?.label;
  const ranked = [...byId.values()].map(({ pick, score, best, seeds: seedCount }) => {
    const text = `${pick.title} ${pick.overview}`;
    const reasons = [`Because you liked ${best.title}${seedCount > 1 ? ` and ${seedCount - 1} other favorite${seedCount > 2 ? "s" : ""}` : ""}`];
    let bonus = pick.voteCount >= 50 && pick.voteAvg ? (pick.voteAvg / 10) * 0.3 : 0;

    const hits = moodId && moodId !== "all" ? moodTextHits(text, moodId) : 0;
    if (hits) {
      bonus += Math.min(hits, 3) * 0.35;
      reasons.push(`Matches your ${moodName} vibe`);
    }
    // learned taste: lean toward the moods your favorites share
    const leaning = (profile?.lovedMoods || []).find((m) => m.id !== moodId && moodTextHits(text, m.id) > 0);
    if (leaning) {
      bonus += Math.min(moodTextHits(text, leaning.id), 2) * leaning.score * 0.2;
      reasons.push(`Leans ${leaning.label}, like your favorites`);
    }
    return { ...pick, score: score + bonus, moodHits: hits, reasons, reason: reasons[0] };
  });

  const seenKeys = new Set();
  return ranked
    .sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title)))
    .filter((p) => {
      const key = titleKey({ title: p.title, year: p.year }); // TMDb sometimes lists one film under two ids
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    })
    .slice(0, limit);
}

// ---------- fetching (with a 24h cache so it survives reloads) ----------

// Poster stays a TMDb path (like every other source); the UI adds the host.
export function slimResult(r) {
  return {
    id: r.id,
    title: r.title,
    year: r.release_date ? r.release_date.slice(0, 4) : "",
    releaseDate: r.release_date || "",
    poster: r.poster_path || null,
    overview: r.overview || "",
    voteAvg: typeof r.vote_average === "number" ? r.vote_average : null,
    voteCount: typeof r.vote_count === "number" ? r.vote_count : 0,
    genreIds: Array.isArray(r.genre_ids) ? r.genre_ids : [],
  };
}

function readCache() {
  const cache = readJSON(CACHE_KEY, {});
  return cache && typeof cache === "object" && !Array.isArray(cache) ? cache : {};
}

export async function loadSeedResults(seedId, { apiKey, signal, now = Date.now() } = {}) {
  const cache = readCache();
  const hit = cache[seedId];
  if (hit && now - hit.at < CACHE_TTL_MS && Array.isArray(hit.results)) return hit.results;

  const data = await tmdbGet(`/movie/${seedId}/recommendations?language=en-US&page=1`, { apiKey, signal });
  const results = (data?.results || []).map(slimResult);
  // re-read so parallel seeds don't overwrite each other's entries
  writeJSON(CACHE_KEY, { ...readCache(), [seedId]: { at: now, results } });
  return results;
}
