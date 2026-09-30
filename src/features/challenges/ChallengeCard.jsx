import { useState } from "react";
import { Flame } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { ContentWarnings } from "../../components/ContentWarnings.jsx";
import { HiddenNotice } from "../../components/HiddenNotice.jsx";
import { useContentGate } from "../../hooks/useContentGate.js";
import { useToast } from "../../lib/toastContext.js";
import { useContentPrefs } from "../../lib/contentContext.js";
import { addDays, dayKey, daysBetween, pacePhrase, parseDay, suggestForChallenge } from "../../lib/challenges.js";
import { ChallengePlan } from "./ChallengePlan.jsx";
import { fetchChallengeIdeas } from "../../lib/challengeIdeas.js";
import { TMDB_IMG, describeError, isAbort } from "../../lib/tmdb.js";

const fmt = (key) => parseDay(key).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const STATUS_LABEL = {
  active: "In progress",
  upcoming: "Not started",
  completed: "Completed 🎉",
  expired: "Ended",
};

function DayStrip({ challenge, result }) {
  const watched = new Set(result.matched.map((m) => m.day));
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const days = Array.from({ length: challenge.target }, (_, i) => addDays(challenge.startDate, i));
  return (
    <div className="flex flex-wrap gap-1" aria-label="Days in this challenge">
      {days.map((d, i) => (
        <span
          key={d}
          title={`${fmt(d)}${watched.has(d) ? " ✓" : ""}`}
          className={`h-4 w-4 rounded-sm text-[9px] leading-4 text-center ${
            watched.has(d) ? "bg-red-600 text-white" : d > todayKey ? "bg-white/5 opacity-50" : "bg-white/10"
          } ${d === todayKey ? "ring-1 ring-red-400" : ""}`}
        >
          {i + 1}
        </span>
      ))}
    </div>
  );
}

const SHOWN_AT_FIRST = 3;

// Ideas from TMDb are their own component so the content gate (hook) can run on
// them. Compact rows: a poster thumbnail, the title and two buttons.
function Ideas({ ideas, apiKey, onAdd, onOpenDetails }) {
  const gate = useContentGate(ideas, apiKey);
  const prefs = useContentPrefs();
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? gate.visible : gate.visible.slice(0, SHOWN_AT_FIRST);
  return (
    <div className="space-y-2">
      <HiddenNotice count={gate.hiddenCount} onReveal={gate.reveal} />
      <ul className="space-y-2">
        {rows.map((m) => {
          const poster = m.poster ? TMDB_IMG(m.poster, "w92") : "";
          return (
            <li key={m.id} className="flex items-center gap-3">
              {poster ? <img src={poster} alt="" className="h-14 w-10 shrink-0 rounded object-cover" /> : <div aria-hidden="true" className="h-14 w-10 shrink-0 rounded bg-white/5" />}
              <div className="min-w-0 flex-1">
                <button type="button" className="block max-w-full truncate text-left text-sm font-medium hover:underline" onClick={() => onOpenDetails?.(m)}>{m.title}</button>
                <div className="text-xs opacity-60">{[m.year, m.voteAvg ? `TMDb ${m.voteAvg.toFixed(1)}` : ""].filter(Boolean).join(" · ")}</div>
                <ContentWarnings flags={gate.flagsById[m.id] || []} avoid={prefs.avoidFlags} showFlags={prefs.showWarnings} />
              </div>
              <Button size="sm" variant="outline" className="shrink-0 whitespace-nowrap" onClick={() => onAdd?.({ ...m, watchlist: true })}>+ Watchlist</Button>
            </li>
          );
        })}
      </ul>
      {gate.visible.length > SHOWN_AT_FIRST ? (
        <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer" : `Show all ${gate.visible.length}`}</Button>
      ) : null}
    </div>
  );
}

