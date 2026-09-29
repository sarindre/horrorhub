import { HORROR_GENRE_ID, tmdbGet } from "./tmdb.js";
import { moodTextHits } from "./moods.js";
import { readJSON, writeJSON } from "./storage.js";

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_SEEDS = 5;
export const MAX_PICKS = 15;
const CACHE_KEY = "horrorhub.recs.cache.v1";
const CACHE_TTL_MS = DAY_MS;

// ---------- seeds: which library titles drive the suggestions ----------

// Titles you loved, most relevant first. Only TMDb-numbered items qualify
// (CSV-imported titles have string ids TMDb can't look up). Weight is mostly
// your rating, plus a bonus for something watched recently.
export function pickSeeds(items, { max = MAX_SEEDS, now = Date.now() } = {}) {
  const usable = (items || []).filter((i) => typeof i.id === "number" && Number.isFinite(i.id));
  const loved = usable.filter((i) => (i.rating || 0) >= 4);
  const pool = loved.length ? loved : usable.filter((i) => (i.rating || 0) >= 3);

  const weight = (item) => {
    const last = Math.max(0, ...(item.watchedDates || []).map((d) => new Date(d).getTime() || 0));
    const ageDays = last ? Math.max(0, (now - last) / DAY_MS) : Infinity;
    const recency = ageDays === Infinity ? 0 : Math.max(0, 1 - ageDays / 730) * 0.3; // fades over 2 years
    return (item.rating || 0) / 5 + recency;
  };
  return pool
    .map((item) => ({ id: item.id, title: item.title, weight: weight(item) }))
    .sort((a, b) => b.weight - a.weight || a.id - b.id)
    .slice(0, max);
}

// ---------- ranking ----------

const isReleased = (releaseDate, today) => !releaseDate || releaseDate <= today;

// Combines each seed's TMDb list into one ranked list.
//  - horror only, not already in your library, already released
//  - a film suggested by several seeds accumulates score (weighted by seed
//    weight and its position in that seed's list)
//  - well-voted films get a small quality bonus
//  - with a mood selected, films whose title/overview hit the mood's keywords
//    are boosted (a heuristic; nothing is hidden)
export function rankCandidates({ seeds, resultsBySeed, libraryIds, moodId = "all", now = Date.now(), limit = MAX_PICKS }) {
  const owned = new Set([...(libraryIds || [])].map(String));
  const today = new Date(now).toISOString().slice(0, 10);
  const byId = new Map();

  for (const seed of seeds || []) {
    const list = resultsBySeed?.[seed.id] || [];
    list.forEach((r, idx) => {
      if (!r || owned.has(String(r.id))) return;
      if (!(r.genreIds || []).includes(HORROR_GENRE_ID)) return;
      if (!isReleased(r.releaseDate, today)) return;
      const entry = byId.get(r.id) || { pick: r, score: 0, best: {} };
      const contribution = seed.weight / (1 + idx * 0.12);
      entry.score += contribution;
      if (contribution > (entry.best.contribution ?? -1)) entry.best = { title: seed.title, contribution };
      byId.set(r.id, entry);
    });
  }

  const ranked = [...byId.values()].map(({ pick, score, best }) => {
    const quality = pick.voteCount >= 50 && pick.voteAvg ? (pick.voteAvg / 10) * 0.3 : 0;
    const hits = moodId && moodId !== "all" ? moodTextHits(`${pick.title} ${pick.overview}`, moodId) : 0;
    const mood = Math.min(hits, 3) * 0.35;
    return { ...pick, score: score + quality + mood, moodHits: hits, reason: `Because you liked ${best.title}` };
  });
  return ranked.sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title))).slice(0, limit);
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
