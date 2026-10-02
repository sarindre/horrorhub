import { dayKey, isoDateOnly, parseDay } from "./dates.js";
import { watchDays } from "./challenges.js";
import { normalizeDiary, withoutDiaryEntry } from "./diary.js";

// The watches shown (and editable) on a challenge card, newest first: every watch in the window
// for a daily challenge, and the films that count for a themed one. Each is { item, day }.
export function challengeWatches(challenge, library, result) {
  const list =
    challenge.kind === "daily"
      ? library.flatMap((item) => watchDays(item).filter((d) => d >= challenge.startDate && d <= challenge.endDate).map((day) => ({ item, day })))
      : result.matched;
  return [...list].sort((a, b) => b.day.localeCompare(a.day) || String(a.item.title).localeCompare(String(b.item.title)));
}

const sameDay = (stored, day) => dayKey(new Date(stored)) === day;

// The film without its watch on `day` (and that day's diary note). Other watches stay.
export const removeWatch = (item, day) => ({
  ...item,
  watchedDates: (item.watchedDates || []).filter((d) => !sameDay(d, day)),
  diary: withoutDiaryEntry(item.diary, day),
});

// The film with its watch on `from` moved to `to`, carrying that day's diary note along.
export function moveWatch(item, from, to) {
  if (from === to) return item;
  const moved = isoDateOnly(parseDay(to));
  const dates = (item.watchedDates || []).map((d) => (sameDay(d, from) ? moved : d));
  const notes = item.diary || [];
  const diary = [...notes.filter((e) => e?.day === from).map((e) => ({ ...e, day: to })), ...notes.filter((e) => e?.day !== from)];
  return { ...item, watchedDates: [...new Set(dates)], diary: normalizeDiary(diary) };
}