export function ChallengeCard({ challenge, result, library, profile, apiKey, planTime, onUpdate, onAdd, onOpenDetails, onRemove, onSetPlan, onStartNow }) {
  const toast = useToast();
  const prefs = useContentPrefs();
  const [picks, setPicks] = useState(null);
  const [showAllPicks, setShowAllPicks] = useState(false);
  const [ideas, setIdeas] = useState(null);
  const [loadingIdeas, setLoadingIdeas] = useState(false);

  const live = result.status === "active" || result.status === "upcoming";
  const pace = result.status === "active" ? pacePhrase(result.remaining, result.daysLeft) : "";

  const buildList = () => {
    const list = suggestForChallenge(challenge, library, { profile, prefs });
    setPicks(list);
    if (!list.length) toast("No unwatched films in your library count toward this yet. Try the TMDb ideas.");
  };
  const addAll = () => {
    picks.forEach((p) => onUpdate?.({ ...p.item, watchlist: true }));
    toast(`Added ${picks.length} film${picks.length === 1 ? "" : "s"} to your watchlist.`, { kind: "success" });
  };
  const findIdeas = async () => {
    if (!apiKey) return toast("Add your TMDb API token in Settings first.", { kind: "error" });
    setLoadingIdeas(true);
    try {
      const found = await fetchChallengeIdeas(challenge, { apiKey, library });
      setIdeas(found);
      if (!found.length) toast("No new ideas found for this one.");
    } catch (err) {
      if (!isAbort(err)) toast(describeError(err), { kind: "error" });
    } finally {
      setLoadingIdeas(false);
    }
  };

  return (
    <Card className="min-w-0 rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-lg font-semibold">{challenge.title}</div>
            <div className="text-xs opacity-70">
              {fmt(challenge.startDate)}
              {challenge.endDate !== challenge.startDate ? ` – ${fmt(challenge.endDate)}` : ""}
              {result.status === "active" ? ` · ${result.daysLeft} day${result.daysLeft === 1 ? "" : "s"} left` : ""}
              {result.status === "completed" ? ` · finished ${fmt(result.completedOn)}` : ""}
            </div>
          </div>
          <span className="rounded-full border px-2 py-0.5 text-xs">{STATUS_LABEL[result.status]}</span>
        </div>

        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span>
              <span className="text-xl font-semibold tabular-nums">{result.done}</span> / {result.target}
              {challenge.kind === "daily" ? " days" : " films"}
            </span>
            {pace ? <span className="text-xs opacity-70">Pace: {pace}</span> : null}
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={result.pct}
            aria-label={`${challenge.title} progress`}
            className="mt-1 h-2 overflow-hidden rounded bg-white/10"
          >
            <div className="h-full rounded bg-red-600 transition-all" style={{ width: `${result.pct}%` }} />
          </div>
        </div>

        {challenge.kind === "daily" ? (
          <>
            <DayStrip challenge={challenge} result={result} />
            <div className="flex items-center gap-2 text-sm">
              <Flame className="h-4 w-4" />
              Streak {result.streak.current} day{result.streak.current === 1 ? "" : "s"}
              <span className="opacity-60">· best {result.streak.longest}</span>
            </div>
          </>
        ) : result.matched.length ? (
          <ul className="space-y-0.5 text-sm">
            {result.matched.slice(0, 8).map((m) => (
              <li key={m.item.id}>
                <span className="opacity-60">{fmt(m.day)}</span> · {m.item.title}
              </li>
            ))}
          </ul>
        ) : null}

        {result.status === "upcoming" ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/5 p-3 text-sm">
            <span className="min-w-0 flex-1">
              Starts {fmt(challenge.startDate)}, in {daysBetween(dayKey(new Date()), challenge.startDate)} day{daysBetween(dayKey(new Date()), challenge.startDate) === 1 ? "" : "s"}.
              Want to begin now? The whole window moves to start today.
            </span>
            <Button size="sm" onClick={() => onStartNow?.(challenge.id)}>Start today</Button>
          </div>
        ) : null}

        {live ? (
          <ChallengePlan challenge={challenge} library={library} profile={profile} planTime={planTime} onSetPlan={(plan) => onSetPlan?.(challenge.id, plan)} onUpdate={onUpdate} onOpenDetails={onOpenDetails} />
        ) : null}

        {live ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={buildList}>Build my watch list</Button>
            <Button size="sm" variant="outline" onClick={findIdeas} disabled={loadingIdeas}>
              {loadingIdeas ? "Searching…" : "Find ideas on TMDb"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onRemove?.(challenge.id)}>Abandon</Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => onRemove?.(challenge.id)}>Remove</Button>
        )}

        {picks?.length ? (
          <section aria-label="From your library" className="space-y-2 rounded-xl border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">From your library</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={addAll}>Add all to watchlist</Button>
                <Button size="sm" variant="ghost" onClick={() => { setPicks(null); setShowAllPicks(false); }}>Hide</Button>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              {(showAllPicks ? picks : picks.slice(0, SHOWN_AT_FIRST)).map((p) => (
                <li key={p.item.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1">
                    <button type="button" className="block max-w-full truncate text-left hover:underline" onClick={() => onOpenDetails?.(p.item)}>
                      {p.item.title}{p.item.year ? <span className="opacity-60"> ({p.item.year})</span> : null}
                    </button>
                    <span className="block truncate text-xs opacity-60">{p.reasons.find((r) => r !== "On your watchlist") || p.reasons[0]}</span>
                  </span>
                  <Button size="sm" variant={p.item.watchlist ? "ghost" : "outline"} className="shrink-0 whitespace-nowrap" onClick={() => onUpdate?.({ ...p.item, watchlist: true })} disabled={p.item.watchlist}>
                    {p.item.watchlist ? "✓ Listed" : "+ Watchlist"}
                  </Button>
                </li>
              ))}
            </ul>
            {picks.length > SHOWN_AT_FIRST ? (
              <Button size="sm" variant="ghost" onClick={() => setShowAllPicks(!showAllPicks)}>{showAllPicks ? "Show fewer" : `Show all ${picks.length}`}</Button>
            ) : null}
          </section>
        ) : null}

        {ideas?.length ? (
          <section aria-label="Ideas from TMDb" className="space-y-2 rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Ideas from TMDb</div>
              <Button size="sm" variant="ghost" onClick={() => setIdeas(null)}>Hide</Button>
            </div>
            <Ideas ideas={ideas} apiKey={apiKey} onAdd={onAdd} onOpenDetails={onOpenDetails} />
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
