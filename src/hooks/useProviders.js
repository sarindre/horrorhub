import { useEffect, useState } from "react";
import { isAbort, parseProviders, tmdbGet } from "../lib/tmdb.js";

// Streaming-service slugs per film id, for the "Available on" filter and badges.
// Successful lookups are remembered for the session; failures aren't, so a
// rate limit doesn't permanently mark a film as "not streaming anywhere".
// Returns { map, loading, failed, retry }: `failed` is how many films couldn't be
// checked, so the screen can say so instead of quietly hiding them.
const sessionCache = new Map();

export function useProviders(ids, apiKey, enabled, region = "US") {
  const [map, setMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const key = (ids || []).join(",");

  useEffect(() => {
    if (!enabled || !apiKey || !key) {
      setLoading(false);
      setFailed(0);
      return;
    }
    const controller = new AbortController();
    const wanted = key.split(",");
    const cacheKey = (id) => `${region}:${id}`;
    const pending = wanted.filter((id) => !sessionCache.has(cacheKey(id)));
    setLoading(pending.length > 0);

    Promise.all(
      pending.map((id) =>
        tmdbGet(`/movie/${id}/watch/providers`, { apiKey, signal: controller.signal })
          .then((data) => sessionCache.set(cacheKey(id), parseProviders(data, region)))
          .catch((err) => {
            if (!isAbort(err)) console.warn("Provider lookup failed for", id, err.message);
          })
      )
    ).then(() => {
      if (controller.signal.aborted) return;
      setLoading(false);
      setFailed(wanted.filter((id) => !sessionCache.has(cacheKey(id))).length);
      setMap(Object.fromEntries(wanted.map((id) => [id, sessionCache.get(cacheKey(id)) || []])));
    });
    return () => controller.abort();
  }, [key, apiKey, enabled, region, attempt]);

  return { map, loading, failed, retry: () => setAttempt((n) => n + 1) };
}
