import { useEffect, useState } from "react";
import { fetchFilmMeta } from "../lib/filmMeta.js";
import { inferFlags, itemFlags } from "../lib/contentFlags.js";
import { isAbort } from "../lib/tmdb.js";

// Content flags for a list of films, by id. Films already analyzed in your
// library use what's stored; anything else (Discover results, TMDb picks) is
// looked up once (one request each, remembered for the session). Only runs
// when `enabled`, i.e. when warnings are shown or you've set limits.
const sessionFlags = new Map(); // id -> flags

export function useContentFlags(films, apiKey, enabled) {
  const [map, setMap] = useState({});
  const key = (films || []).map((f) => f.id).join(",");

  useEffect(() => {
    if (!enabled || !key) return;
    const controller = new AbortController();
    const list = films || [];
    const lookup = list.filter((f) => !f.taggedAt && typeof f.id === "number" && apiKey && !sessionFlags.has(f.id));

    const build = () =>
      Object.fromEntries(list.map((f) => [f.id, f.taggedAt ? itemFlags(f) : sessionFlags.get(f.id) ?? itemFlags(f)]));
    setMap(build()); // show what's already known right away

    if (!lookup.length) return;
    Promise.all(
      lookup.map((f) =>
        fetchFilmMeta(f.id, { apiKey, signal: controller.signal })
          .then((meta) => sessionFlags.set(f.id, inferFlags(meta)))
          .catch((err) => {
            if (!isAbort(err)) console.warn("Content lookup failed for", f.id, err.message);
          })
      )
    ).then(() => {
      if (!controller.signal.aborted) setMap(build());
    });
    return () => controller.abort();
    // `films` is represented by its id list; re-running on every new array identity would refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, apiKey, enabled]);

  return map;
}
