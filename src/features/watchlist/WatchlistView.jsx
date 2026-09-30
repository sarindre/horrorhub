import { useMemo, useState } from "react";
import { AlarmClock, Heart } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { createICS } from "../../lib/ics.js";
import { MovieCard } from "../../components/MovieCard.jsx";
import { ContentWarnings } from "../../components/ContentWarnings.jsx";
import { HiddenNotice } from "../../components/HiddenNotice.jsx";
import { useToast } from "../../lib/toastContext.js";
import { useContentPrefs } from "../../lib/contentContext.js";
import { evaluateItem, filterByContent, itemFlags } from "../../lib/contentFlags.js";
import { buildWeeklyPlan, planEventTitle } from "../../lib/plan.js";
import { downloadBlob } from "../../lib/download.js";
import { MarathonPlanner } from "./MarathonPlanner.jsx";

const isReleased = (i, now = new Date()) => {
  const today = now.toISOString().slice(0, 10);
  return (typeof i.year === "undefined" || Number(i.year) <= now.getFullYear()) && (!i.releaseDate || i.releaseDate <= today);
};

export function WatchlistView({ items, library = items, marathonStore, onUpdate, onRemove, onOpenDetails, planDays = [], planTime = "20:00" }) {
  const toast = useToast();
  const prefs = useContentPrefs();
  const [revealed, setRevealed] = useState(false);

  // In "hide" mode, films over your limits stay out of picks and plans until you say otherwise.
  const { visible, hidden } = useMemo(() => filterByContent(items, prefs), [items, prefs]);
  const hiding = prefs.contentMode === "hide" && !revealed;
  const usable = hiding ? visible : items;
  const hiddenCount = hiding ? hidden.length : 0;

  const tonightPick = useMemo(() => {
    const pool = usable.filter((i) => isReleased(i));
    if (!pool.length) return null;
    const weights = pool.map((i) => 1 + (i.scares || 0) / 10 + ((i.tags || []).length ? 0.5 : 0));
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let idx = 0; idx < pool.length; idx++) {
      if (r < weights[idx]) return pool[idx];
      r -= weights[idx];
    }
    return pool[0];
  }, [usable]);

  // The schedule you'd get, shown up front so warnings are visible before you commit to it
  const plan = useMemo(() => buildWeeklyPlan(usable.filter((i) => isReleased(i)), { planDays, planTime }), [usable, planDays, planTime]);
  const flaggedInPlan = plan.filter((p) => evaluateItem(p.film, prefs).blocked);

  const downloadPlan = () => {
    if (!planDays.length) { toast("Set your preferred watch days in Settings first.", { kind: "error" }); return; }
    let slots = plan;
    if (flaggedInPlan.length && !hiding) {
      const list = flaggedInPlan.map((p) => `• ${p.film.title}: ${evaluateItem(p.film, prefs).reasons.join(", ")}`).join("\n");
      const keep = window.confirm(`${flaggedInPlan.length} film${flaggedInPlan.length === 1 ? "" : "s"} in this plan trip your content limits:\n\n${list}\n\nOK = keep them in the plan.\nCancel = leave them out.`);
      if (!keep) slots = buildWeeklyPlan(usable.filter((i) => isReleased(i) && !evaluateItem(i, prefs).blocked), { planDays, planTime });
    }
    if (!slots.length) { toast("Nothing to schedule yet.", { kind: "error" }); return; }
    const events = slots.map((p) => ({ title: planEventTitle(p.film), start: p.start, description: "Weekly plan" }));
    downloadBlob(new Blob([createICS({ events })], { type: "text/calendar" }), `horrorhub-weekly-${new Date().toISOString().slice(0, 10)}.ics`);
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto px-3 sm:px-4 md:px-6">
      <div className="text-lg font-semibold">Your Watchlist</div>
      <HiddenNotice count={hiddenCount} onReveal={() => setRevealed(true)} />

      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm uppercase tracking-wide opacity-80">
            <AlarmClock className="h-4 w-4" /> Tonight's pick
          </div>
          {tonightPick ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <button className="truncate pr-2 text-left hover:underline" onClick={() => onOpenDetails?.(tonightPick)}>{tonightPick.title}</button>
                <Button size="sm" onClick={() => onUpdate({ ...tonightPick, watchlist: true })}>
                  <Heart className="h-4 w-4 mr-1" />
                  Watchlist
                </Button>
              </div>
              <ContentWarnings
                flags={itemFlags(tonightPick)}
                avoid={prefs.avoidFlags}
                reasons={evaluateItem(tonightPick, prefs).reasons}
                showFlags={prefs.showWarnings}
              />
            </div>
          ) : (
            <div className="text-sm opacity-70">Add released items to your watchlist to enable.</div>
          )}
        </CardContent>
      </Card>

      {marathonStore ? (
        <MarathonPlanner library={library} watchlist={items} planTime={planTime} store={marathonStore} onUpdate={onUpdate} onOpenDetails={onOpenDetails} />
      ) : null}

      {/* Weekly Watch Plan */}
      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm uppercase tracking-wide opacity-80">Weekly Watch Plan</div>
            <Button size="sm" variant="outline" onClick={downloadPlan}>Download Plan (4 weeks)</Button>
          </div>
          <div className="text-xs opacity-70">Uses your preferred days/time from Settings. Takes titles in watchlist order.</div>
          {!planDays.length ? (
            <div className="text-sm opacity-70">Pick your preferred watch days in Settings to see your schedule.</div>
          ) : plan.length ? (
            <ol className="space-y-1.5 pt-1 text-sm">
              {plan.slice(0, 6).map((p) => {
                const verdict = evaluateItem(p.film, prefs);
                return (
                  <li key={p.film.id}>
                    <span className="opacity-70">{p.start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}, {p.start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                    {" · "}
                    <button className="text-left hover:underline" onClick={() => onOpenDetails?.(p.film)}>{p.film.title}</button>
                    <ContentWarnings flags={itemFlags(p.film)} avoid={prefs.avoidFlags} reasons={verdict.blocked ? verdict.reasons : []} showFlags={prefs.showWarnings} />
                  </li>
                );
              })}
              {plan.length > 6 ? <li className="text-xs opacity-60">…and {plan.length - 6} more in the download</li> : null}
            </ol>
          ) : (
            <div className="text-sm opacity-70">Nothing to schedule yet. Add released films to your watchlist.</div>
          )}
          {flaggedInPlan.length && !hiding ? (
            <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
              {flaggedInPlan.length} planned film{flaggedInPlan.length === 1 ? "" : "s"} trip your content limits. You'll be asked what to do when you download.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {usable.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
          {usable.map((i) => (
            <MovieCard key={i.id} item={i} onUpdate={onUpdate} onRemove={onRemove} compact onOpenDetails={onOpenDetails} isInLibrary />
          ))}
        </div>
      ) : items.length ? null : (
        <div className="opacity-70">Your watchlist is empty. Add titles from Discover or Library.</div>
      )}
    </div>
  );
}
