export const TMDB_BASE = "https://api.themoviedb.org/3";

export const TMDB_IMG = (path, size = "w342") => (path ? `https://image.tmdb.org/t/p/${size}${path}` : "");

// TMDb genre id for Horror
export const HORROR_GENRE_ID = 27;

const ERROR_MESSAGES = {
  auth: "TMDb rejected your API token. Check it in Settings.",
  "rate-limit": "TMDb is rate limiting requests. Try again in a moment.",
  network: "Couldn't reach TMDb. Check your connection.",
  http: "TMDb returned an error.",
};

export class TmdbError extends Error {
  constructor(kind, status) {
    super(ERROR_MESSAGES[kind] || ERROR_MESSAGES.http);
    this.name = "TmdbError";
    this.kind = kind;
    this.status = status;
  }
}

export const isAbort = (err) => err?.name === "AbortError";

// User-facing text for anything a TMDb call can throw.
export const describeError = (err) => (err instanceof TmdbError ? err.message : "Something went wrong talking to TMDb.");

// In-memory response cache (per tab, per token) for opt-in short-lived reuse,
// e.g. flipping between Discover sort buttons.
const responseCache = new Map();
export const clearTmdbCache = () => responseCache.clear();

// GET a TMDb v3 path using a v4 bearer token. Throws TmdbError (or the
// original AbortError when the request is cancelled) instead of returning junk.
// Pass cacheMs to reuse a successful response for that long.
export async function tmdbGet(path, { apiKey, signal, cacheMs = 0 } = {}) {
  const cacheKey = `${apiKey}|${path}`;
  if (cacheMs > 0) {
    const hit = responseCache.get(cacheKey);
    if (hit && Date.now() - hit.at < cacheMs) return hit.data;
  }
  let res;
  try {
    res = await fetch(`${TMDB_BASE}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json;charset=utf-8" },
      signal,
    });
  } catch (err) {
    if (isAbort(err)) throw err;
    throw new TmdbError("network");
  }
  if (!res.ok) {
    throw new TmdbError(res.status === 401 ? "auth" : res.status === 429 ? "rate-limit" : "http", res.status);
  }
  const data = await res.json();
  if (cacheMs > 0) responseCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

// A TMDb list row -> the item shape the cards use. Deliberately has no
// watchedDates/tags/addedAt: anything present here gets written to your
// library when you add the film, and would overwrite what you already have.
export function mapMovie(m) {
  return {
    id: m.id,
    title: m.title,
    year: m.release_date ? Number(m.release_date.slice(0, 4)) : undefined,
    poster: m.poster_path,
    overview: m.overview,
    voteAvg: typeof m.vote_average === "number" ? m.vote_average : undefined,
  };
}

// Streaming services we show badges for, from a /watch/providers response.
const PROVIDER_SLUGS = [["netflix", "netflix"], ["prime", "prime"], ["hulu", "hulu"], ["disney", "disney"]];
export function parseProviders(data, region = "US") {
  const us = data?.results?.[region] || {};
  const all = [...(Array.isArray(us.flatrate) ? us.flatrate : []), ...(Array.isArray(us.ads) ? us.ads : [])];
  const slugs = all.map((p) => {
    const name = String(p?.provider_name || "").toLowerCase();
    return PROVIDER_SLUGS.find(([needle]) => name.includes(needle))?.[1] || null;
  });
  return [...new Set(slugs.filter(Boolean))];
}
