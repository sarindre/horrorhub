import { useMemo, useState } from "react";
import { Shuffle } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { ContentWarnings } from "../../components/ContentWarnings.jsx";
import { useToast } from "../../lib/toastContext.js";
import { useContentPrefs } from "../../lib/contentContext.js";
import { itemFlags } from "../../lib/contentFlags.js";
import { createICS } from "../../lib/ics.js";
import { downloadBlob, slugify } from "../../lib/download.js";
import { MOOD_PRESETS } from "../../lib/moods.js";
import { dayKey, parseDay } from "../../lib/challenges.js";
import { buildTasteProfile } from "../../lib/taste.js";
import {
  ANY_THEME,
  FLOW_SHAPES,
  buildMarathon,
  marathonEvents,
  marathonTimeline,
  runtimeOf,
  seasonalThemes,
  snapshotFilm,
  themeFromMood,
} from "../../lib/marathon.js";

const COUNTS = [2, 3, 4, 5];
const HOURS = [3, 4, 5, 6, 8];
const fmtTime = (d) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const fmtDay = (d) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const fmtRuntime = (min) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;

function startFrom(dateKey, time) {
  const [hh, mm] = String(time || "20:00").split(":").map(Number);
  const d = parseDay(dateKey);
  d.setHours(Number.isFinite(hh) ? hh : 20, Number.isFinite(mm) ? mm : 0, 0, 0);
  return d;
}

function scareLabel(scares) {
  return scares == null ? "" : `Scare ${scares}/10`;
}

