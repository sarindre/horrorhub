import { readJSON, writeJSON } from "./storage.js";
import { evaluateItem } from "./contentFlags.js";
import { buildTasteProfile, scoreLibraryItem } from "./taste.js";

// Challenges: themed goals ("watch 5 creature features in two weeks") with
// progress DERIVED from your library's watch dates. Nothing is tracked
// separately, so logging a watch anywhere in the app moves every challenge.
// Everything here is pure except the load/save helpers at the bottom.
// Days are local calendar days as "YYYY-MM-DD" strings.

const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, "0");

export const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const parseDay = (key) => {
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (key, n) => {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};
export const daysBetween = (from, to) => Math.round((parseDay(to) - parseDay(from)) / DAY_MS);
const isDayKey = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(parseDay(v).getTime());

// ---------- templates ----------
// kind "daily": watch something on N different days in the window
// kind "count": watch `target` different films matching any of the `match`
//   clauses; a clause's fields must ALL hold (yearMin/yearMax, tagsAny,
//   keywordsAny, runtimeMax). No `match` means any film counts.
// startFor(now) fixes the window (seasonal ones); otherwise it starts today.

function nextFriday13(now) {
  for (let i = 0; i < 400; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (d.getDay() === 5 && d.getDate() === 13) return dayKey(d);
  }
  return dayKey(now);
}
// This year's occurrence of a month/day window, or next year's once it has ended
function yearlyStart(month, day, length, now) {
  const start = new Date(now.getFullYear(), month, day);
  const end = new Date(start);
  end.setDate(end.getDate() + length - 1);
  return dayKey(dayKey(end) >= dayKey(now) ? start : new Date(now.getFullYear() + 1, month, day));
}

export const CHALLENGE_TEMPLATES = [
  { id: "thirty-days", title: "30 Days of Horror", blurb: "A horror film every day for 30 days. Keep the streak alive.", kind: "daily", target: 30, lengthDays: 30 },
  {
    id: "halloween-31",
    title: "31 Nights of Halloween",
    blurb: "One film every night of October.",
    kind: "daily",
    target: 31,
    lengthDays: 31,
    startFor: (now) => yearlyStart(9, 1, 31, now),
    season: (now) => now.getMonth() === 8 || now.getMonth() === 9,
    seasonReason: "It's nearly spooky season",
  },
  {
    id: "cult-classics",
    title: "Cult Classic Month",
    blurb: "Eight films from before 1990, or tagged classic or campy, in a month.",
    kind: "count",
    target: 8,
    lengthDays: 30,
    match: [{ yearMax: 1989 }, { tagsAny: ["classic", "campy"] }],
  },
  {
    id: "found-footage-week",
    title: "Found-Footage Week",
    blurb: "Three found-footage films in seven days.",
    kind: "count",
    target: 3,
    lengthDays: 7,
    match: [{ tagsAny: ["found-footage"] }],
  },
  {
    id: "creature-feature",
    title: "Late-Night Creature Feature",
    blurb: "Five creatures, zombies or vampires in two weeks. Nothing over 100 minutes.",
    kind: "count",
    target: 5,
    lengthDays: 14,
    match: [{ tagsAny: ["creature", "zombie", "vampire"], runtimeMax: 100 }],
  },
  {
    id: "summer-slashers",
    title: "Summer Slashers",
    blurb: "Six slashers before the season ends.",
    kind: "count",
    target: 6,
    lengthDays: 30,
    match: [{ tagsAny: ["slasher"] }],
    season: (now) => [5, 6, 7].includes(now.getMonth()),
    seasonReason: "Slasher season",
  },
  {
    id: "holiday-horror",
    title: "Holiday Horror",
    blurb: "Four holiday-set horror films before the year ends.",
    kind: "count",
    target: 4,
    lengthDays: 21,
    match: [{ keywordsAny: ["christmas", "holiday", "santa claus", "new year", "thanksgiving"] }],
    season: (now) => now.getMonth() === 11 || (now.getMonth() === 10 && now.getDate() >= 20),
    seasonReason: "It's the holidays",
  },
  {
    id: "friday-13th",
    title: "Friday the 13th Marathon",
    blurb: "Three films in one night.",
    kind: "count",
    target: 3,
    lengthDays: 1,
    startFor: (now) => nextFriday13(now),
    season: (now) => daysBetween(dayKey(now), nextFriday13(now)) <= 14,
    seasonReason: "Friday the 13th is coming",
  },
];
const templateById = (id) => CHALLENGE_TEMPLATES.find((t) => t.id === id);

// Templates that fit the calendar right now, most relevant first.
export function seasonalTemplates(now = new Date()) {
  return CHALLENGE_TEMPLATES.filter((t) => t.season?.(now)).map((t) => ({ template: t, reason: t.seasonReason }));
}

// Start a challenge from a template. Rolling ones begin today; seasonal ones
// use their calendar window (the upcoming one if this year's has ended).
export function createChallenge(templateId, { now = new Date() } = {}) {
  const t = templateById(templateId);
  if (!t) return null;
  const startDate = t.startFor ? t.startFor(now) : dayKey(now);
  return {
    id: `${t.id}-${startDate}`,
    templateId: t.id,
    title: t.title,
    kind: t.kind,
    target: t.target,
    startDate,
    endDate: addDays(startDate, t.lengthDays - 1),
    match: t.match || [],
    createdAt: now.toISOString(),
  };
}

// ---------- matching ----------

export function matchesClause(item, clause) {
  if (clause.yearMax != null && !(item.year && item.year <= clause.yearMax)) return false;
  if (clause.yearMin != null && !(item.year && item.year >= clause.yearMin)) return false;
  if (clause.tagsAny && !clause.tagsAny.some((t) => (item.tags || []).includes(t))) return false;
  if (clause.keywordsAny && !clause.keywordsAny.some((k) => (item.keywords || []).some((x) => x.includes(k)))) return false;
  if (clause.runtimeMax != null && item.runtime && item.runtime > clause.runtimeMax) return false; // unknown runtime gets the benefit of the doubt
  return true;
}
export const matchesChallenge = (item, challenge) => !challenge.match?.length || challenge.match.some((c) => matchesClause(item, c));

// ---------- streaks ----------

// Longest run of consecutive days, and the run that is still alive: it ends
// today, or yesterday (you haven't watched yet today, so it isn't broken).
export function streaksFrom(days, today) {
  const sorted = [...new Set(days)].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  const runEndingAt = new Map();
  for (const d of sorted) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    runEndingAt.set(d, run);
    longest = Math.max(longest, run);
    prev = d;
  }
  const current = runEndingAt.get(today) ?? runEndingAt.get(addDays(today, -1)) ?? 0;
  return { current, longest };
}

