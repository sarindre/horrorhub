import { writeString } from "./storage.js";
import { loadSettings } from "./settings.js";

export const LAST_WATCH_KEY = "horrorhub.lastWatch";

// The changes that log a watch: add the date (an exact duplicate is ignored) and take the film off the watchlist.
export function watchPatch(item, iso) {
  return { watchedDates: [...new Set([...(item?.watchedDates || []), iso])], watchlist: false };
}

// Remembered so the "it's been a while" nudge knows when you last watched something.
export const rememberWatch = (iso) => writeString(LAST_WATCH_KEY, iso);

// For films you saw long before tracking: January 1st of your "long ago" year (Settings).
export function longAgoDate() {
  const year = Number(loadSettings().longAgoYear);
  return new Date(Number.isFinite(year) && year > 0 ? year : 1900, 0, 1);
}
