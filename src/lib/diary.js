import { dayKey, parseDay } from "./dates.js";

// The scare diary: an optional note on a watch. How scared you actually were
// (0-10), who you watched with, and what time of day. Stored on the film as
// `diary: [{ day, scared, company, when }]`, one entry per day. Every field is
// optional, and an entry with none of them isn't kept.

export const COMPANY = [
  { id: "alone", label: "Alone" },
  { id: "partner", label: "With a partner" },
  { id: "friends", label: "With friends" },
  { id: "family", label: "With family" },
];
export const WHEN = [
  { id: "day", label: "Daytime" },
  { id: "evening", label: "Evening" },
  { id: "late", label: "Late night" },
];
const COMPANY_IDS = COMPANY.map((c) => c.id);
const WHEN_IDS = WHEN.map((w) => w.id);
export const companyLabel = (id) => COMPANY.find((c) => c.id === id)?.label || "";
export const whenLabel = (id) => WHEN.find((w) => w.id === id)?.label || "";

// a real calendar day: "2026-13-45" would roll over into a different date, so it must survive a round trip
const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && dayKey(parseDay(v)) === v;

// One entry, cleaned up, or null if nothing usable is in it.
export function normalizeEntry(raw) {
  if (!raw || typeof raw !== "object" || !isDay(raw.day)) return null;
  const scared = raw.scared === null || raw.scared === undefined || raw.scared === "" ? NaN : Number(raw.scared);
  const entry = {
    day: raw.day,
    ...(Number.isFinite(scared) ? { scared: Math.min(10, Math.max(0, Math.round(scared))) } : {}),
    ...(COMPANY_IDS.includes(raw.company) ? { company: raw.company } : {}),
    ...(WHEN_IDS.includes(raw.when) ? { when: raw.when } : {}),
  };
  return Object.keys(entry).length > 1 ? entry : null;
}

// A clean list: valid entries only, one per day (the first wins), oldest first.
export function normalizeDiary(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry || seen.has(entry.day)) continue;
    seen.add(entry.day);
    out.push(entry);
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

// Combine two diaries (an import into what you have): entries on the same day
// keep what you already wrote and gain any field you hadn't filled in.
export function mergeDiary(existing, incoming) {
  const byDay = new Map(normalizeDiary(existing).map((e) => [e.day, e]));
  for (const entry of normalizeDiary(incoming)) {
    byDay.set(entry.day, { ...entry, ...(byDay.get(entry.day) || {}) });
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

// The diary with an entry added for the day of `iso` (replacing that day's entry).
export function withDiaryEntry(diary, iso, fields) {
  const entry = normalizeEntry({ ...fields, day: dayKey(new Date(iso)) });
  if (!entry) return normalizeDiary(diary);
  return normalizeDiary([entry, ...(diary || []).filter((e) => e?.day !== entry.day)]);
}

export const withoutDiaryEntry = (diary, day) => normalizeDiary((diary || []).filter((e) => e?.day !== day));

// How scared you said you were, on average across your entries for a film
// (a rounded 0-10), or null if you never said.
export function diaryScare(item) {
  const scores = (item?.diary || []).map((e) => e.scared).filter((n) => Number.isFinite(n));
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
}
