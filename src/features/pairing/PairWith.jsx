import { useMemo, useState } from "react";
import { Clapperboard, Flame } from "lucide-react";
import { Button } from "../../components/ui/button.jsx";
import { useTasteProfile } from "../../lib/calibrationContext.js";
import { useContentPrefs } from "../../lib/contentContext.js";
import { pairLineup, pairSuggestions } from "../../lib/pairing.js";

const runtimeText = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;

// "Pair with…": companions from your library for a double feature, by contrast
// (a lighter palate cleanser), by wavelength (the same corner of horror) or by
// length (a quick one). One tap loads the pair into the marathon planner.
export function PairWith({ film, library, onPlan, onOpenDetails }) {
  const [open, setOpen] = useState(false);
  const profile = useTasteProfile(library);
  const prefs = useContentPrefs();
  const result = useMemo(() => (open ? pairSuggestions(film, library, { profile, prefs }) : null), [open, film, library, profile, prefs]);
  const nothing = result && result.groups.every((g) => !g.picks.length);

  return (
    <section aria-label="Pair with" className="w-full space-y-2">
      <Button size="sm" variant="outline" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Clapperboard className="mr-1 h-4 w-4" /> {open ? "Hide pairings" : "Pair with…"}
      </Button>

      {result ? (
        <div className="space-y-4 rounded-xl border p-3">
          <div className="text-xs opacity-70">
            Companions from your unwatched films, after {film.title} (scare {result.base.scare}/10{result.base.estimated ? ", est." : ""}, {runtimeText(result.base.runtime)}). Anything over your content limits is left out.
          </div>
          {result.groups.map(({ kind, picks, skipped }) =>
            picks.length || skipped ? (
              <div key={kind.id} className="space-y-1">
                <div className="text-sm font-semibold">{kind.label}</div>
                <div className="text-xs opacity-60">{kind.blurb}</div>
                {skipped ? <div className="text-sm opacity-70">{skipped}</div> : null}
                <ul className="space-y-2">
                  {picks.map((pick) => (
                    <li key={pick.item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted p-2">
                      <div className="min-w-[12rem] flex-1">
                        <button type="button" className="block max-w-full truncate text-left text-sm font-medium hover:underline" onClick={() => onOpenDetails?.(pick.item)}>
                          {pick.item.title}{pick.item.year ? <span className="opacity-60"> ({pick.item.year})</span> : null}
                        </button>
                        <div className="flex flex-wrap items-center gap-x-3 text-xs opacity-70">
                          <span className="flex items-center gap-1"><Flame className="h-3 w-3" /> {pick.scare}/10{pick.estimated ? " (est.)" : ""}</span>
                          <span>{runtimeText(pick.runtime)}</span>
                          <span>Night: {runtimeText(pick.totalMinutes)}</span>
                        </div>
                        <div className="text-xs opacity-70">{pick.reasons.join(" · ")}</div>
                      </div>
                      <Button size="sm" onClick={() => onPlan(pairLineup(film, pick))}>Plan this double feature</Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null
          )}
          {nothing ? <div className="text-sm opacity-70">Nothing in your library fits yet. Add more unwatched films, or loosen your limits.</div> : null}
        </div>
      ) : null}
    </section>
  );
}
