import { useMemo, useState } from "react";
import { Clapperboard, Flame, RefreshCw } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Slider } from "../../components/ui/slider.jsx";
import { ContentWarnings } from "../../components/ContentWarnings.jsx";
import { MOOD_PRESETS } from "../../lib/moods.js";
import { useContentPrefs } from "../../lib/contentContext.js";
import { useTasteProfile } from "../../lib/calibrationContext.js";
import { drawMystery, mysteryClue, mysteryPool } from "../../lib/mystery.js";
import { defaultScare, scareWord } from "../../lib/tonight.js";
import { TMDB_IMG } from "../../lib/tmdb.js";

// A blind pick: choose the vibe and how scary, and get a film described only by its
// length, intensity, subgenres and warnings. The title and poster stay hidden until you
// press Reveal. Films over your content limits are never drawn.
export function MysteryReel({ library, onOpenDetails, onGo }) {
  const prefs = useContentPrefs();
  const profile = useTasteProfile(library);
  const watchlist = useMemo(() => library.filter((i) => i.watchlist), [library]);
  const [source, setSource] = useState(() => (watchlist.length ? "watchlist" : "library"));
  const [dialsOpen, setDialsOpen] = useState(false);
  const [scareChoice, setScareChoice] = useState(null);
  const [moodId, setMoodId] = useState("all");
  const [skipped, setSkipped] = useState([]);
  const [drawn, setDrawn] = useState(null); // { item, reasons, fit }
  const [revealed, setRevealed] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  const scare = scareChoice ?? defaultScare(profile, prefs);
  const pool = source === "watchlist" ? watchlist : library;
  const available = useMemo(() => mysteryPool(pool, { prefs }).length, [pool, prefs]);

  const draw = (skip = skipped) => {
    const result = drawMystery(pool, profile, { scare, moodId, prefs, skipped: skip });
    setExhausted(!result);
    setDrawn(result);
    setRevealed(false);
  };
  const drawAnother = () => {
    const next = drawn ? [...skipped, drawn.item.id] : skipped;
    setSkipped(next);
    draw(next);
  };
  const startOver = () => {
    setSkipped([]);
    draw([]);
  };
  const changeSource = (value) => {
    setSource(value);
    setSkipped([]);
    setDrawn(null);
    setExhausted(false);
  };

  const clue = drawn ? mysteryClue(drawn.item, { bias: profile.scareBias || 0 }) : null;
  const moodLabel = MOOD_PRESETS.find((m) => m.id === moodId)?.label || "All vibes";
  const poster = revealed && drawn?.item.poster ? TMDB_IMG(drawn.item.poster, "w342") : "";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold"><Clapperboard className="h-5 w-5" /> Mystery reel</h2>
        <p className="text-sm opacity-70">A blind pick. You'll see how long it is, how intense, what kind of horror and any content warnings, but not the title until you reveal it.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-2">
          Draw from
          <select className="rounded border bg-transparent px-2 py-1" value={source} onChange={(e) => changeSource(e.target.value)}>
            <option value="watchlist" className="text-black">My watchlist ({watchlist.length})</option>
            <option value="library" className="text-black">Whole library ({library.length})</option>
          </select>
        </label>
        <span className="opacity-80">Scare {scare}/10 · {scareWord(scare)} · {moodLabel}</span>
        <Button size="sm" variant="outline" aria-expanded={dialsOpen} aria-controls="mystery-dials" onClick={() => setDialsOpen(!dialsOpen)}>{dialsOpen ? "Done" : "Change"}</Button>
      </div>

      {dialsOpen ? (
        <Card id="mystery-dials" className="rounded-2xl">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm">How scared?</span>
              <Slider aria-label="How scared do you want to be?" value={[scare]} min={0} max={10} step={1} onValueChange={(v) => setScareChoice(v[0])} className="max-w-xs" />
              <span className="tabular-nums text-sm">{scare}</span>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Vibe">
              {MOOD_PRESETS.map((m) => (
                <Button key={m.id} size="sm" variant={moodId === m.id ? "default" : "outline"} onClick={() => setMoodId(m.id)}>{m.label}</Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!drawn && !exhausted ? (
        available ? (
          <Card className="rounded-2xl">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <div aria-hidden="true" className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/5 text-5xl">?</div>
              <div className="text-sm opacity-80">{available} film{available === 1 ? "" : "s"} to draw from, all inside your limits.</div>
              <Button onClick={() => draw()}>Draw a mystery film</Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl">
            <CardContent className="space-y-3 p-5 text-sm">
              <div>{source === "watchlist" ? "Nothing to draw: your watchlist is empty, or everything on it is over your limits or already watched." : "Nothing to draw: everything in your library is watched, unreleased or over your limits."}</div>
              <div className="flex flex-wrap gap-2">
                {source === "watchlist" && library.length ? <Button onClick={() => changeSource("library")}>Draw from my whole library</Button> : null}
                <Button variant="outline" onClick={() => onGo("discover")}>Find films to add</Button>
              </div>
            </CardContent>
          </Card>
        )
      ) : null}

      {exhausted ? (
        <Card className="rounded-2xl">
          <CardContent className="space-y-3 p-5 text-sm">
            <div>That's every film that fits. Change the vibe or scare level, or start over.</div>
            <Button onClick={startOver}>Start over</Button>
          </CardContent>
        </Card>
      ) : null}

      {drawn ? (
        <Card className="overflow-hidden rounded-2xl border-red-500/40">
          <CardContent className="space-y-3 p-4">
            <div className="flex gap-4">
              {poster ? (
                <img src={poster} alt="" className="h-48 w-32 shrink-0 rounded-lg object-cover sm:h-60 sm:w-40" />
              ) : (
                <div aria-hidden="true" className="flex h-48 w-32 shrink-0 items-center justify-center rounded-lg bg-white/5 text-5xl sm:h-60 sm:w-40">{revealed ? "🎬" : "?"}</div>
              )}
              <div className="min-w-0 flex-1 space-y-2" aria-live="polite">
                <div className="text-xs uppercase tracking-wide opacity-70">{revealed ? "Revealed" : "Mystery film"}</div>
                {revealed ? (
                  <h3 className="text-2xl font-semibold leading-tight">{drawn.item.title}{drawn.item.year ? <span className="text-base font-normal opacity-60"> ({drawn.item.year})</span> : null}</h3>
                ) : (
                  <h3 className="text-xl font-semibold leading-tight">{clue.line}</h3>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm opacity-80">
                  <span>{clue.runtimeText}</span>
                  <span className="flex items-center gap-1"><Flame className="h-4 w-4" /> {clue.intensity}, {clue.scare}/10{clue.estimated ? " (est.)" : ""}</span>
                </div>
                <ContentWarnings flags={clue.flags} avoid={prefs.avoidFlags} showFlags />
                {!clue.flags.length ? <div className="text-xs opacity-60">No content warnings on record (warnings come from TMDb keywords, so that isn't a guarantee).</div> : null}
                {!drawn.fit ? <div className="text-xs text-amber-300">Nothing matches your vibe exactly, so this is the closest.</div> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!revealed ? (
                <Button onClick={() => setRevealed(true)}>Reveal it</Button>
              ) : (
                <Button onClick={() => onOpenDetails(drawn.item)}>Open its page</Button>
              )}
              <Button variant="outline" onClick={drawAnother}><RefreshCw className="mr-1 h-4 w-4" /> Draw another</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
