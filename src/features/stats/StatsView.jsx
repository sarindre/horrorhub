import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { DateField } from "../../components/ui/date-field.jsx";
import { InsightsCard } from "./InsightsCard.jsx";
import { WrappedCard } from "./WrappedCard.jsx";
import { LevelCard } from "./LevelCard.jsx";
import { scareBias, scareOf } from "../../lib/scare.js";
import { dayKey } from "../../lib/dates.js";
import { streaksFrom } from "../../lib/challenges.js";
import { realWatchDays } from "../../lib/progress.js";

export function StatsView({ items, longAgoYear = 1900 }) {
  const [affOpen, setAffOpen] = useState(false);
  const total = items.length;
  const rated = items.filter(i => (i.rating || 0) > 0);
  const avg = (rated.reduce((s, i) => s + (i.rating || 0), 0) / Math.max(1, rated.length)).toFixed(2);
  // scare levels you haven't set yourself are estimated (see lib/scare.js), not counted as a flat 5
  const bias = scareBias(items);
  const scareValues = items.map((i) => scareOf(i, { bias }));
  const avgScare = (scareValues.reduce((sum, x) => sum + x.value, 0) / Math.max(1, total)).toFixed(1);
  const scareIsEstimate = scareValues.filter((x) => !x.estimated).length * 2 < total;
  const watches = items.reduce((s, i) => s + (i.watchedDates?.length || 0), 0);

  // the streak that is still alive (it ends today or yesterday), never counting "long ago" placeholder dates
  const currentStreak = streaksFrom(realWatchDays(items, longAgoYear), dayKey(new Date())).current;

  // Date range (default last 6 months)
  const today = new Date();
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const [rangeStart, setRangeStart] = useState(new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), sixMonthsAgo.getDate()));
  const [rangeEnd, setRangeEnd] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()));

  const byDay = new Map();
  items.forEach((i) =>
    (i.watchedDates || [])
      .filter(d => new Date(d).getFullYear() !== longAgoYear)
      .forEach((d) => {
        const key = new Date(d).toDateString();
        byDay.set(key, (byDay.get(key) || 0) + 1);
      })
  );
  // Build day list for selected range
  const days = [];
  const start = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
  const end = rangeEnd >= rangeStart ? rangeEnd : rangeStart;
  {
    const dt = new Date(start);
    while (dt <= end) {
      days.push(new Date(dt));
      dt.setDate(dt.getDate() + 1);
    }
  }
  const maxCount = Math.max(1, ...Array.from(byDay.values()));

  const scatterData = items.filter((i) => (i.rating || 0) > 0).map((i) => ({ title: i.title, rating: i.rating, scares: scareOf(i, { bias }).value }));

  // Build top-10 tags by frequency for affinity matrix
  const tagCounts = new Map();
  items.forEach((i) => (i.tags || []).forEach((t) => tagCounts.set(t, (tagCounts.get(t) || 0) + 1)));
  const tags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([t]) => t);
  const tagIndex = Object.fromEntries(tags.map((t, idx) => [t, idx]));
  const matrix = Array.from({ length: tags.length }, () => Array(tags.length).fill(0));
  items.forEach((i) => {
    const t = (i.tags || []).filter((tg) => tagIndex[tg] !== undefined);
    for (let a = 0; a < t.length; a++) {
      for (let b = 0; b < t.length; b++) {
        if (a === b) continue;
        const ia = tagIndex[t[a]];
        const ib = tagIndex[t[b]];
        if (ia === undefined || ib === undefined) continue;
        matrix[ia][ib]++;
      }
    }
  });
  const maxAffinity = Math.max(1, ...matrix.flat());

  const recent = [...items]
    .flatMap((i) => (i.watchedDates || []).filter(d => new Date(d).getFullYear() !== longAgoYear).map((d) => ({ title: i.title, date: d })))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-2">
          <div className="text-sm uppercase tracking-wide opacity-70">Overview</div>
          <div className="text-3xl font-bold">Your horror stats</div>
          <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-3 lg:grid-cols-5">
            <div className="p-4 rounded-xl bg-muted">
              <div className="text-sm opacity-70">Movies</div>
              <div className="text-2xl font-semibold">{total}</div>
            </div>
            <div className="p-4 rounded-xl bg-muted">
              <div className="text-sm opacity-70">Avg rating</div>
              <div className="text-2xl font-semibold">{avg}</div>
            </div>
            <div className="p-4 rounded-xl bg-muted">
              <div className="text-sm opacity-70">Total watches</div>
              <div className="text-2xl font-semibold">{watches}</div>
            </div>
            <div className="p-4 rounded-xl bg-muted">
              <div className="text-sm opacity-70">Avg scare{scareIsEstimate ? " (est.)" : ""}</div>
              <div className="text-2xl font-semibold">{avgScare}</div>
            </div>
            <div className="p-4 rounded-xl bg-muted">
              <div className="text-sm opacity-70">Streak</div>
              <div className="text-2xl font-semibold">{currentStreak}d</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <InsightsCard items={items} longAgoYear={longAgoYear} />

      <WrappedCard items={items} longAgoYear={longAgoYear} />

      <LevelCard items={items} longAgoYear={longAgoYear} />

      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-lg font-semibold">Watch heatmap</div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="inline-flex items-center gap-2 text-sm">
                From
                <DateField value={rangeStart} onChange={setRangeStart} className="py-1" />
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                To
                <DateField value={rangeEnd} onChange={setRangeEnd} className="py-1" />
              </label>
              <Button size="sm" onClick={() => { const t=new Date(); const s=new Date(t); s.setMonth(s.getMonth()-6); setRangeStart(new Date(s.getFullYear(), s.getMonth(), s.getDate())); setRangeEnd(new Date(t.getFullYear(), t.getMonth(), t.getDate())); }}>Last 6 mo</Button>
              <Button size="sm" onClick={() => { const t=new Date(); const s=new Date(t); s.setMonth(s.getMonth()-3); setRangeStart(new Date(s.getFullYear(), s.getMonth(), s.getDate())); setRangeEnd(new Date(t.getFullYear(), t.getMonth(), t.getDate())); }}>Last 3 mo</Button>
              <Button size="sm" onClick={() => { const t=new Date(); const s=new Date(t.getFullYear(), 0, 1); setRangeStart(new Date(s.getFullYear(), s.getMonth(), s.getDate())); setRangeEnd(new Date(t.getFullYear(), t.getMonth(), t.getDate())); }}>This year</Button>
              <Button size="sm" onClick={() => { const t=new Date(); const s=new Date(t.getFullYear(), t.getMonth(), 1); setRangeStart(new Date(s.getFullYear(), s.getMonth(), s.getDate())); setRangeEnd(new Date(t.getFullYear(), t.getMonth(), t.getDate())); }}>This month</Button>
            </div>
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.ceil(days.length/7))}, minmax(0, 1fr))` }}>
            {days.map((d, idx) => {
              const key = d.toDateString();
              const c = byDay.get(key) || 0;
              const alpha = c ? 0.2 + 0.8 * (c / maxCount) : 0.08;
              const title = `${d.toLocaleDateString()} – ${c} watches`;
              return <div key={idx} title={title} className="w-3 h-3 rounded-sm" style={{ background: `rgba(239,68,68,${alpha})` }} />;
            })}
          </div>
          <div className="text-xs opacity-70 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Color intensity = more watches that day.
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <div className="text-lg font-semibold">Scare vs. Rating</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <CartesianGrid />
                <XAxis type="number" dataKey="scares" name="Scares" domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
                <YAxis type="number" dataKey="rating" name="Rating" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v, n) => [v, n]} labelFormatter={() => ""} />
                <Scatter data={scatterData} fill="#ef4444" fillOpacity={0.9}>
                  {scatterData.map((e, i) => (
                    <Cell key={`cell-${i}`} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Tag affinity matrix</div>
            <Button size="sm" variant="outline" onClick={() => setAffOpen((v) => !v)}>{affOpen ? "Hide" : "Show"}</Button>
          </div>
          {!affOpen ? (
            <div className="text-sm opacity-70">Top 10 tags by frequency. Click Show to view matrix.</div>
          ) : tags.length ? (
            <div className="overflow-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left p-2"></th>
                    {tags.map((t) => (
                      <th key={t} className="text-left p-2 whitespace-nowrap">
                        #{t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tags.map((row, i) => (
                    <tr key={row}>
                      <td className="p-2 font-medium whitespace-nowrap">#{row}</td>
                      {tags.map((col, j) => {
                        const val = matrix[i][j];
                        const alpha = val ? 0.2 + 0.8 * (val / maxAffinity) : 0.04;
                        return (
                          <td key={row + col} className="p-2" title={`${row} × ${col}: ${val}`}>
                            <div className="w-6 h-6 rounded" style={{ background: `rgba(16,185,129,${alpha})` }} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="opacity-70">Add tags to see affinities.</div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl md:col-span-2">
        <CardContent className="p-6 space-y-3">
          <div className="text-lg font-semibold">Recently watched</div>
          <div className="grid md:grid-cols-2 gap-3">
            {recent.length ? (
              recent.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted">
                  <div className="truncate pr-4">{r.title}</div>
                  <div className="text-sm opacity-70">{new Date(r.date).toLocaleDateString()}</div>
                </div>
              ))
            ) : (
              <div className="opacity-70">Nothing logged yet</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
