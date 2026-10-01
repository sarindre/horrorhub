import { useEffect, useMemo, useState } from "react";
import { Moon, RefreshCw, Ban, Flame } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Slider } from "../../components/ui/slider.jsx";
import { ContentWarnings } from "../../components/ContentWarnings.jsx";
import { HiddenNotice } from "../../components/HiddenNotice.jsx";
import { CalibrationQuiz } from "./CalibrationQuiz.jsx";
import { PairWith } from "../pairing/PairWith.jsx";
import { MOOD_PRESETS } from "../../lib/moods.js";
import { buildTasteProfile, isLearning } from "../../lib/taste.js";
import { isCalibrated } from "../../lib/calibration.js";
import { scareOf } from "../../lib/scare.js";
import { evaluateItem, itemFlags } from "../../lib/contentFlags.js";
import { useContentPrefs } from "../../lib/contentContext.js";
import { defaultScare, inProgress, scareWord, tonightPicks } from "../../lib/tonight.js";
import { usePersistentState } from "../../lib/usePersistentState.js";
import { TMDB_IMG } from "../../lib/tmdb.js";

// The landing screen: one film for tonight, why, and whether it fits your limits.
// The scare and vibe dials sit behind one line; the deeper tools live under "Tune".
export function Tonight({ library, calibration, mixer, challenges, onSaveCalibration, onOpenDetails, onGo, onPlanPair, startQuiz = false, onQuizStarted }) {
  const contentPrefs = useContentPrefs();
  const [quizOpen, setQuizOpen] = useState(false);
  // asked to open the quiz from elsewhere (the getting-started guide)
  useEffect(() => {
    if (!startQuiz) return;
    setQuizOpen(true);
    onQuizStarted?.();
  }, [startQuiz, onQuizStarted]);
  const [dialsOpen, setDialsOpen] = useState(false);
  const [scareChoice, setScareChoice] = useState(null);
  const [moodId, setMoodId] = useState("all");
  const [skipped, setSkipped] = useState([]);
  const [focusId, setFocusId] = useState(null);
  const [revealHidden, setRevealHidden] = useState(false);
  const [passed, setPassed] = usePersistentState("tonight.passed", []);

  const profile = useMemo(() => buildTasteProfile(library, { calibration }), [library, calibration]);
  const scare = scareChoice ?? defaultScare(profile, contentPrefs);
  const { picks, hiddenCount } = useMemo(
    () => tonightPicks(library, profile, { scare, moodId, mixer, passed: passed || [], skipped, prefs: revealHidden ? { ...contentPrefs, contentMode: "warn" } : contentPrefs }),
    [library, profile, scare, moodId, mixer, passed, skipped, contentPrefs, revealHidden]
  );
  const lines = useMemo(() => inProgress(library, challenges), [library, challenges]);

  const current = picks.find((p) => p.item.id === focusId) || picks[0];
  const others = picks.filter((p) => p !== current).slice(0, 3);
  const moodLabel = MOOD_PRESETS.find((m) => m.id === moodId)?.label || "All vibes";
  const showQuizCard = !isCalibrated(calibration) && isLearning(profile);

  if (quizOpen) {
    return (
      <div className="mx-auto max-w-3xl">
        <CalibrationQuiz
          initialAnswers={calibration?.answers}
          onSave={(c) => { onSaveCalibration(c); setQuizOpen(false); setScareChoice(null); }}
          onCancel={() => setQuizOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {showQuizCard ? (
        <Card className="rounded-2xl border-red-500/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="font-semibold">Get better picks in 60 seconds</div>
              <div className="text-sm opacity-70">Answer a dozen quick questions about famous horror films. It teaches HorrorHub your taste and how scary is too scary.</div>
            </div>
            <Button onClick={() => setQuizOpen(true)}>Take the taste quiz</Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><Moon className="h-5 w-5" /> Tonight</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="opacity-80">Scare {scare}/10 · {scareWord(scare)} · {moodLabel}</span>
          <Button size="sm" variant="outline" aria-expanded={dialsOpen} aria-controls="tonight-dials" onClick={() => setDialsOpen(!dialsOpen)}>
            {dialsOpen ? "Done" : "Change"}
          </Button>
        </div>
      </div>

      {dialsOpen ? (
        <Card id="tonight-dials" className="rounded-2xl">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm">How scared tonight?</span>
              <Slider aria-label="How scared do you want to be tonight?" value={[scare]} min={0} max={10} step={1} onValueChange={(v) => setScareChoice(v[0])} className="max-w-xs" />
              <span className="tabular-nums text-sm">{scare}</span>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Night vibe">
              {MOOD_PRESETS.map((m) => (
                <Button key={m.id} size="sm" variant={moodId === m.id ? "default" : "outline"} onClick={() => setMoodId(m.id)}>{m.label}</Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {current ? (
        <PickCard
          pick={current}
          profile={profile}
          prefs={contentPrefs}
          onOpen={() => onOpenDetails(current.item)}
          onAnother={() => { setSkipped([...skipped, current.item.id]); setFocusId(null); }}
          onNever={() => { setPassed([...(passed || []), current.item.id]); setFocusId(null); }}
          canReroll={picks.length > 1}
          library={library}
          onPlanPair={onPlanPair}
          onOpenFilm={onOpenDetails}
        />
      ) : (
        <EmptyState
          libraryCount={library.length}
          hiddenCount={hiddenCount}
          skipped={skipped.length}
          passed={(passed || []).length}
          onGo={onGo}
          onReveal={() => setRevealHidden(true)}
          onResetSkipped={() => setSkipped([])}
          onResetPassed={() => setPassed([])}
        />
      )}

      {others.length ? (
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide opacity-70">Or one of these</div>
          <ul className="space-y-1">
            {others.map((p) => (
              <li key={p.item.id}>
                <button type="button" className="w-full min-w-0 rounded-lg border px-3 py-2 text-left text-sm hover:bg-white/5" onClick={() => setFocusId(p.item.id)}>
                  <span className="font-medium">{p.item.title}</span>
                  {p.item.year ? <span className="opacity-60"> ({p.item.year})</span> : null}
                  <span className="block truncate text-xs opacity-60">{p.reasons[0]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {current && hiddenCount ? <HiddenNotice count={hiddenCount} onReveal={() => setRevealHidden(true)} /> : null}

      {lines.length ? (
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide opacity-70">In progress</div>
          <ul className="flex flex-wrap gap-2">
            {lines.map((l) => (
              <li key={l.id}><Button size="sm" variant="outline" onClick={() => onGo(l.tab)}>{l.text}</Button></li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t pt-4 text-sm opacity-80">
        <Button size="sm" variant="ghost" onClick={() => onGo("recs")}>Tune your picks</Button>
        <Button size="sm" variant="ghost" onClick={() => onGo("discover")}>Find something new</Button>
        {isCalibrated(calibration) ? <Button size="sm" variant="ghost" onClick={() => setQuizOpen(true)}>Retake taste quiz</Button> : null}
      </div>
    </div>
  );
}

function PickCard({ pick, profile, prefs, onOpen, onAnother, onNever, canReroll, library, onPlanPair, onOpenFilm }) {
  const { item, reasons } = pick;
  const flags = itemFlags(item);
  const verdict = evaluateItem(item, prefs);
  const scare = scareOf(item, { bias: profile.scareBias || 0 });
  const poster = item.poster ? TMDB_IMG(item.poster, "w342") : "";
  return (
    <Card className="overflow-hidden rounded-2xl">
      <CardContent className="space-y-3 p-4">
       <div className="flex gap-4">
        {poster ? (
          <img src={poster} alt="" className="h-48 w-32 shrink-0 rounded-lg object-cover sm:h-60 sm:w-40" />
        ) : (
          <div aria-hidden="true" className="flex h-48 w-32 shrink-0 items-center justify-center rounded-lg bg-white/5 text-3xl sm:h-60 sm:w-40">🎬</div>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="text-xs uppercase tracking-wide opacity-70">Tonight's pick</div>
          <h3 className="text-2xl font-semibold leading-tight">{item.title}{item.year ? <span className="text-base font-normal opacity-60"> ({item.year})</span> : null}</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm opacity-80">
            <span className="flex items-center gap-1"><Flame className="h-4 w-4" /> Scare {scare.value}/10{scare.estimated ? " (est.)" : ""}</span>
            {item.runtime ? <span>{Math.floor(item.runtime / 60)}h {item.runtime % 60}m</span> : null}
          </div>
          <ul className="space-y-0.5 text-sm">
            {reasons.map((r) => <li key={r}>• {r}</li>)}
          </ul>
          <ContentWarnings flags={flags} avoid={prefs.avoidFlags} reasons={verdict.blocked ? verdict.reasons : []} showFlags={prefs.showWarnings} />
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={onOpen}>Let's watch it</Button>
            <Button variant="outline" onClick={onAnother} disabled={!canReroll}><RefreshCw className="mr-1 h-4 w-4" /> Another</Button>
            <Button variant="ghost" onClick={onNever} title="Never suggest this film again"><Ban className="mr-1 h-4 w-4" /> Not for me</Button>
          </div>
        </div>
       </div>
       {onPlanPair ? <PairWith film={item} library={library} onPlan={onPlanPair} onOpenDetails={onOpenFilm} /> : null}
      </CardContent>
    </Card>
  );
}

function EmptyState({ libraryCount, hiddenCount, skipped, passed, onGo, onReveal, onResetSkipped, onResetPassed }) {
  let body;
  if (!libraryCount) {
    body = (
      <>
        <div>Your library is empty. Add a few films you've seen or want to see, and Tonight will pick from them.</div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onGo("discover")}>Browse films</Button>
          <Button variant="outline" onClick={() => onGo("settings")}>Import from Letterboxd or IMDb</Button>
        </div>
      </>
    );
  } else if (hiddenCount) {
    body = (
      <>
        <div>Everything left is over your content limits.</div>
        <Button variant="outline" onClick={onReveal}>Show {hiddenCount} hidden film{hiddenCount === 1 ? "" : "s"}</Button>
      </>
    );
  } else if (skipped || passed) {
    body = (
      <>
        <div>You've been through every suggestion.</div>
        <div className="flex flex-wrap gap-2">
          {skipped ? <Button variant="outline" onClick={onResetSkipped}>Start over</Button> : null}
          {passed ? <Button variant="ghost" onClick={onResetPassed}>Bring back films I said no to ({passed})</Button> : null}
        </div>
      </>
    );
  } else {
    body = (
      <>
        <div>Nothing left to suggest from your library. Add films to your watchlist to fill it up.</div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onGo("recs")}>See suggestions from TMDb</Button>
          <Button variant="outline" onClick={() => onGo("discover")}>Browse films</Button>
        </div>
      </>
    );
  }
  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-3 p-5 text-sm">{body}</CardContent>
    </Card>
  );
}
