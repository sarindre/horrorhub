import { evaluateItem } from "./contentFlags.js";
import { scoreLibraryItem } from "./taste.js";
import { defaultScare, scareOf } from "./scare.js";
import { addDays, dayKey, daysBetween, evaluateChallenge, matchesChallenge, parseDay, watchDays } from "./challenges.js";

// The day-by-day plan for a challenge: which film to watch on which night.
// A plan is a list of entries { day, filmId, title, year, scares, scaresEst, runtime }
// saved on the challenge. Progress is still derived from your watch dates, so a
// plan is only an intention: watching something else never breaks anything.
// Pure functions; the challenge card renders the result.

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// Scare targets that build across the plan, gentle first and heaviest last,
// centred on your usual level.
export function scareTargets(count, base) {
  if (count <= 1) return Array(Math.max(0, count)).fill(base);
  const from = clamp(base - 2, 2, 9);
  const to = clamp(base + 1, from, 9);
  return Array.from({ length: count }, (_, i) => Math.round(from + ((to - from) * i) / (count - 1)));
}

const hasWatchOn = (library, day) => library.some((i) => watchDays(i).includes(day));

// The days that still need a film: from today (or the start, if it hasn't
// begun) to the end. A daily challenge skips days you've already watched on;
// a count challenge spreads what's left evenly across the window.
export function daysToPlan(challenge, library, now = new Date()) {
  const today = dayKey(now);
  const from = challenge.startDate > today ? challenge.startDate : today;
  if (from > challenge.endDate) return [];
  const all = Array.from({ length: daysBetween(from, challenge.endDate) + 1 }, (_, i) => addDays(from, i));
  if (challenge.kind === "daily") return all.filter((d) => !hasWatchOn(library, d));
  const remaining = challenge.target - evaluateChallenge(challenge, library, now).done;
  if (remaining <= 0) return [];
  const n = Math.min(remaining, all.length);
  return Array.from({ length: n }, (_, i) => all[Math.floor((i * all.length) / n)]);
}

const snapshot = (item, bias) => {
  const s = scareOf(item, { bias });
  return { day: "", filmId: item.id, title: item.title, year: item.year, scares: s.value, scaresEst: s.estimated || undefined, runtime: item.runtime };
};

// Films that could fill a slot: unwatched, released, on theme and inside your limits.
function candidates(challenge, library, { prefs = {}, exclude = new Set(), now = new Date() } = {}) {
  const year = now.getFullYear();
  return library.filter(
    (i) =>
      !(i.watchedDates || []).length &&
      (i.year === undefined || Number(i.year) <= year) &&
      !exclude.has(String(i.id)) &&
      (challenge.kind === "daily" || matchesChallenge(i, challenge)) &&
      !evaluateItem(i, prefs).blocked
  );
}

const firstTag = (item) => (item?.tags || [])[0];
const bestFor = (pool, profile, scare, previous) => {
  let best = null;
  for (const item of pool) {
    const repeat = previous && firstTag(item) && firstTag(item) === firstTag(previous) ? 0.15 : 0;
    const score = scoreLibraryItem(item, profile, { scare }).score - repeat;
    if (!best || score > best.score || (score === best.score && String(item.title).localeCompare(String(best.item.title)) < 0)) best = { item, score };
  }
  return best?.item || null;
};

// A fresh plan for every day that still needs a film. Days with no film left
// to give come back as open slots (filmId: null). `avoid` are film ids to skip.
export function buildChallengePlan(challenge, library, { profile, prefs = {}, avoid = [], now = new Date() } = {}) {
  const days = daysToPlan(challenge, library, now);
  const bias = profile?.scareBias || 0;
  const targets = scareTargets(days.length, defaultScare(profile, prefs));
  const pool = candidates(challenge, library, { prefs, exclude: new Set(avoid.map(String)), now });
  const plan = [];
  let previous = null;
  days.forEach((day, i) => {
    const pick = bestFor(pool, profile, targets[i], previous);
    if (!pick) return plan.push({ day, filmId: null });
    pool.splice(pool.indexOf(pick), 1);
    plan.push({ ...snapshot(pick, bias), day });
    previous = pick;
  });
  return plan;
}

