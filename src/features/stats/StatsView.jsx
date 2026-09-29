import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Badge } from "../../components/ui/badge.jsx";
import { Calendar } from "../../components/ui/calendar.jsx";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover.jsx";

export function StatsView({ items, longAgoYear = 1900 }) {
  const [affOpen, setAffOpen] = useState(false);
  const total = items.length;
  const rated = items.filter(i => (i.rating || 0) > 0);
  const avg = (rated.reduce((s, i) => s + (i.rating || 0), 0) / Math.max(1, rated.length)).toFixed(2);
  const avgScare = (items.reduce((s, i) => s + (i.scares || 0), 0) / Math.max(1, total)).toFixed(2);
  const watches = items.reduce((s, i) => s + (i.watchedDates?.length || 0), 0);

  // Streaks + XP
  const allDates = items
    .flatMap(i => (i.watchedDates || []))
    .filter(d => new Date(d).getFullYear() !== longAgoYear)
    .map(d => new Date(d).toDateString());
  const unique = Array.from(new Set(allDates)).map(s=> new Date(s)).sort((a,b)=> a-b);
  let currentStreak = 0; let streak = 0;
  if (unique.length){
    let prev = new Date(unique[unique.length-1]);
    const today = new Date(); today.setHours(0,0,0,0);
    if (prev.toDateString() !== today.toDateString()){ /* allow break */ }
    // Count backwards consecutive days
    let idx = unique.length - 1; let last = unique[idx];
    while(idx>=0){
      const expect = new Date(last); expect.setDate(expect.getDate()-1);
      if (idx-1>=0 && unique[idx-1].toDateString() === expect.toDateString()){ streak++; last = unique[idx-1]; idx--; }
      else break;
    }
    currentStreak = streak+1; // include last day with a watch
  }
  const xp = watches * 10 + Math.max(0, currentStreak-1) * 5;

  // Badges
  const watchedSet = new Set(items.filter(i=> (i.watchedDates||[]).length).map(i=> i.id));
  const isWatched = (i)=> watchedSet.has(i.id);
  const folkBadge = items.filter(i=> isWatched(i) && (i.tags||[]).includes('folk-horror')).length >= 3;
  const slasher80s = items.filter(i=> isWatched(i) && (i.tags||[]).includes('slasher') && (i.year||0) >= 1980 && (i.year||0) <= 1989).length >= 3;
  const marathon3 = currentStreak >= 3;
  const ghosts5 = items.filter(i=> isWatched(i) && ((i.tags||[]).some(t=>['supernatural','haunted','possession'].includes(t)))).length >= 5;
  const occult4 = items.filter(i=> isWatched(i) && (i.tags||[]).includes('occult')).length >= 4;
  const footage3 = items.filter(i=> isWatched(i) && (i.tags||[]).includes('found-footage')).length >= 3;
  const gore5 = items.filter(i=> isWatched(i) && ((i.tags||[]).includes('gore'))).length >= 5;
  const vamp2 = items.filter(i=> isWatched(i) && (i.tags||[]).includes('vampire')).length >= 2;
  const zombie3 = items.filter(i=> isWatched(i) && (i.tags||[]).includes('zombie')).length >= 3;
  const classic5 = items.filter(i=> isWatched(i) && (i.year||9999) <= 1980).length >= 5;
  const newblood5 = items.filter(i=> isWatched(i) && (i.year||0) >= 2015).length >= 5;
  const maxDayCount = (()=>{ const m=new Map(); (items||[]).forEach(i=> (i.watchedDates||[]).forEach(d=> m.set(d,(m.get(d)||0)+1))); return Math.max(0,...m.values()); })();
  const speed2 = maxDayCount >= 2;
  const reviewer10 = items.filter(i=> isWatched(i) && (i.notes||'').trim().length>0).length >= 10;
  const uniqueTags = new Set(items.flatMap(i=> i.tags||[])).size;
  const tagMaster = uniqueTags >= 20;
  const watchlist10 = items.filter(i=> i.watchlist).length >= 10;
  const highRatings = items.filter(i=> isWatched(i) && (i.rating||0) >= 4).length >= 5;

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

  const scatterData = items.map((i) => ({ title: i.title, rating: i.rating || 0, scares: i.scares || 0 }));

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
          <div className="grid grid-cols-5 gap-4 pt-4">
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
              <div className="text-sm opacity-70">Avg scare</div>
              <div className="text-2xl font-semibold">{avgScare}</div>
            </div>
            <div className="p-4 rounded-xl bg-muted">
              <div className="text-sm opacity-70">Streak</div>
              <div className="text-2xl font-semibold">{currentStreak}d</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <div className="text-lg font-semibold">Badges & XP</div>
          <div className="text-sm">XP: <span className="font-semibold">{xp}</span></div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant={folkBadge? 'default':'secondary'}>Folk Horror Initiate {folkBadge?'✓':''}</Badge>
            <Badge variant={slasher80s? 'default':'secondary'}>80s Slasher Fan {slasher80s?'✓':''}</Badge>
            <Badge variant={marathon3? 'default':'secondary'}>Midnight Marathon (3 in a row) {marathon3?'✓':''}</Badge>
            <Badge variant={ghosts5? 'default':'secondary'}>Ghost Hunter {ghosts5?'✓':''}</Badge>
            <Badge variant={occult4? 'default':'secondary'}>Occult Scholar {occult4?'✓':''}</Badge>
            <Badge variant={footage3? 'default':'secondary'}>Found Footage Addict {footage3?'✓':''}</Badge>
            <Badge variant={gore5? 'default':'secondary'}>Gore Hound {gore5?'✓':''}</Badge>
            <Badge variant={vamp2? 'default':'secondary'}>Vamp Acolyte {vamp2?'✓':''}</Badge>
            <Badge variant={zombie3? 'default':'secondary'}>Zombie Survivalist {zombie3?'✓':''}</Badge>
            <Badge variant={classic5? 'default':'secondary'}>Classic Connoisseur {classic5?'✓':''}</Badge>
            <Badge variant={newblood5? 'default':'secondary'}>New Blood {newblood5?'✓':''}</Badge>
            <Badge variant={speed2? 'default':'secondary'}>Speed Watcher {speed2?'✓':''}</Badge>
            <Badge variant={reviewer10? 'default':'secondary'}>Reviewer {reviewer10?'✓':''}</Badge>
            <Badge variant={tagMaster? 'default':'secondary'}>Tag Master {tagMaster?'✓':''}</Badge>
            <Badge variant={watchlist10? 'default':'secondary'}>Curator (10+ Watchlist) {watchlist10?'✓':''}</Badge>
            <Badge variant={highRatings? 'default':'secondary'}>Knife Juggler (5×4★) {highRatings?'✓':''}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Watch heatmap</div>
            <div className="flex items-center gap-2 text-sm">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">From: {rangeStart.toLocaleDateString()}</Button>
                </PopoverTrigger>
                <PopoverContent className="p-2" align="end">
                  <Calendar mode="single" selected={rangeStart} onSelect={setRangeStart} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">To: {rangeEnd.toLocaleDateString()}</Button>
                </PopoverTrigger>
                <PopoverContent className="p-2" align="end">
                  <Calendar mode="single" selected={rangeEnd} onSelect={setRangeEnd} />
                </PopoverContent>
              </Popover>
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
