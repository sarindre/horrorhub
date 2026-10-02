import { writeString } from "./storage.js";
import { loadSettings } from "./settings.js";
import { withDiaryEntry } from "./diary.js";

export const LAST_WATCH_KEY = "horrorhub.lastWatch";

// The changes that log a watch: add the date (an exact duplicate is ignored) and take the film off the
// watchlist. `diary` is the optional scare-diary note for that watch ({ scared, company, when }).
export function watchPatch(item, iso, diary, rating) {
  const patch = { watchedDates: [...new Set([...(item?.watchedDates || []), iso])], watchlist: false };
  if (typeof rating === "number") patch.rating = rating; // only when you rated it in the dialog
  if (diary) patch.diary = withDiaryEntry(item?.diary, iso, diary);
  return patch;
}

// Remembered so the "it's been a while" nudge knows when you last watched something.
export const rememberWatch = (iso) => writeString(LAST_WATCH_KEY, iso);

// For films you saw long before tracking: January 1st of your "long ago" year (Settings).
export function longAgoDate() {
  const year = Number(loadSettings().longAgoYear);
  return new Date(Number.isFinite(year) && year > 0 ? year : 1900, 0, 1);
}
