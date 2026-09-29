import { useState } from "react";
import { Flame } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { MovieCard } from "../../components/MovieCard.jsx";
import { HiddenNotice } from "../../components/HiddenNotice.jsx";
import { useContentGate } from "../../hooks/useContentGate.js";
import { useToast } from "../../lib/toastContext.js";
import { useContentPrefs } from "../../lib/contentContext.js";
import { addDays, pacePhrase, parseDay, suggestForChallenge } from "../../lib/challenges.js";
import { fetchChallengeIdeas } from "../../lib/challengeIdeas.js";
import { describeError, isAbort } from "../../lib/tmdb.js";

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

// Ideas from TMDb are their own component so the content gate (hook) can run on them.
function Ideas({ ideas, apiKey, onAdd, onOpenDetails }) {
  const gate = useContentGate(ideas, apiKey);
  return (
    <div className="space-y-2">
      <HiddenNotice count={gate.hiddenCount} onReveal={gate.reveal} />
      <div className="grid gap-3 sm:grid-cols-2">
        {gate.visible.map((m) => (
          <MovieCard
            key={m.id}
            item={m}
            onAdd={(it) => onAdd?.({ ...it, watchlist: true })}
            onUpdate={(it) => onAdd?.(it)}
            compact
            onOpenDetails={onOpenDetails}
            warnings={gate.flagsById[m.id] || []}
          />
        ))}
      </div>
    </div>
  );
}

export function ChallengeCard({ challenge, result, library, profile, apiKey, onUpdate, onAdd, onOpenDetails, onRemove }) {
  const toast = useToast();
  const prefs = useContentPrefs();
  const [picks, setPicks] = useState(null);
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
    <Card className="rounded-2xl">
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
          <div className="space-y-2 rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">From your library</div>
              <Button size="sm" onClick={addAll}>Add all to watchlist</Button>
            </div>
            <ul className="space-y-1.5 text-sm">
              {picks.map((p) => (
                <li key={p.item.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <button className="hover:underline" onClick={() => onOpenDetails?.(p.item)}>{p.item.title}</button>
                    {p.item.year ? <span className="opacity-60"> ({p.item.year})</span> : null}
                    <div className="text-xs opacity-60">{p.reasons.join(" · ")}</div>
                  </span>
                  <Button size="sm" variant={p.item.watchlist ? "default" : "outline"} onClick={() => onUpdate?.({ ...p.item, watchlist: true })} disabled={p.item.watchlist}>
                    {p.item.watchlist ? "On watchlist" : "Watchlist"}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {ideas?.length ? (
          <div className="space-y-2">
            <div className="text-sm font-semibold">Ideas from TMDb</div>
            <Ideas ideas={ideas} apiKey={apiKey} onAdd={onAdd} onOpenDetails={onOpenDetails} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
