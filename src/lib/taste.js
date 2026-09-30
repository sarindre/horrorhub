import { MOOD_PRESETS, matchesMood } from "./moods.js";
import { titleKey } from "./library.js";
import { scareBias, scareOf } from "./scare.js";
import { calibrationSignals, scareCeilingFrom, SEED_WEIGHT } from "./calibration.js";

// The taste engine: learns what you like from your library and uses it to
// rank and explain suggestions. Everything here is pure and local.

const DAY_MS = 24 * 60 * 60 * 1000;
// Shrinks a tag's score toward zero until there's enough evidence, so one
// 5-star film can't make its whole tag list look like your favorites.
const SHRINK = 2;
const MIN_EVIDENCE_FOR_DISPLAY = 2;
const LIKED_THRESHOLD = 0.15;
const DEFAULT_MIXER = { ghosts: 1, occult: 1, slasher: 1, folk: 1 };

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const uniqueTags = (item) => [...new Set((item.tags || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))];
const moodLabel = (id) => MOOD_PRESETS.find((p) => p.id === id)?.label || id;

function lastWatched(item) {
  return Math.max(0, ...(item.watchedDates || []).map((d) => new Date(d).getTime() || 0));
}

// -1 (hated) .. +1 (loved). A rating is the strongest signal; a watch with no
// rating is a mild positive; a title you merely saved tells us nothing yet.
export function ratingAffinity(item) {
  const rating = item.rating || 0;
  if (rating > 0) return (rating - 3) / 2;
  return (item.watchedDates || []).length ? 0.15 : 0;
}
const hasSignal = (item) => (item.rating || 0) > 0 || (item.watchedDates || []).length > 0;

// Recent opinions count a little more than ones from years ago.
function recencyFactor(item, now) {
  const last = lastWatched(item);
  if (!last) return 0.85;
  const ageDays = Math.max(0, (now - last) / DAY_MS);
  return 0.7 + 0.3 * Math.max(0, 1 - ageDays / 1095);
}

