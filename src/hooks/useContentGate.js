import { useMemo, useState } from "react";
import { useContentFlags } from "./useContentFlags.js";
import { useContentPrefs } from "../lib/contentContext.js";
import { evaluateContent, hasContentLimits } from "../lib/contentFlags.js";

// Applies your content limits to a list of TMDb films (Discover results, Rating
// Roulette, suggestions). Looks up warnings only when they'd be shown or a
// limit is set. In "hide" mode, films over your limits are removed until you
// choose to reveal them; in "warn" mode everything stays and cards carry the
// warning. `flagsById` feeds each card's warning chips.
export function useContentGate(films, apiKey) {
  const prefs = useContentPrefs();
  const active = prefs.showWarnings || hasContentLimits(prefs);
  const flagsById = useContentFlags(films, apiKey, active);
  const [revealed, setRevealed] = useState(false);

  const verdictFor = (film) =>
    evaluateContent({ flags: flagsById[film.id] || [], scares: typeof film.scares === "number" ? film.scares : undefined }, prefs);

  const hiding = prefs.contentMode === "hide" && !revealed && hasContentLimits(prefs);
  const visible = useMemo(
    () => (hiding ? films.filter((f) => !verdictFor(f).blocked) : films),
    // verdictFor closes over flagsById and prefs, which are listed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [films, hiding, flagsById, prefs]
  );

  return {
    flagsById,
    visible,
    hiddenCount: films.length - visible.length,
    reveal: () => setRevealed(true),
    reasonsFor: (film) => verdictFor(film).reasons,
  };
}
