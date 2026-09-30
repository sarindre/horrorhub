import { rankLibrary } from "./taste.js";
import { evaluateItem, hasContentLimits } from "./contentFlags.js";
import { dayKey, evaluateChallenge, watchDays, watchStreak } from "./challenges.js";

// The Tonight screen's logic: which film to suggest first, and what's in
// progress. Pure; the screen only renders it.

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export const scareWord = (n) => (n <= 3 ? "Spooky" : n <= 6 ? "Intense" : "Traumatizing");

// Where the scare dial starts: your usual level, never above what the quiz said
// was too much or your own limit.
export function defaultScare(profile, prefs = {}) {
  let s = profile.scarePref != null ? Math.round(profile.scarePref) : 5;
  if (profile.scareCeiling != null) s = Math.min(s, profile.scareCeiling);
  s = Math.min(s, prefs.maxScares ?? 10);
  return clamp(s, 0, 10);
}

// Best-first picks from your own library. `passed` are films you told us never
// to suggest; `skipped` are ones you rerolled this session. In "hide" mode,
// films over your content limits are removed (and counted).
export function tonightPicks(items, profile, { scare, moodId = "all", mixer, passed = [], skipped = [], prefs = {}, now = Date.now(), limit = 6 } = {}) {
  const ranked = rankLibrary(items, profile, { moodId, scare, mixer }, { limit: 200, now })
    .filter((r) => !passed.includes(r.item.id) && !skipped.includes(r.item.id))
    .map((r) => ((r.item.watchedDates || []).length ? { ...r, reasons: ["A rewatch", ...r.reasons].slice(0, 3) } : r));
  const hiding = prefs.contentMode === "hide" && hasContentLimits(prefs);
  const visible = hiding ? ranked.filter((r) => !evaluateItem(r.item, prefs).blocked) : ranked;
  return { picks: visible.slice(0, limit), hiddenCount: ranked.length - visible.length };
}

// Short lines about what's going on: a live watch streak and running challenges.
export function inProgress(library, challenges = [], now = new Date()) {
  const lines = [];
  const today = dayKey(now);
  const { current } = watchStreak(library, now);
  if (current >= 2) {
    const watchedToday = library.some((i) => watchDays(i).includes(today));
    lines.push({ id: "streak", tab: "challenges", text: `${current}-day watch streak${watchedToday ? "" : ": watch tonight to keep it alive"}` });
  }
  for (const c of challenges) {
    const s = evaluateChallenge(c, library, now);
    if (s.status !== "active") continue;
    lines.push({ id: `challenge:${c.id}`, tab: "challenges", text: `${c.title}: ${s.done} of ${s.target}, ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} left` });
  }
  return lines.slice(0, 3);
}
