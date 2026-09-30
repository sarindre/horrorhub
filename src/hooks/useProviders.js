import { useEffect, useState } from "react";
import { isAbort, parseProviders, tmdbGet } from "../lib/tmdb.js";

// Streaming-service slugs per film id, for the "Available on" filter and badges.
// Successful lookups are remembered for the session; failures aren't, so a
// rate limit doesn't permanently mark a film as "not streaming anywhere".
const sessionCache = new Map();

export function useProviders(ids, apiKey, enabled, region = "US") {
  const [map, setMap] = useState({});
  const key = (ids || []).join(",");

  useEffect(() => {
    if (!enabled || !apiKey || !key) return;
    const controller = new AbortController();
    const wanted = key.split(",");
    const cacheKey = (id) => `${region}:${id}`;
    const pending = wanted.filter((id) => !sessionCache.has(cacheKey(id)));

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
      setMap(Object.fromEntries(wanted.map((id) => [id, sessionCache.get(cacheKey(id)) || []])));
    });
    return () => controller.abort();
  }, [key, apiKey, enabled, region]);

  return map;
}
