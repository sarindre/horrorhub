import { useMemo, useState } from "react";
import { CalendarDays, Check, Shuffle } from "lucide-react";
import { Button } from "../../components/ui/button.jsx";
import { WatchDialog } from "../../components/WatchDialog.jsx";
import { useToast } from "../../lib/toastContext.js";
import { useContentPrefs } from "../../lib/contentContext.js";
import { buildChallengePlan, challengePlanEvents, planRows, replacementFor } from "../../lib/challengePlan.js";
import { parseDay } from "../../lib/challenges.js";
import { createICS } from "../../lib/ics.js";
import { downloadBlob, slugify } from "../../lib/download.js";
import { watchPatch } from "../../lib/watch.js";

const SHOWN_AT_FIRST = 7;
const dayLabel = (key) => parseDay(key).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const runtimeLabel = (m) => (m ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : "");

// The day-by-day plan for one challenge: a film for each night, gentle nights
// first and heavier ones later. Swap a night, fill an open slot, log the watch,
// or take the whole thing to your calendar.
export function ChallengePlan({ challenge, library, profile, planTime, onSetPlan, onUpdate, onOpenDetails }) {
  const toast = useToast();
  const prefs = useContentPrefs();
  const [showAll, setShowAll] = useState(false);
  const [swappedAway, setSwappedAway] = useState([]); // films you've rejected this visit
  const now = new Date();
  const rows = useMemo(() => planRows(challenge, library, new Date()), [challenge, library]);
  const opts = { profile, prefs, avoid: swappedAway };

  const build = () => {
    const plan = buildChallengePlan(challenge, library, { profile, prefs });
    onSetPlan(plan);
    setSwappedAway([]);
    const open = plan.filter((e) => e.filmId === null).length;
    if (!plan.length) toast("Nothing left to plan: every night is covered.");
    else if (open === plan.length) toast("No unwatched films in your library fit this yet. Add some from the ideas below.");
    else if (open) toast(`Planned ${plan.length - open} night${plan.length - open === 1 ? "" : "s"}. ${open} still need a film.`);
  };

  const swap = (row) => {
    const next = replacementFor(challenge, challenge.plan, row.day, library, { ...opts, now });
    if (!next) return toast("No other film in your library fits that night.");
    if (row.filmId !== null) setSwappedAway((s) => [...s, row.filmId]);
    onSetPlan(challenge.plan.map((e) => (e.day === row.day ? next : e)));
  };

  const download = () => {
    const events = challengePlanEvents(challenge, rows, planTime);
    if (!events.length) return toast("Nothing to add: no unwatched films are planned.");
    downloadBlob(new Blob([createICS({ events })], { type: "text/calendar" }), `horrorhub-${slugify(challenge.title)}-plan.ics`);
  };

  // Runs of nights with no film collapse into one line, so a half-empty plan stays short.
  const items = [];
  for (const row of rows) {
    const last = items[items.length - 1];
    if (row.state === "open" && last?.open) last.days.push(row.day);
    else items.push(row.state === "open" ? { open: true, key: row.day, days: [row.day] } : { open: false, key: row.day, row });
  }
  const visible = showAll ? items : items.slice(0, SHOWN_AT_FIRST);

  // Fill the given nights from your library, best fit first.
  const fill = (days) => {
    let next = challenge.plan;
    let filled = 0;
    for (const day of days) {
      const pick = replacementFor(challenge, next, day, library, { ...opts, now });
      if (!pick) break;
      next = next.map((e) => (e.day === day ? pick : e));
      filled++;
    }
    if (!filled) return toast("No unwatched film in your library fits those nights. Add some from the TMDb ideas, then fill them.");
    onSetPlan(next);
    if (filled < days.length) toast(`Filled ${filled} of ${days.length} nights. The rest need more films in your library.`);
  };

  return (
    <section aria-label="Daily plan" className="space-y-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Daily plan</h4>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={rows.length ? "outline" : "default"} onClick={build}>
            {rows.length ? <><Shuffle className="mr-1 h-4 w-4" /> Replan</> : "Plan my days"}
          </Button>
          {rows.length ? <Button size="sm" variant="outline" onClick={download}><CalendarDays className="mr-1 h-4 w-4" /> Calendar</Button> : null}
          {rows.length ? <Button size="sm" variant="ghost" onClick={() => onSetPlan([])}>Clear</Button> : null}
        </div>
      </div>

      {!rows.length ? (
        <div className="text-sm opacity-70">Pick a film for every night from your library, building from gentle to intense. You can swap any night.</div>
      ) : (
        <>
          <ul className="space-y-1.5">
            {visible.map((item) => {
            if (item.open) {
              return (
              <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5">
                <div className="min-w-0 text-sm opacity-70">
                  {item.days.length === 1 ? dayLabel(item.days[0]) : `${dayLabel(item.days[0])} – ${dayLabel(item.days[item.days.length - 1])}`}
                  <span className="block text-xs">{item.days.length} night{item.days.length === 1 ? "" : "s"} open</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => fill(item.days)}>Fill from library</Button>
              </li>
              );
            }
            const row = item.row;
            return (
              <li key={row.day} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${row.isToday ? "bg-red-500/10 ring-1 ring-red-500/40" : ""}`}>
                <div className="min-w-0">
                  <div className="text-xs opacity-70">{dayLabel(row.day)}{row.isToday ? " · Tonight" : ""}</div>
                  {row.item ? (
                    <>
                      <button type="button" className="text-left text-sm font-medium hover:underline" onClick={() => onOpenDetails?.(row.item)}>{row.title}</button>
                      {row.year ? <span className="text-sm opacity-60"> ({row.year})</span> : null}
                      <div className="text-xs opacity-60">
                        {[row.scares != null ? `Scare ${row.scares}/10${row.scaresEst ? " (est.)" : ""}` : "", runtimeLabel(row.runtime || row.item.runtime)].filter(Boolean).join(" · ")}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm opacity-70">{row.state === "gone" ? `${row.title} is no longer in your library` : "Open slot"}</div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {row.state === "watched" ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400"><Check className="h-3.5 w-3.5" /> Watched</span>
                  ) : (
                    <>
                      {row.item && row.state !== "watched" ? (
                        <WatchDialog label="Watched" rating={row.item.rating} onLog={(iso, diary, rating) => onUpdate?.({ ...row.item, ...watchPatch(row.item, iso, diary, rating) })} />
                      ) : null}
                      <Button size="sm" variant="outline" onClick={() => swap(row)}>{row.item ? "Swap" : "Find a film"}</Button>
                    </>
                  )}
                  {row.state === "missed" ? <span className="text-xs opacity-60">Missed</span> : null}
                </div>
              </li>
            );
          })}
          </ul>
          {items.length > SHOWN_AT_FIRST ? (
            <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer" : `Show all ${rows.length} nights`}</Button>
          ) : null}
        </>
      )}
    </section>
  );
}
