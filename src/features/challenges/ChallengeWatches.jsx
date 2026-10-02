import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "../../components/ui/button.jsx";
import { DateField } from "../../components/ui/date-field.jsx";
import { Label } from "../../components/ui/label.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog.jsx";
import { StarRating } from "../../components/StarRating.jsx";
import { useToast } from "../../lib/toastContext.js";
import { challengeWatches, moveWatch, removeWatch } from "../../lib/challengeWatches.js";
import { dayKey, isoDateOnly, parseDay } from "../../lib/dates.js";
import { describeError, isAbort, mapMovie, tmdbGet } from "../../lib/tmdb.js";
import { watchPatch } from "../../lib/watch.js";

const SHOWN_AT_FIRST = 5;
const dayLabel = (key) => parseDay(key).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

// Add a film you watched on a day that's already gone by (or today): pick the day, find the
// film in your library or on TMDb, and it's logged, so no day of a challenge is lost.
function LogForm({ initialDay, library, apiKey, onUpdate, onAdd, onClose }) {
  const toast = useToast();
  const [date, setDate] = useState(() => (initialDay ? parseDay(initialDay) : new Date()));
  const [query, setQuery] = useState("");
  const [rating, setRating] = useState(null);
  const [found, setFound] = useState(null);
  const [searching, setSearching] = useState(false);
  const q = query.trim().toLowerCase();
  const local = q ? library.filter((i) => String(i.title || "").toLowerCase().includes(q)).slice(0, 6) : [];
  const owned = (id) => library.find((i) => String(i.id) === String(id));

  const searchTmdb = async () => {
    if (!q) return;
    setSearching(true);
    try {
      const data = await tmdbGet(`/search/movie?include_adult=false&language=en-US&query=${encodeURIComponent(query.trim())}`, { apiKey });
      setFound((data.results || []).slice(0, 6).map(mapMovie));
    } catch (err) {
      if (!isAbort(err)) toast(describeError(err), { kind: "error" });
    } finally {
      setSearching(false);
    }
  };

  const save = (film) => {
    const have = owned(film.id);
    const base = have || film;
    const patch = watchPatch(base, isoDateOnly(date), undefined, rating ?? undefined);
    if (have) onUpdate?.({ ...have, ...patch });
    else onAdd?.({ ...film, ...patch });
    toast(`Logged ${film.title} on ${dayLabel(dayKey(date))}.`, { kind: "success" });
    onClose();
  };

  const row = (film, key) => (
    <li key={key} className="flex flex-wrap items-center justify-between gap-2">
      <span className="min-w-0 text-sm">
        {film.title}
        {film.year ? <span className="opacity-60"> ({film.year})</span> : null}
        {owned(film.id) && !local.includes(film) ? <span className="text-xs opacity-60"> · in your library</span> : null}
      </span>
      <Button size="sm" onClick={() => save(film)}>Log it</Button>
    </li>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="past-watch-day">Which day did you watch it?</Label>
        <DateField id="past-watch-day" value={date} onChange={setDate} max={dayKey(new Date())} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm">Your rating (optional)</span>
        <StarRating value={rating ?? 0} onChange={setRating} iconClass="h-6 w-6" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="past-watch-film">Which film?</Label>
        <div className="flex flex-wrap gap-2">
          <input
            id="past-watch-film"
            className="min-w-0 flex-1 rounded-xl border bg-transparent px-3 py-2 text-sm"
            placeholder="Search your library"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setFound(null); }}
            onKeyDown={(e) => { if (e.key === "Enter" && apiKey) searchTmdb(); }}
          />
          {apiKey ? <Button variant="outline" onClick={searchTmdb} disabled={!q || searching}>{searching ? "Searching…" : "Search TMDb"}</Button> : null}
        </div>
        {q ? (
          <ul className="mt-2 space-y-2">
            {found ? (
              found.length ? found.map((f) => row(f, `t${f.id}`)) : <li className="text-sm opacity-70">TMDb found nothing for that.</li>
            ) : local.length ? (
              local.map((f) => row(f, f.id))
            ) : (
              <li className="text-sm opacity-70">Nothing in your library matches.{apiKey ? " Press Search TMDb to look further." : " Add a TMDb token in Settings to search beyond your library."}</li>
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

// "Your watches" on a challenge card: what's been counted so far, each one changeable or
// removable, plus a way to add a film you forgot to log. `logDay` is controlled by the card
// so the day squares can open the same dialog.
export function ChallengeWatches({ challenge, result, library, apiKey, canLog, logDay, onLogDay, onUpdate, onAdd, onOpenDetails }) {
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(null); // "filmId|day" being moved
  const [newDay, setNewDay] = useState(null);
  const watches = challengeWatches(challenge, library, result);
  const shown = showAll ? watches : watches.slice(0, SHOWN_AT_FIRST);
  const keyOf = (w) => `${w.item.id}|${w.day}`;

  const remove = (w) => {
    if (!window.confirm(`Remove your ${dayLabel(w.day)} watch of ${w.item.title}? Its diary note for that day goes too.`)) return;
    onUpdate?.(removeWatch(w.item, w.day));
  };
  const saveMove = (w) => {
    onUpdate?.(moveWatch(w.item, w.day, dayKey(newDay)));
    setEditing(null);
  };

  return (
    <section aria-label="Your watches" className="space-y-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Your watches</h4>
        {canLog ? <Button size="sm" variant="outline" onClick={() => onLogDay("")}><Plus className="mr-1 h-4 w-4" /> Log a film I watched</Button> : null}
      </div>
      {watches.length ? (
        <ul className="space-y-1.5">
          {shown.map((w) => (
            <li key={keyOf(w)} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="min-w-0">
                <span className="opacity-60">{dayLabel(w.day)}</span> ·{" "}
                <button type="button" className="text-left hover:underline" onClick={() => onOpenDetails?.(w.item)}>{w.item.title}</button>
              </span>
              {editing === keyOf(w) ? (
                <span className="flex flex-wrap items-center gap-2">
                  <DateField aria-label={`New day for ${w.item.title}`} value={newDay} onChange={setNewDay} max={dayKey(new Date())} />
                  <Button size="sm" onClick={() => saveMove(w)}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                </span>
              ) : (
                <span className="flex flex-wrap items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(keyOf(w)); setNewDay(parseDay(w.day)); }}>Change day</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(w)}>Remove</Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-sm opacity-70">Nothing counted yet. Watched something already? Log it and it counts for the day you watched it.</div>
      )}
      {watches.length > SHOWN_AT_FIRST ? (
        <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer" : `Show all ${watches.length}`}</Button>
      ) : null}

      <Dialog open={logDay !== null} onOpenChange={(o) => { if (!o) onLogDay(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log a film I watched</DialogTitle>
          </DialogHeader>
          <LogForm initialDay={logDay} library={library} apiKey={apiKey} onUpdate={onUpdate} onAdd={onAdd} onClose={() => onLogDay(null)} />
        </DialogContent>
      </Dialog>
    </section>
  );
}
