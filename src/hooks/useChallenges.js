import { useCallback, useEffect, useRef, useState } from "react";
import { createChallenge, evaluateChallenge, loadChallenges, mergeChallenges, saveChallenges } from "../lib/challenges.js";

// Your challenges, persisted. Progress is never stored: it's derived from the
// library's watch dates. The one thing remembered is when a challenge was
// completed, so the celebration fires once.
export function useChallenges({ library, onComplete } = {}) {
  const [challenges, setChallenges] = useState(loadChallenges);
  useEffect(() => {
    saveChallenges(challenges);
  }, [challenges]);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const start = useCallback((templateId) => {
    const challenge = createChallenge(templateId);
    if (!challenge) return null;
    setChallenges((prev) => (prev.some((c) => c.id === challenge.id) ? prev : [challenge, ...prev]));
    return challenge;
  }, []);

  const remove = useCallback((id) => setChallenges((prev) => prev.filter((c) => c.id !== id)), []);

  // returns how many were new
  const merge = useCallback(
    (incoming) => {
      const { challenges: next, added } = mergeChallenges(challenges, incoming);
      if (added) setChallenges(next);
      return added;
    },
    [challenges]
  );

  // notice challenges that just crossed the line
  useEffect(() => {
    if (!library) return;
    const now = new Date();
    const finished = [];
    for (const c of challenges) {
      if (c.completedAt) continue;
      const result = evaluateChallenge(c, library, now);
      if (result.status === "completed") finished.push({ challenge: c, completedOn: result.completedOn });
    }
    if (!finished.length) return;
    setChallenges((prev) => prev.map((c) => finished.find((f) => f.challenge.id === c.id) ? { ...c, completedAt: finished.find((f) => f.challenge.id === c.id).completedOn } : c));
    finished.forEach((f) => onCompleteRef.current?.(f.challenge));
  }, [challenges, library]);

  return { challenges, start, remove, merge };
}
