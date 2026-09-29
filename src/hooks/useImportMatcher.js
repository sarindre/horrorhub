import { useEffect, useMemo, useRef, useState } from "react";
import { findTmdbMatch, needsMatching } from "../lib/tmdbMatch.js";
import { isAbort } from "../lib/tmdb.js";

const DELAY_MS = 250; // gentle on TMDb; a big import fills in over a minute or two

const sleep = (ms, signal) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });

const PROBLEMS = {
  auth: "Matching imported films paused: TMDb rejected your API token.",
  "rate-limit": "Matching imported films paused: TMDb is rate limiting requests. It will resume next time.",
  network: "Matching imported films paused: couldn't reach TMDb.",
};

// Links films imported from Letterboxd/IMDb to their TMDb records in the
// background, one at a time. A confident match swaps in the real id and
// metadata (see relinkItem); anything else is marked as tried so it isn't
// retried every session, and can be matched by hand in Settings.
export function useImportMatcher({ library, upsert, relink, apiKey, enabled, onProblem, onDone }) {
  const libraryRef = useRef(library);
  useEffect(() => {
    libraryRef.current = library;
  }, [library]);
  const callbacks = useRef({ onProblem, onDone });
  useEffect(() => {
    callbacks.current = { onProblem, onDone };
  }, [onProblem, onDone]);

  const pending = useMemo(() => library.filter(needsMatching).length, [library]);
  const [running, setRunning] = useState(false);
  const hasPending = pending > 0;

  useEffect(() => {
    if (!enabled || !apiKey || !hasPending) return;
    const controller = new AbortController();
    const { signal } = controller;
    const skipped = new Set(); // failed this session for a non-fatal reason; retried next time
    let matched = 0;
    let failed = 0;

    (async () => {
      setRunning(true);
      try {
        while (!signal.aborted) {
          const next = libraryRef.current.find((i) => needsMatching(i) && !skipped.has(i.id));
          if (!next) break;
          try {
            const movie = await findTmdbMatch(next, { apiKey, signal });
            if (signal.aborted) return;
            if (movie) {
              relink(next.id, movie);
              matched++;
            } else {
              upsert({ id: next.id, tmdbMatchTriedAt: new Date().toISOString() });
              failed++;
            }
          } catch (err) {
            if (isAbort(err)) return;
            if (PROBLEMS[err.kind]) {
              callbacks.current.onProblem?.(PROBLEMS[err.kind]);
              return;
            }
            skipped.add(next.id);
            continue;
          }
          // The library state updates after this loop iteration, so count what's left
          // ourselves. When nothing is left, report now: the effect is about to be
          // torn down (nothing pending) and would cancel a later report.
          const remaining = libraryRef.current.filter((i) => needsMatching(i) && i.id !== next.id && !skipped.has(i.id)).length;
          if (!remaining) {
            callbacks.current.onDone?.({ matched, failed });
            return;
          }
          await sleep(DELAY_MS, signal);
        }
      } finally {
        setRunning(false);
      }
    })();
    return () => controller.abort();
  }, [enabled, apiKey, hasPending, upsert, relink]);

  return { pending, running: running && enabled && !!apiKey };
}
