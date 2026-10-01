// What to tell someone after they act on a card from TMDb (rate it, add it, log a watch):
// where the film went, so it doesn't just seem to vanish. Pure.

export const LIBRARY_PLACE = "My Library → All films";
export const WATCHLIST_PLACE = "Plan → Watchlist & plans";

// `item` is what the card sent; `was` is what we knew before: { rating, inLibrary, onWatchlist }.
// Returns { key, text } (key lets the caller avoid saying the same thing twice), or null
// when nothing worth announcing changed (for example dragging the scare slider on a film
// that's already in your library).
export function touchMessage(item, was = {}) {
  const title = item.title;
  if (item.rating > 0 && item.rating !== (was.rating || 0)) {
    return { key: `rated:${item.rating}`, text: `Rated ${title} ${item.rating}★${was.inLibrary ? "" : " and added it to your library"}. Find it in ${LIBRARY_PLACE}.` };
  }
  if (item.watchlist === true && !was.onWatchlist) {
    return { key: "watchlist", text: `Added ${title} to your watchlist. Find it in ${WATCHLIST_PLACE}.` };
  }
  const watches = item.watchedDates || [];
  if (watches.length) {
    return { key: `watched:${watches[watches.length - 1]}`, text: `Logged ${title} as watched. Find it in ${LIBRARY_PLACE}.` };
  }
  if (!was.inLibrary) {
    return { key: "added", text: `Added ${title} to your library. Find it in ${LIBRARY_PLACE}.` };
  }
  return null;
}