export const watchDays = (item) => (item.watchedDates || []).map((d) => dayKey(new Date(d)));

// Your overall watch streak across the whole library.
export function watchStreak(library, now = new Date()) {
  return streaksFrom(library.flatMap(watchDays), dayKey(now));
}

// ---------- progress ----------

// Where a challenge stands. status: "upcoming" | "active" | "completed" | "expired".
export function evaluateChallenge(challenge, library, now = new Date()) {
  const today = dayKey(now);
  const { startDate, endDate } = challenge;
  const inWindow = (d) => d >= startDate && d <= endDate;

  const watches = [];
  for (const item of library) for (const day of watchDays(item)) if (inWindow(day)) watches.push({ item, day });
  watches.sort((a, b) => a.day.localeCompare(b.day));

  let matched;
  let completedOn = null;
  if (challenge.kind === "daily") {
    const seen = new Set();
    matched = watches.filter((w) => (seen.has(w.day) ? false : seen.add(w.day)));
  } else {
    const seen = new Set();
    matched = watches.filter((w) => matchesChallenge(w.item, challenge) && (seen.has(w.item.id) ? false : seen.add(w.item.id)));
  }
  const done = matched.length;
  if (done >= challenge.target) completedOn = matched[challenge.target - 1].day;

  let status;
  if (completedOn) status = "completed";
  else if (today > endDate) status = "expired";
  else if (today < startDate) status = "upcoming";
  else status = "active";

  const daysLeft = today > endDate ? 0 : daysBetween(today < startDate ? startDate : today, endDate) + 1;
  return {
    status,
    done,
    target: challenge.target,
    pct: Math.min(100, Math.round((done / challenge.target) * 100)),
    remaining: Math.max(0, challenge.target - done),
    daysLeft,
    completedOn,
    matched,
    streak: streaksFrom(watches.map((w) => w.day), today),
  };
}

// "about 1 every 3 days" / "2 a day" style pacing, or "" when it doesn't apply.
export function pacePhrase(remaining, daysLeft) {
  if (remaining <= 0 || daysLeft <= 0) return "";
  const perDay = remaining / daysLeft;
  if (perDay > 1) return `${Math.ceil(perDay)} a day`;
  if (perDay === 1) return "1 a day";
  return `about 1 every ${Math.max(2, Math.round(daysLeft / remaining))} days`;
}

// ---------- generating a watch list ----------