// What your library says about you.
//   tags:       [{ tag, count, score }] best first; score is roughly -1..1
//   moods:      the same idea per mood preset (Occult, Slasher, ...)
//   scarePref:  scare level (0-10) of the films you enjoyed, or null
//   signalCount: how many films you rated or watched (drives the "still learning" hint)
//   seedCount:  quiz answers that also informed it (they count for less)
//   scareBias:  how far your scare ratings run from the estimates (see scare.js)
//   scareCeiling: scare level you said was too much in the quiz, or null
// `calibration` is the taste quiz ({ answers, doneAt }), if taken.
export function buildTasteProfile(items, { now = Date.now(), calibration = null } = {}) {
  const sums = new Map();
  const counts = new Map();
  let signalCount = 0;
  let seedCount = 0;
  const bias = scareBias(items);
  let scareNum = 0;
  let scareDen = 0;

  for (const item of [...(items || []), ...calibrationSignals(calibration)]) {
    if (!hasSignal(item)) continue;
    if (item.seed) seedCount++;
    else signalCount++;
    const weight = ratingAffinity(item) * recencyFactor(item, now) * (item.seed ? SEED_WEIGHT : 1);
    for (const tag of uniqueTags(item)) {
      sums.set(tag, (sums.get(tag) || 0) + weight);
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    if (weight > 0) {
      scareNum += weight * scareOf(item, { bias }).value;
      scareDen += weight;
    }
  }

  const tags = [...sums.entries()]
    .map(([tag, sum]) => ({ tag, count: counts.get(tag), score: sum / (counts.get(tag) + SHRINK) }))
    .sort((a, b) => b.score - a.score || b.count - a.count || a.tag.localeCompare(b.tag));
  const tagScore = new Map(tags.map((t) => [t.tag, t]));

  const moods = MOOD_PRESETS.filter((p) => p.id !== "all")
    .map((preset) => {
      const present = preset.tags.filter((t) => sums.has(t));
      if (!present.length) return null;
      const sum = present.reduce((s, t) => s + sums.get(t), 0);
      const count = present.reduce((s, t) => s + counts.get(t), 0);
      return { id: preset.id, label: preset.label, count, score: sum / (count + SHRINK) };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return {
    signalCount,
    seedCount,
    scareBias: bias,
    scareCeiling: scareCeilingFrom(calibration),
    tags,
    tagScore,
    likedTags: tags.filter((t) => t.score >= LIKED_THRESHOLD && t.count >= MIN_EVIDENCE_FOR_DISPLAY).slice(0, 5),
    moods,
    lovedMoods: moods.filter((m) => m.score >= LIKED_THRESHOLD && m.count >= MIN_EVIDENCE_FOR_DISPLAY).slice(0, 2),
    scarePref: scareDen > 0 ? scareNum / scareDen : null,
  };
}

// "Still learning" until there's enough to lean on.
export const isLearning = (profile) => profile.signalCount + (profile.seedCount || 0) * SEED_WEIGHT < 8;

// ---- ranking films you already own ----

const MIXER_TAGS = {
  ghosts: ["supernatural", "haunted", "possession"],
  occult: ["occult"],
  slasher: ["slasher", "home-invasion"],
  folk: ["folk-horror"],
};

// Score one library film for tonight, with the reasons behind the score.
//   scare:  tonight's slider (0-10);  moodId: chosen night vibe;  mixer: manual subgenre weights
export function scoreLibraryItem(item, profile, { moodId = "all", scare = 5, mixer = DEFAULT_MIXER } = {}) {
  const reasons = [];
  const tags = uniqueTags(item);

  // fit to tonight's scare slider (your own scare rating, or an estimate)
  const filmScare = scareOf(item, { bias: profile.scareBias || 0 }).value;
  const proximity = 1 - Math.min(1, Math.abs(scare - filmScare) / 10);
  let score = proximity * 0.6;

  // learned taste: the film's best-matching tags (and a penalty for tags you rate low)
  const known = tags.map((t) => profile.tagScore.get(t)).filter(Boolean).sort((a, b) => b.score - a.score);
  if (known.length) {
    const best = known.slice(0, 3);
    score += clamp(mean(best.map((k) => k.score)), 0, 1) * 0.5;
    const worst = known[known.length - 1];
    if (worst.count >= MIN_EVIDENCE_FOR_DISPLAY && worst.score < -0.3) score += worst.score * 0.3;
    const top = best[0];
    if (top.score >= LIKED_THRESHOLD && top.count >= MIN_EVIDENCE_FOR_DISPLAY) reasons.push(`You tend to enjoy #${top.tag}`);
  }

  // does the scare level match the films you usually love?
  if (profile.scarePref != null && profile.signalCount + (profile.seedCount || 0) >= 3) {
    const closeness = 1 - Math.min(1, Math.abs(profile.scarePref - filmScare) / 10);
    score += closeness * 0.15;
    if (closeness >= 0.85) reasons.push("Right at your usual scare level");
  }

  // you said films around this level were too intense
  if (profile.scareCeiling != null && filmScare > profile.scareCeiling) score -= 0.08 * (filmScare - profile.scareCeiling);

  // the chosen night vibe
  if (moodId !== "all" && matchesMood(item.tags || [], moodId)) {
    score += 0.65;
    reasons.push(`Matches your ${moodLabel(moodId)} vibe`);
  }

  // manual subgenre mixer
  const has = (list) => list.some((t) => tags.includes(t));
  const mixerBoost = Object.entries(MIXER_TAGS).reduce((sum, [key, list]) => sum + (has(list) ? mixer[key] ?? 0 : 0), 0);
  score += mixerBoost * 0.15;

  if (item.watchlist) {
    score += 0.2;
    reasons.push("On your watchlist");
  }
  score += ((item.rating || 0) / 5) * 0.3;

  if (!reasons.length) reasons.push(proximity >= 0.8 ? "Fits tonight's scare level" : "From your library");
  return { score, reasons: reasons.slice(0, 3) };
}

// The best unwatched, released films from your library for tonight. Already-seen
// titles are suppressed (unless everything is seen) and duplicates dropped.
export function rankLibrary(items, profile, options = {}, { limit = 12, now = Date.now() } = {}) {
  const year = new Date(now).getFullYear();
  const released = (items || []).filter((i) => i.year === undefined || Number(i.year) <= year);
  const unseen = released.filter((i) => (i.watchedDates?.length || 0) === 0);
  const pool = unseen.length ? unseen : released;

  const seen = new Set();
  const scored = [];
  for (const item of pool) {
    const key = titleKey(item);
    if (seen.has(String(item.id)) || seen.has(key)) continue;
    seen.add(String(item.id));
    seen.add(key);
    scored.push({ item, ...scoreLibraryItem(item, profile, options) });
  }
  return scored.sort((a, b) => b.score - a.score || String(a.item.title).localeCompare(String(b.item.title))).slice(0, limit);
}

// ---- helpers used by TMDb seeding/ranking (see recommend.js) ----

// How much a film's tags line up with what you love, 0..1.
export function tagAffinity(item, profile) {
  const known = uniqueTags(item).map((t) => profile.tagScore.get(t)).filter(Boolean).sort((a, b) => b.score - a.score);
  return clamp(mean(known.slice(0, 3).map((k) => k.score)), 0, 1);
}

// Prefer a spread of seeds: after choosing one, films sharing its tags are
// discounted so five slasher favorites don't crowd out everything else.
export function diversifySeeds(candidates, max, overlapPenalty = 0.85) {
  const remaining = candidates.map((c) => ({ ...c, adjusted: c.weight }));
  const chosen = [];
  while (chosen.length < max && remaining.length) {
    remaining.sort((a, b) => b.adjusted - a.adjusted || a.id - b.id);
    const pick = remaining.shift();
    chosen.push(pick);
    for (const other of remaining) {
      const shared = pick.tags.filter((t) => other.tags.includes(t)).length;
      if (shared) other.adjusted *= Math.pow(overlapPenalty, Math.min(shared, 3));
    }
  }
  return chosen;
}