// The best other film for one day of an existing plan, or null when nothing
// else fits. `avoid` lists films you've already swapped away from.
export function replacementFor(challenge, plan, day, library, { profile, prefs = {}, avoid = [], now = new Date() } = {}) {
  const used = new Set(plan.filter((e) => e.filmId !== null && e.day !== day).map((e) => String(e.filmId)));
  const current = plan.find((e) => e.day === day);
  if (current?.filmId !== null && current?.filmId !== undefined) used.add(String(current.filmId));
  const pool = candidates(challenge, library, { prefs, exclude: new Set([...used, ...avoid.map(String)]), now });
  const days = plan.map((e) => e.day);
  const targets = scareTargets(days.length, defaultScare(profile, prefs));
  const prevEntry = plan[days.indexOf(day) - 1];
  const previous = prevEntry?.filmId != null ? library.find((i) => String(i.id) === String(prevEntry.filmId)) : null;
  const pick = bestFor(pool, profile, targets[Math.max(0, days.indexOf(day))], previous);
  return pick ? { ...snapshot(pick, profile?.scareBias || 0), day } : null;
}

// Each entry with what became of it. state: "watched" | "tonight" | "upcoming" |
// "missed" | "open" (no film chosen) | "gone" (the film left your library).
export function planRows(challenge, library, now = new Date()) {
  const today = dayKey(now);
  const result = evaluateChallenge(challenge, library, now);
  const dayWatched = new Set(result.matched.map((m) => m.day));
  return (challenge.plan || []).map((entry) => {
    const item = entry.filmId === null ? null : library.find((i) => String(i.id) === String(entry.filmId)) || null;
    const filmWatched = item && watchDays(item).some((d) => d >= challenge.startDate && d <= challenge.endDate);
    const done = challenge.kind === "daily" ? dayWatched.has(entry.day) || !!filmWatched : !!filmWatched;
    let state;
    if (done) state = "watched";
    else if (entry.filmId === null) state = "open";
    else if (!item) state = "gone";
    else if (entry.day === today) state = "tonight";
    else state = entry.day < today ? "missed" : "upcoming";
    return { ...entry, item, state, isToday: entry.day === today };
  });
}

// Tonight's planned film for a live challenge, if there is one and it's still unwatched.
export function tonightsEntry(challenge, library, now = new Date()) {
  return planRows(challenge, library, now).find((r) => r.state === "tonight") || null;
}

// The challenge, moved to begin today (only for ones that haven't started). The
// length stays the same and the old plan is dropped, since its days moved.
export function startChallengeNow(challenge, now = new Date()) {
  const today = dayKey(now);
  if (challenge.startDate <= today) return challenge;
  const length = daysBetween(challenge.startDate, challenge.endDate);
  const { plan: _plan, ...rest } = challenge;
  return { ...rest, startDate: today, endDate: addDays(today, length) };
}

// Calendar events, one per planned film, at `time` ("HH:MM") local.
export function challengePlanEvents(challenge, rows, time = "20:00") {
  const [hh, mm] = String(time).split(":").map(Number);
  return rows
    .filter((r) => r.item && r.state !== "watched")
    .map((r) => {
      const start = parseDay(r.day);
      start.setHours(hh || 20, mm || 0, 0, 0);
      const end = new Date(start.getTime() + (r.runtime || r.item.runtime || 100) * 60000);
      return { title: `${challenge.title}: ${r.title}${r.year ? ` (${r.year})` : ""}`, start, end, description: r.scares != null ? `Scare level ${r.scares}/10${r.scaresEst ? " (estimated)" : ""}` : "" };
    });
}
