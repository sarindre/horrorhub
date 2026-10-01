import { evaluateItem, itemFlags } from "./contentFlags.js";
import { canonicalTag } from "./tagging.js";
import { scareOf } from "./scare.js";
import { rankLibrary } from "./taste.js";
import { matchesMood } from "./moods.js";
import { scareWord } from "./tonight.js";

// Mystery Reel: a blind pick. You choose the vibe and how scary, and get a film described
// only by its length, intensity, subgenres and content warnings, with the title, poster
// and plot hidden until you decide to reveal it. Everything needed to decide whether it's
// right for tonight is shown (including warnings); only the spoilers are held back.
// Films over your content limits are never drawn, whatever your "warn or hide" mode.
// Pure; features/tonight/MysteryReel renders it.

const SCARE_WINDOW = 3; // a film "fits" when its scare level is within this of what you asked for
const POOL_TOP = 5; // draw at random from the best few, so "draw another" gives variety without leaving good matches

// Films that can be drawn: unwatched, released, and inside your limits.
export function mysteryPool(items, { prefs = {}, now = new Date(), skipped = [] } = {}) {
  const year = now.getFullYear();
  return (items || []).filter(
    (i) =>
      !(i.watchedDates || []).length &&
      (i.year === undefined || Number(i.year) <= year) &&
      !skipped.includes(i.id) &&
      !evaluateItem(i, prefs).blocked
  );
}

// Draws one film from those that fit the scare level and vibe you asked for (best few, at
// random). If nothing fits, it draws the closest match and says so (`fit: false`), rather
// than showing something wildly off. `rng` is injectable so tests are exact.
// Returns { item, reasons, fit } or null.
export function drawMystery(items, profile, { scare = 5, moodId = "all", mixer, prefs = {}, now = new Date(), skipped = [], rng = Math.random } = {}) {
  const pool = mysteryPool(items, { prefs, now, skipped });
  if (!pool.length) return null;
  const fits = (i) => Math.abs(scareOf(i, { bias: profile?.scareBias || 0 }).value - scare) <= SCARE_WINDOW && (moodId === "all" || matchesMood(i.tags || [], moodId));
  const fitting = pool.filter(fits);
  const ranked = rankLibrary(fitting.length ? fitting : pool, profile, { moodId, scare, mixer }, { limit: POOL_TOP, now: now.getTime() });
  if (!ranked.length) return null;
  const pick = ranked[Math.min(ranked.length - 1, Math.floor(rng() * ranked.length))];
  return { item: pick.item, reasons: pick.reasons, fit: fitting.length > 0 };
}

const words = (text) => String(text || "").toLowerCase().match(/[a-z0-9]{4,}/g) || [];

// Subgenre tags that are safe to show: never one that contains a word from the title
// (a tag you typed yourself could be a character's name or the title itself).
export function safeTags(item, limit = 3) {
  const titleWords = new Set(words(item.title));
  return (item.tags || [])
    .map(canonicalTag)
    .filter((t) => t && !words(t).some((w) => titleWords.has(w)))
    .slice(0, limit);
}

const runtimeText = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
const join = (list) => (list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`);

// What you're told before revealing: no title, year, poster, cast or plot.
//   { line, runtime, runtimeText, scare, estimated, intensity, decade, tags, flags }
export function mysteryClue(item, { bias = 0 } = {}) {
  const tags = safeTags(item);
  const s = scareOf(item, { bias });
  const decade = item.year ? `${Math.floor(item.year / 10) * 10}s` : "";
  const kind = tags.length ? `${join(tags.map((t) => `#${t}`))} film` : "horror film";
  return {
    line: `A ${kind}${decade ? ` from the ${decade}` : ""}.`,
    runtime: item.runtime > 0 ? item.runtime : null,
    runtimeText: item.runtime > 0 ? runtimeText(item.runtime) : "length unknown",
    scare: s.value,
    estimated: s.estimated,
    intensity: scareWord(s.value),
    decade,
    tags,
    flags: itemFlags(item),
  };
}
