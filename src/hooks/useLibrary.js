import { useEffect, useState } from "react";
import { loadLibrary, normalizeItem, saveLibrary } from "../lib/library.js";

export function useLibrary() {
  const [library, setLibrary] = useState(loadLibrary);
  const [saveFailed, setSaveFailed] = useState(false);
  useEffect(() => {
    setSaveFailed(!saveLibrary(library));
  }, [library]);

  const upsert = (item) =>
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
    });
  const remove = (id) => setLibrary((prev) => prev.filter((x) => x.id !== id));

  return { library, upsert, remove, replaceLibrary: setLibrary, saveFailed };
}
