import { mapMovie, tmdbGet } from "./tmdb.js";
import { mergeLibraries, normalizeItem } from "./library.js";

// Matching imported films to TMDb. A Letterboxd or IMDb import creates films
// with text ids ("letterboxd:Alien:1979", "imdb:tt0078748") and no poster,
// overview or TMDb id. Until they're matched they can't be tagged, warned
// about, or used to seed recommendations. Matching swaps in the real TMDb id
// and metadata while keeping everything you entered (ratings, watch dates,
// tags, notes). The pure parts are here; the network calls are at the bottom.

const normTitle = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const releaseYear = (movie) => (movie?.release_date ? Number(movie.release_date.slice(0, 4)) : undefined);

// A film that came from an import and hasn't been linked to TMDb.
export const isImported = (item) => typeof item.id === "string" && /^(letterboxd|imdb):/.test(item.id);
// ...and hasn't been tried yet (or was reset for a retry).
export const needsMatching = (item) => isImported(item) && !item.tmdbMatchTriedAt;
// ...tried, but no confident match was found: needs a manual match.
export const isUnmatched = (item) => isImported(item) && !!item.tmdbMatchTriedAt;

export function imdbIdOf(item) {
  if (item.imdbId) return item.imdbId;
  const m = /^imdb:(tt\d+)$/.exec(String(item.id));
  return m ? m[1] : null;
}

// Choose the right film from TMDb's search results, or null when unsure.
// A wrong match would attach someone else's poster and tags, so this is strict:
// the title must match exactly (ignoring case and punctuation). With a year,
// the release year must be within one (release dates differ by region); without
// a year there must be exactly one exact-title result.
export function pickBestMatch(item, results) {
  const title = normTitle(item.title);
  if (!title) return null;
  const exact = (results || []).filter((r) => normTitle(r.title) === title || normTitle(r.original_title) === title);
  if (!exact.length) return null;
  if (!item.year) return exact.length === 1 ? exact[0] : null;
  const close = exact
    .map((r) => ({ r, diff: Math.abs((releaseYear(r) ?? 9999) - item.year) }))
    .filter((x) => x.diff <= 1)
    .sort((a, b) => a.diff - b.diff || (b.r.popularity || 0) - (a.r.popularity || 0));
  return close.length ? close[0].r : null;
}

// TMDb result -> the fields we copy onto a film.
export function matchFields(movie) {
  const mapped = mapMovie(movie);
  return { id: mapped.id, title: mapped.title, year: mapped.year, poster: mapped.poster, overview: mapped.overview, releaseDate: movie.release_date || undefined };
}

// Point a library film at its TMDb record. Everything you entered is kept. If
// you already have that TMDb film, the two are merged (your data from both,
// watch dates combined, the imported rating winning over a blank one).
// Returns { library, merged } and never loses a film.
export function relinkItem(library, oldId, movie, { now = new Date() } = {}) {
  const old = library.find((i) => i.id === oldId);
  if (!old || movie?.id === undefined) return { library, merged: false };
  const fields = matchFields(movie);
  const imdbId = imdbIdOf(old);
  const linked = {
    ...old,
    id: fields.id,
    title: fields.title || old.title,
    year: old.year || fields.year,
    poster: fields.poster || old.poster,
    overview: fields.overview || old.overview,
    releaseDate: fields.releaseDate || old.releaseDate,
    ...(imdbId ? { imdbId } : {}),
    tmdbMatchedAt: now.toISOString(),
    tmdbMatchTriedAt: undefined,
    taggedAt: undefined, // now that TMDb knows it, let auto-tagging analyze it
  };

  const rest = library.filter((i) => i.id !== oldId);
  if (rest.some((i) => i.id === fields.id)) {
    const { items } = mergeLibraries(rest, [linked]);
    return { library: items, merged: true };
  }
  const normalized = normalizeItem(linked);
  if (!normalized) return { library, merged: false };
  return { library: library.map((i) => (i.id === oldId ? normalized : i)), merged: false };
}

// ---------- network ----------

// The TMDb film for an imported item, or null. IMDb ids resolve exactly; otherwise
// search by title (and year, which TMDb can restrict to).
export async function findTmdbMatch(item, { apiKey, signal } = {}) {
  const imdbId = imdbIdOf(item);
  if (imdbId) {
    const found = await tmdbGet(`/find/${imdbId}?external_source=imdb_id&language=en-US`, { apiKey, signal });
    if (found.movie_results?.[0]) return found.movie_results[0];
    // an IMDb id that isn't a film TMDb knows: fall through to a title search
  }
  const title = encodeURIComponent(item.title);
  const base = `/search/movie?include_adult=false&language=en-US&query=${title}`;
  const attempts = item.year ? [`${base}&primary_release_year=${item.year}`, `${base}&year=${item.year}`, base] : [base];
  for (const path of attempts) {
    const data = await tmdbGet(path, { apiKey, signal });
    const pick = pickBestMatch(item, data.results);
    if (pick) return pick;
  }
  return null;
}

// Free-text search for the manual "find a match" flow.
export async function searchTmdb(query, { apiKey, signal } = {}) {
  const q = String(query || "").trim();
  if (!q) return [];
  const data = await tmdbGet(`/search/movie?include_adult=false&language=en-US&query=${encodeURIComponent(q)}`, { apiKey, signal });
  return (data.results || []).slice(0, 8);
}
