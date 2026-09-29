import { useCallback, useEffect, useState } from "react";
import { loadLibrary, normalizeItem, saveLibrary } from "../lib/library.js";
import { relinkItem } from "../lib/tmdbMatch.js";

// The library and the ways to change it. The callbacks are stable (they only
// use functional updates), so effects that depend on them don't restart on
// every render.
export function useLibrary() {
  const [library, setLibrary] = useState(loadLibrary);
  const [saveFailed, setSaveFailed] = useState(false);
  useEffect(() => {
    setSaveFailed(!saveLibrary(library));
  }, [library]);

  const upsert = useCallback(
    (item) =>
      setLibrary((prev) => {
        const i = prev.findIndex((x) => x.id === item.id);
        if (i >= 0) {
          const merged = normalizeItem({ ...prev[i], ...item });
          if (!merged) return prev;
          const next = [...prev];
          next[i] = merged;
          return next;
        }
        const fresh = normalizeItem({ ...item, addedAt: new Date().toISOString() });
        return fresh ? [fresh, ...prev] : prev;
      }),
    []
  );
  const remove = useCallback((id) => setLibrary((prev) => prev.filter((x) => x.id !== id)), []);
  // point an imported film at its TMDb record (merging if you already have that film)
  const relink = useCallback((oldId, movie) => setLibrary((prev) => relinkItem(prev, oldId, movie).library), []);

  return { library, upsert, remove, relink, replaceLibrary: setLibrary, saveFailed };
}
