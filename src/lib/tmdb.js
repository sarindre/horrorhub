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

// GET a TMDb v3 path using a v4 bearer token. Throws TmdbError (or the
// original AbortError when the request is cancelled) instead of returning junk.
export async function tmdbGet(path, { apiKey, signal } = {}) {
  let res;
  try {
    res = await fetch(`${TMDB_BASE}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json;charset=utf-8" },
      signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new TmdbError("network");
  }
  if (!res.ok) {
    throw new TmdbError(res.status === 401 ? "auth" : res.status === 429 ? "rate-limit" : "http", res.status);
  }
  return res.json();
}
