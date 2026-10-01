import { toCSV } from "./csv.js";
import { dayKey } from "./dates.js";

// Export to Letterboxd. Letterboxd's importer (letterboxd.com/import) reads a CSV
// with these columns: tmdbID, Title, Year, Rating (0.5-5), WatchedDate
// (YYYY-MM-DD), Rewatch, Tags, Review. We write one row per watch, so the
// diary comes across with its dates; a TMDb id (when the film has one) makes
// Letterboxd's match exact. A separate file lists the watchlist.
// Pure; the Backup & Import card downloads the result.

export const WATCHED_COLUMNS = ["tmdbID", "Title", "Year", "Rating", "WatchedDate", "Rewatch", "Tags", "Review"];
export const WATCHLIST_COLUMNS = ["tmdbID", "Title", "Year"];

const tmdbId = (item) => (Number.isInteger(item.id) && item.id > 0 ? item.id : "");

// Real watch days, oldest first. Dates in the "long ago" placeholder year say
// "seen it, no date", so they don't become a diary entry on a made-up day.
function watchDaysOf(item, longAgoYear) {
  const days = (item.watchedDates || []).map((d) => dayKey(new Date(d))).filter((d) => Number(d.slice(0, 4)) !== longAgoYear);
  return [...new Set(days)].sort();
}
const hasWatch = (item) => (item.watchedDates || []).length > 0;

// Everything you've watched or rated, one row per watch (a film you rated or
// saw long ago, with no dated watch, gets one row without a date).
export function letterboxdWatchedRows(items, { longAgoYear = 1900 } = {}) {
  const rows = [];
  for (const item of items || []) {
    if (!hasWatch(item) && !(item.rating > 0)) continue;
    const days = watchDaysOf(item, longAgoYear);
    const tags = (item.tags || []).join(", ");
    const base = { tmdbID: tmdbId(item), Title: item.title, Year: item.year || "", Rating: item.rating > 0 ? item.rating : "" };
    if (!days.length) {
      rows.push({ ...base, WatchedDate: "", Rewatch: "", Tags: tags, Review: item.notes || "" });
      continue;
    }
    days.forEach((day, i) => {
      rows.push({ ...base, WatchedDate: day, Rewatch: i > 0 ? "true" : "", Tags: i === 0 ? tags : "", Review: i === 0 ? item.notes || "" : "" });
    });
  }
  return rows.sort((a, b) => String(a.WatchedDate).localeCompare(String(b.WatchedDate)) || a.Title.localeCompare(b.Title));
}

// Films on your watchlist that you haven't watched.
export function letterboxdWatchlistRows(items) {
  return (items || [])
    .filter((i) => i.watchlist && !hasWatch(i) && !(i.rating > 0))
    .map((i) => ({ tmdbID: tmdbId(i), Title: i.title, Year: i.year || "" }))
    .sort((a, b) => a.Title.localeCompare(b.Title));
}

// { watched: { csv, films, watches }, watchlist: { csv, films } } ready to download.
export function buildLetterboxdExport(items, options) {
  const watched = letterboxdWatchedRows(items, options);
  const watchlist = letterboxdWatchlistRows(items);
  return {
    watched: { csv: toCSV(WATCHED_COLUMNS, watched), films: new Set(watched.map((r) => `${r.Title}|${r.Year}`)).size, watches: watched.filter((r) => r.WatchedDate).length },
    watchlist: { csv: toCSV(WATCHLIST_COLUMNS, watchlist), films: watchlist.length },
  };
}