// Builds a themed lineup for one night: fits your time budget, follows the
// scare-level shape you pick, and stays inside your content limits.
export function MarathonPlanner({ library, watchlist, planTime = "20:00", store, onUpdate, onOpenDetails }) {
  const toast = useToast();
  const prefs = useContentPrefs();
  const [source, setSource] = useState(watchlist.length >= 2 ? "watchlist" : "library");
  const [themeId, setThemeId] = useState("any");
  const [count, setCount] = useState(3);
  const [hours, setHours] = useState(6);
  const [shape, setShape] = useState("ramp");
  const [seed, setSeed] = useState(0);
  const [date, setDate] = useState(() => dayKey(new Date()));
  const [time, setTime] = useState(planTime);
  const [name, setName] = useState("");

  const themes = useMemo(() => [ANY_THEME, ...seasonalThemes(), ...MOOD_PRESETS.filter((p) => p.id !== "all").map((p) => themeFromMood(p.id))], []);
  const theme = themes.find((t) => t.id === themeId) || ANY_THEME;
  const profile = useMemo(() => buildTasteProfile(library), [library]);
  const pool = source === "watchlist" ? watchlist : library;

  const plan = useMemo(
    () => buildMarathon(pool, { count, budgetMinutes: hours * 60, theme, shape, profile, prefs, seed }),
    [pool, count, hours, theme, shape, profile, prefs, seed]
  );
  const startAt = startFrom(date, time);
  const timeline = marathonTimeline(plan.films.map((f) => ({ ...f.item, runtime: runtimeOf(f.item) })), startAt);
  const label = name.trim() || `${theme.label === ANY_THEME.label ? "Horror" : theme.label} night`;

  const eventsFor = (planName, films, at) => marathonEvents(planName, films, at);
  const download = (planName, films, at) => {
    const blob = new Blob([createICS({ events: eventsFor(planName, films, at) })], { type: "text/calendar" });
    downloadBlob(blob, `horrorhub-${slugify(planName)}.ics`);
  };

  const save = () => {
    const saved = store.save({
      id: `m-${Date.now().toString(36)}`,
      name: label,
      startAt: startAt.toISOString(),
      shape,
      themeLabel: theme.label,
      films: plan.films.map((f) => snapshotFilm({ ...f.item, runtime: runtimeOf(f.item) })),
    });
    if (saved) {
      toast(`Saved "${saved.name}".`, { kind: "success" });
      setName("");
    }
  };

  const addAllToWatchlist = () => {
    plan.films.forEach((f) => onUpdate?.({ ...f.item, watchlist: true }));
    toast(`Added ${plan.films.length} film${plan.films.length === 1 ? "" : "s"} to your watchlist.`, { kind: "success" });
  };

  const select = "bg-transparent border rounded px-2 py-1 text-sm";

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-4">
        <div className="text-sm uppercase tracking-wide opacity-80">Marathon planner</div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <label className="inline-flex items-center gap-2">
            From
            <select className={select} value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="watchlist">My watchlist ({watchlist.length})</option>
              <option value="library">Whole library ({library.length})</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2">
            Theme
            <select className={select} value={themeId} onChange={(e) => setThemeId(e.target.value)}>
              {themes.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-2">
            Films
            <select className={select} value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {COUNTS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="inline-flex items-center gap-2">
            Time available
            <select className={select} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {HOURS.map((h) => <option key={h} value={h}>{h} hours</option>)}
            </select>
          </label>
          <label className="inline-flex items-center gap-2">
            Pacing
            <select className={select} value={shape} onChange={(e) => setShape(e.target.value)}>
              {Object.entries(FLOW_SHAPES).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
            </select>
          </label>
          <label className="inline-flex flex-wrap items-center gap-2">
            Start
            <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-40" />
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value || planTime)} className="w-28" />
          </label>
        </div>
        <div className="text-xs opacity-70">{FLOW_SHAPES[shape].blurb}. Films over your content limits are left out, and there's a 15-minute break between films.</div>

        {plan.films.length ? (
          <div className="space-y-3">
            <ol className="space-y-3">
              {timeline.map(({ film, start, end }, i) => {
                const picked = plan.films[i];
                return (
                  <li key={film.id} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <span className="opacity-60 text-xs">{i + 1}. {fmtDay(start)}, {fmtTime(start)} – {fmtTime(end)}</span>
                        <div>
                          <button className="text-left font-medium hover:underline" onClick={() => onOpenDetails?.(picked.item)}>{film.title}</button>
                          {film.year ? <span className="opacity-60"> ({film.year})</span> : null}
                        </div>
                      </div>
                      <div className="text-xs opacity-70 text-right">
                        {film.runtime ? fmtRuntime(runtimeOf(film)) : ""}
                        {!picked.item.runtime ? " (est.)" : ""}
                        {scareLabel(film.scares) ? ` · ${scareLabel(film.scares)}` : ""}
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-2" aria-hidden="true">
                      <div className="h-1.5 flex-1 overflow-hidden rounded bg-white/10">
                        <div className="h-full rounded bg-red-600" style={{ width: `${(film.scares ?? 5) * 10}%` }} />
                      </div>
                    </div>
                    <div className="text-xs opacity-60">{picked.reasons.join(" · ")}</div>
                    <ContentWarnings flags={itemFlags(picked.item)} avoid={prefs.avoidFlags} showFlags={prefs.showWarnings} />
                  </li>
                );
              })}
            </ol>
            <div className="text-sm">
              <span className="opacity-70">Total: </span>{fmtRuntime(plan.totalMinutes)}
              <span className="opacity-70"> · {plan.flow}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setSeed((s) => s + 1)}>
                <Shuffle className="h-4 w-4 mr-1" /> Shuffle
              </Button>
              <Input placeholder={label} value={name} onChange={(e) => setName(e.target.value)} className="w-48" aria-label="Plan name" />
              <Button size="sm" onClick={save}>Save plan</Button>
              <Button size="sm" variant="outline" onClick={() => download(label, timeline.map((t) => t.film), startAt)}>Download .ics</Button>
              {source === "library" ? <Button size="sm" variant="outline" onClick={addAllToWatchlist}>Add all to watchlist</Button> : null}
            </div>
          </div>
        ) : (
          <div className="text-sm opacity-70">
            {pool.length ? "Nothing fits that theme and your content limits. Try another theme, or the whole library." : "Add films to your watchlist (or switch to your whole library) to plan a night."}
          </div>
        )}

        {store.marathons.length ? (
          <div className="space-y-2 border-t pt-3">
            <div className="text-sm font-semibold">Saved plans</div>
            <ul className="space-y-2 text-sm">
              {store.marathons.map((m) => {
                const at = new Date(m.startAt);
                return (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="font-medium">{m.name}</span>
                      <span className="opacity-60"> · {fmtDay(at)}, {fmtTime(at)} · {m.themeLabel} · {FLOW_SHAPES[m.shape].label}</span>
                      <div className="text-xs opacity-70 truncate">{m.films.map((f) => f.title).join(" → ")}</div>
                    </span>
                    <span className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => download(m.name, m.films, at)}>.ics</Button>
                      <Button size="sm" variant="ghost" onClick={() => store.remove(m.id)}>Delete</Button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
