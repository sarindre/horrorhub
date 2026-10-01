import { HORROR_GENRE_ID, isAbort, mapMovie, tmdbGet } from "./tmdb.js";
import { challengeKeywordTerms } from "./challenges.js";
import { MOOD_PRESETS } from "./moods.js";
import { isOwnedTitle, ownedTitleKeys } from "./library.js";

// Ask HorrorHub, beyond your library: the same filters turned into a TMDb request
// for well-known films you don't own yet. TMDb knows runtime, release dates and
// keywords, so those carry over; it has no scare levels, ratings or watch history,
// so those filters only apply to your library. Content exclusions are checked
// afterwards, once each film's warnings are looked up (see features/ask).

const DAY_MS = 24 * 60 * 60 * 1000;
const LIST_CACHE_MS = 5 * 60 * 1000;

// Subgenres to look for on TMDb: the tags you asked for, plus the tags behind any mood.
export function askTags(filters) {
  const moodTags = filters.moods.flatMap((id) => MOOD_PRESETS.find((p) => p.id === id)?.tags || []).slice(0, 3);
  return [...new Set([...filters.tags, ...moodTags])];
}

// The /discover request (no topic words), or the /search request (with one).
export function askPath(filters, { keywordIds = [], region = "US" } = {}) {
  if (filters.terms.length) return `/search/movie?include_adult=false&language=en-US&query=${encodeURIComponent(filters.terms.join(" "))}`;
  const q = ["include_adult=false", "language=en-US", `with_genres=${HORROR_GENRE_ID}`, `region=${region}`, "sort_by=vote_count.desc", "vote_count.gte=100"];
  if (filters.runtimeMax !== undefined) q.push(`with_runtime.lte=${filters.runtimeMax}`);
  if (filters.runtimeMin !== undefined) q.push(`with_runtime.gte=${filters.runtimeMin}`);
  if (filters.yearMin !== undefined) q.push(`primary_release_date.gte=${filters.yearMin}-01-01`);
  if (filters.yearMax !== undefined) q.push(`primary_release_date.lte=${filters.yearMax}-12-31`);
  if (keywordIds.length) q.push(`with_keywords=${keywordIds.join("|")}`);
  return `/discover/movie?${q.join("&")}`;
}

// Films from TMDb that fit and that you don't already have. Returns { films, note }
// where `note` explains an empty result.
export async function fetchAskIdeas(filters, { apiKey, signal, library = [], region = "US", limit = 12 } = {}) {
  const tags = askTags(filters);
  const terms = challengeKeywordTerms({ match: [{ tagsAny: tags }] });
  let keywordIds = [];
  if (!filters.terms.length && terms.length) {
    const found = await Promise.all(
      terms.map(async (term) => {
        try {
          const data = await tmdbGet(`/search/keyword?query=${encodeURIComponent(term)}`, { apiKey, signal, cacheMs: DAY_MS });
          return (data.results || []).find((r) => String(r.name).toLowerCase() === term)?.id ?? data.results?.[0]?.id;
        } catch (err) {
          if (isAbort(err) || err.kind === "auth") throw err;
          return undefined; // a missing keyword just narrows the search less
        }
      })
    );
    keywordIds = found.filter(Boolean);
    if (!keywordIds.length) return { films: [], note: "TMDb doesn't have a keyword for those subgenres, so there's nothing to search with." };
  }

  const data = await tmdbGet(askPath(filters, { keywordIds, region }), { apiKey, signal, cacheMs: LIST_CACHE_MS });
  const ownedIds = new Set(library.map((i) => String(i.id)));
  const ownedKeys = ownedTitleKeys(library);
  const year = (m) => (m.release_date ? Number(m.release_date.slice(0, 4)) : undefined);
  const films = (data.results || [])
    .filter((m) => !filters.terms.length || (m.genre_ids || []).includes(HORROR_GENRE_ID)) // a search isn't limited to horror
    .filter((m) => (filters.yearMin === undefined || (year(m) !== undefined && year(m) >= filters.yearMin)) && (filters.yearMax === undefined || (year(m) !== undefined && year(m) <= filters.yearMax)))
    .map(mapMovie)
    .filter((m) => !ownedIds.has(String(m.id)) && !isOwnedTitle(ownedKeys, m))
    .slice(0, limit);
  return { films, note: films.length ? "" : "TMDb had nothing new that fits." };
}
