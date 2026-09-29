import { useEffect, useMemo, useState } from "react";
import { loadSeedResults, pickSeeds, rankCandidates } from "../lib/recommend.js";
import { ownedTitleKeys } from "../lib/library.js";
import { buildTasteProfile } from "../lib/taste.js";

// TMDb-backed picks based on the titles you loved, re-ranked for your learned
// taste and the chosen mood. Network work is keyed on which titles seed the
// list (not on every library edit) and cached for a day, so rating a film or
// switching moods doesn't refetch. status: "idle" | "loading" | "ready" | "error".
// Pass `profile` to reuse one you've already built; otherwise it's built here.
export function useHybridRecommendations(items, apiKey, { moodId = "all", profile: givenProfile = null } = {}) {
  const [resultsBySeed, setResultsBySeed] = useState({});
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const profile = useMemo(() => givenProfile || buildTasteProfile(items), [givenProfile, items]);
  const seeds = useMemo(() => pickSeeds(items, { profile }), [items, profile]);
  const seedKey = seeds.map((s) => s.id).join(",");
  const libraryIds = useMemo(() => (items || []).map((i) => i.id), [items]);
  const libraryKeys = useMemo(() => ownedTitleKeys(items), [items]);

  useEffect(() => {
    if (!apiKey || !seedKey) {
      setResultsBySeed({});
      setStatus("idle");
      setError(null);
      return;
    }
    const controller = new AbortController();
    const ids = seedKey.split(",").map(Number);
    setStatus("loading");
    setError(null);

    Promise.allSettled(ids.map((id) => loadSeedResults(id, { apiKey, signal: controller.signal }))).then((settled) => {
      if (controller.signal.aborted) return;
      const failures = settled.filter((s) => s.status === "rejected");
      if (failures.length === settled.length) {
        setResultsBySeed({});
        setError(failures[0].reason);
        setStatus("error");
        return;
      }
      // one bad seed (e.g. a 404 for an obscure title) shouldn't hide the rest
      setResultsBySeed(Object.fromEntries(ids.map((id, i) => [id, settled[i].status === "fulfilled" ? settled[i].value : []])));
      setStatus("ready");
    });
    return () => controller.abort();
  }, [seedKey, apiKey]);

  const similarPicks = useMemo(
    () => rankCandidates({ seeds, resultsBySeed, libraryIds, libraryKeys, profile, moodId }),
    [seeds, resultsBySeed, libraryIds, libraryKeys, profile, moodId]
  );

  return { similarPicks, status, error, seedTitles: seeds.map((s) => s.title), profile };
}