// Unwatched, released films from your library that count toward the challenge,
// best taste fit first. Films over your content limits are left out so a
// generated list never surprises you.
export function suggestForChallenge(challenge, library, { profile, prefs = {}, now = new Date(), limit } = {}) {
  const p = profile || buildTasteProfile(library, { now: now.getTime() });
  const status = evaluateChallenge(challenge, library, now);
  const year = now.getFullYear();
  const want = limit ?? Math.min(7, Math.max(1, status.remaining));
  const scare = p.scarePref != null ? Math.round(p.scarePref) : 5;

  return library
    .filter((i) => (i.watchedDates || []).length === 0)
    .filter((i) => i.year === undefined || Number(i.year) <= year)
    .filter((i) => challenge.kind === "daily" || matchesChallenge(i, challenge))
    .filter((i) => !evaluateItem(i, prefs).blocked)
    .map((item) => {
      const scored = scoreLibraryItem(item, p, { scare });
      const reasons = challenge.kind === "daily" ? scored.reasons : [`Counts toward ${challenge.title}`, ...scored.reasons];
      return { item, score: scored.score, reasons: reasons.slice(0, 3) };
    })
    .sort((a, b) => b.score - a.score || String(a.item.title).localeCompare(String(b.item.title)))
    .slice(0, want);
}

// ---------- ideas from TMDb (films you don't own yet) ----------

// Search terms for TMDb keywords, from the challenge's first clause.
export function challengeKeywordTerms(challenge) {
  const clause = (challenge.match || [])[0] || {};
  const terms = [...(clause.tagsAny || []).map((t) => t.replace(/-/g, " ")), ...(clause.keywordsAny || [])];
  return [...new Set(terms)].filter((t) => !["classic", "campy"].includes(t));
}

// The TMDb discover request for a challenge (horror, well-known, matching the
// era/runtime/keywords). `keywordIds` are TMDb keyword ids resolved from the terms.
export function challengeDiscoverPath(challenge, keywordIds = []) {
  const clause = (challenge.match || [])[0] || {};
  const q = ["include_adult=false", "language=en-US", "with_genres=27", "sort_by=vote_count.desc", "vote_count.gte=300"];
  if (clause.yearMax != null) q.push(`primary_release_date.lte=${clause.yearMax}-12-31`);
  if (clause.yearMin != null) q.push(`primary_release_date.gte=${clause.yearMin}-01-01`);
  if (clause.runtimeMax != null) q.push(`with_runtime.lte=${clause.runtimeMax}`);
  if (keywordIds.length) q.push(`with_keywords=${keywordIds.join("|")}`);
  return `/discover/movie?${q.join("&")}`;
}

// ---------- persistence ----------
// { version: 1, items: [...] } under "horrorhub.challenges.v1"

export const CHALLENGES_KEY = "horrorhub.challenges.v1";
export const CHALLENGES_VERSION = 1;

export function normalizeChallenge(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.id !== "string" || !raw.id || typeof raw.title !== "string" || !raw.title.trim()) return null;
  if (!["daily", "count"].includes(raw.kind)) return null;
  const target = Math.round(Number(raw.target));
  if (!Number.isFinite(target) || target < 1 || target > 366) return null;
  if (!isDayKey(raw.startDate) || !isDayKey(raw.endDate) || raw.endDate < raw.startDate) return null;
  const match = Array.isArray(raw.match) ? raw.match.filter((c) => c && typeof c === "object") : [];
  return {
    id: raw.id,
    templateId: typeof raw.templateId === "string" ? raw.templateId : "custom",
    title: raw.title.trim(),
    kind: raw.kind,
    target,
    startDate: raw.startDate,
    endDate: raw.endDate,
    match,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    ...(isDayKey(raw.completedAt) ? { completedAt: raw.completedAt } : {}),
  };
}

export const normalizeChallenges = (list) => (Array.isArray(list) ? list.map(normalizeChallenge).filter(Boolean) : []);

// Add incoming challenges (from an import) without replacing ones you already have.
export function mergeChallenges(existing, incoming) {
  const result = normalizeChallenges(existing);
  const ids = new Set(result.map((c) => c.id));
  let added = 0;
  for (const c of normalizeChallenges(incoming)) {
    if (ids.has(c.id)) continue;
    result.push(c);
    ids.add(c.id);
    added++;
  }
  return { challenges: result, added };
}

export function loadChallenges() {
  const stored = readJSON(CHALLENGES_KEY);
  return normalizeChallenges(stored?.items);
}
export function saveChallenges(list) {
  return writeJSON(CHALLENGES_KEY, { version: CHALLENGES_VERSION, items: list });
}
