import { useCallback, useEffect, useState } from "react";
import { loadMarathons, mergeMarathons, normalizeMarathon, saveMarathons } from "../lib/marathon.js";

// Saved marathon plans, persisted locally.
export function useMarathons() {
  const [marathons, setMarathons] = useState(loadMarathons);
  useEffect(() => {
    saveMarathons(marathons);
  }, [marathons]);

  const save = useCallback((plan) => {
    const normalized = normalizeMarathon(plan);
    if (!normalized) return null;
    setMarathons((prev) => [normalized, ...prev.filter((m) => m.id !== normalized.id)]);
    return normalized;
  }, []);

  const remove = useCallback((id) => setMarathons((prev) => prev.filter((m) => m.id !== id)), []);

  // returns how many were new
  const merge = useCallback(
    (incoming) => {
      const { marathons: next, added } = mergeMarathons(marathons, incoming);
      if (added) setMarathons(next);
      return added;
    },
    [marathons]
  );

  return { marathons, save, remove, merge };
}
