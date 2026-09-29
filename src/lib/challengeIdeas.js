import { isAbort, mapMovie, tmdbGet } from "./tmdb.js";
import { challengeDiscoverPath, challengeKeywordTerms } from "./challenges.js";
import { isOwnedTitle, ownedTitleKeys } from "./library.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const LIST_CACHE_MS = 5 * 60 * 1000;

// Well-known films from TMDb that would count toward a challenge and that you
// don't already have. Keyword ids are looked up by name (and remembered for a
// day) rather than hard-coded, since TMDb owns those ids.
export async function fetchChallengeIdeas(challenge, { apiKey, signal, library = [], limit = 8 } = {}) {
  const terms = challengeKeywordTerms(challenge);
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
  const keywordIds = found.filter(Boolean);
  // asked for a subgenre but couldn't resolve it: better to show nothing than generic horror
  if (terms.length && !keywordIds.length) return [];

  const data = await tmdbGet(challengeDiscoverPath(challenge, keywordIds), { apiKey, signal, cacheMs: LIST_CACHE_MS });
  const ownedIds = new Set(library.map((i) => String(i.id)));
  const ownedKeys = ownedTitleKeys(library);
  return (data.results || [])
    .map(mapMovie)
    .filter((m) => !ownedIds.has(String(m.id)) && !isOwnedTitle(ownedKeys, m))
    .slice(0, limit);
}
