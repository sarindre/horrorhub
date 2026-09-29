import React from "react";
import { AlarmClock, Heart } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { createICS } from "../../lib/ics.js";
import { MovieCard } from "../../components/MovieCard.jsx";

export function WatchlistView({ items, onUpdate, onRemove, onOpenDetails, planDays = [], planTime = '20:00' }) {
  const tonightPick = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    const today = new Date().toISOString().slice(0,10);
    const isReleased = (i) => (typeof i.year === 'undefined' || Number(i.year) <= currentYear) && (!i.releaseDate || i.releaseDate <= today);
    const pool = items.filter(isReleased);
    if (!pool.length) return null;
    const weights = pool.map((i) => 1 + (i.scares || 0) / 10 + ((i.tags || []).length ? 0.5 : 0));
    const sum = weights.reduce((a,b)=>a+b,0);
    let r = Math.random()*sum;
    for (let idx=0; idx<pool.length; idx++) { if (r < weights[idx]) return pool[idx]; r -= weights[idx]; }
    return pool[0];
  }, [items]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto px-3 sm:px-4 md:px-6">
      <div className="text-lg font-semibold">Your Watchlist</div>

      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm uppercase tracking-wide opacity-80">
            <AlarmClock className="h-4 w-4" /> Tonight's pick
          </div>
          {tonightPick ? (
            <div className="flex items-center justify-between">
              <button className="truncate pr-2 text-left hover:underline" onClick={()=> onOpenDetails?.(tonightPick)}>{tonightPick.title}</button>
              <Button size="sm" onClick={() => onUpdate({ ...tonightPick, watchlist: true })}>
                <Heart className="h-4 w-4 mr-1" />
                Watchlist
              </Button>
            </div>
          ) : (
            <div className="text-sm opacity-70">Add released items to your watchlist to enable.</div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Watch Plan */}
      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm uppercase tracking-wide opacity-80">Weekly Watch Plan</div>
            <Button size="sm" variant="outline" onClick={()=>{
              const daysSet = new Set(planDays);
              if (!daysSet.size) { alert('Set preferred days in Settings.'); return; }
              const [hh,mm] = (planTime||'20:00').split(':').map(Number);
              const events = []; const start = new Date(); const list = items.slice(); let idx=0;
              for (let d=0; d<28 && idx<list.length; d++){
                const dt = new Date(start); dt.setDate(dt.getDate()+d); if (daysSet.has(dt.getDay())){
                  const m = list[idx++]; if (!m) break; dt.setHours(hh||20, mm||0, 0, 0);
                  events.push({ title:`Watch: ${m.title} (${m.year||''})`, start: dt, description:'Weekly plan' });
                }
              }
              if (!events.length) { alert('No events to schedule.'); return; }
              const ics = createICS({ events });
              const blob = new Blob([ics], { type: 'text/calendar' }); const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href=url; a.download = `horrorhub-weekly-${new Date().toISOString().slice(0,10)}.ics`; a.click(); URL.revokeObjectURL(url);
            }}>Download Plan (4 weeks)</Button>
          </div>
          <div className="text-xs opacity-70">Uses your preferred days/time from Settings. Takes titles in watchlist order.</div>
        </CardContent>
      </Card>

      {items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
          {items.map((i) => (
            <MovieCard key={i.id} item={i} onUpdate={onUpdate} onRemove={onRemove} compact onOpenDetails={onOpenDetails} />
          ))}
        </div>
      ) : (
        <div className="opacity-70">Your watchlist is empty. Add titles from Discover or Library.</div>
      )}
    </div>
  );
}
