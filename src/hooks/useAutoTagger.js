import { useEffect, useMemo, useRef, useState } from "react";
import { analysisPatch, analyzeLocal, analyzeMeta, fetchFilmMeta } from "../lib/filmMeta.js";
import { isAbort } from "../lib/tmdb.js";

const DELAY_MS = 200; // be gentle with TMDb; the library fills in over a few seconds

// A film still needs analysis when TMDb knows it (numeric id) and it has never
// been analyzed. CSV-imported titles have text ids and are tagged locally.
export const needsTagging = (item) => typeof item.id === "number" && !item.taggedAt;

const sleep = (ms, signal) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });

const PROBLEMS = {
  auth: "Auto-tagging paused: TMDb rejected your API token.",
  "rate-limit": "Auto-tagging paused: TMDb is rate limiting requests. It will resume next time.",
  network: "Auto-tagging paused: couldn't reach TMDb.",
};

// Tags films in the background: fetches each untagged library film's metadata
// once, infers curated tags and content flags, and merges them in without
// touching anything you typed or removed. `enabled` follows the setting.
export function useAutoTagger({ library, upsert, apiKey, enabled, onProblem }) {
  const libraryRef = useRef(library);
  useEffect(() => {
    libraryRef.current = library;
  }, [library]);
  const onProblemRef = useRef(onProblem);
  useEffect(() => {
    onProblemRef.current = onProblem;
  }, [onProblem]);

  const pending = useMemo(() => library.filter(needsTagging).length, [library]);
  const [running, setRunning] = useState(false);
  const hasPending = pending > 0;

  useEffect(() => {
    if (!enabled || !apiKey || !hasPending) return;
    const controller = new AbortController();
    const { signal } = controller;
    const skipped = new Set(); // failed this session; retried next time

    (async () => {
      setRunning(true);
      try {
        while (!signal.aborted) {
          const next = libraryRef.current.find((i) => needsTagging(i) && !skipped.has(i.id));
          if (!next) break;
          let analysis;
          try {
            analysis = analyzeMeta(await fetchFilmMeta(next.id, { apiKey, signal }));
          } catch (err) {
            if (isAbort(err)) return;
            if (err.status === 404) {
              analysis = analyzeLocal(next); // TMDb has no record: tag from what we have and move on
            } else if (PROBLEMS[err.kind]) {
              onProblemRef.current?.(PROBLEMS[err.kind]);
              return;
            } else {
              skipped.add(next.id);
              continue;
            }
          }
          if (signal.aborted) return;
          // apply to the latest copy: you may have edited tags while this was loading
          const latest = libraryRef.current.find((i) => i.id === next.id);
          if (latest) upsert({ id: latest.id, ...analysisPatch(latest, analysis) });
          await sleep(DELAY_MS, signal);
        }
      } finally {
        setRunning(false);
      }
    })();
    return () => controller.abort();
  }, [enabled, apiKey, hasPending, upsert]);

  return { pending, running: running && enabled && !!apiKey };
}
