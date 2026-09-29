import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Film } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { Textarea } from "../../components/ui/textarea.jsx";
import { ContentWarnings } from "../../components/ContentWarnings.jsx";
import { useToast } from "../../lib/toastContext.js";
import { useContentPrefs } from "../../lib/contentContext.js";
import { itemFlags } from "../../lib/contentFlags.js";
import { downloadBlob, slugify } from "../../lib/download.js";
import { MAX_DESCRIPTION, MAX_NAME, entriesWithItems, hasFilm, shelfExport, shelfToText, snapshotFilm } from "../../lib/shelves.js";
import { TMDB_IMG, describeError, isAbort, mapMovie } from "../../lib/tmdb.js";
import { searchTmdb } from "../../lib/tmdbMatch.js";

// Find films to add: your library instantly, TMDb on request (so a shelf can hold films you don't own yet).
function AddFilms({ shelf, library, apiKey, onAdd }) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState(null);
  const [busy, setBusy] = useState(false);

  const q = query.trim().toLowerCase();
  const local = q ? library.filter((i) => !hasFilm(shelf, i.id) && i.title.toLowerCase().includes(q)).slice(0, 6) : [];

  const search = async () => {
    setBusy(true);
    try {
      setRemote((await searchTmdb(query, { apiKey })).map(mapMovie).filter((m) => !hasFilm(shelf, m.id)));
    } catch (err) {
      if (!isAbort(err)) toast(describeError(err), { kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  const row = (film, key) => (
    <li key={key} className="flex items-center justify-between gap-2 text-sm">
      <span className="min-w-0 truncate">
        {film.title}
        {film.year ? <span className="opacity-60"> ({film.year})</span> : null}
      </span>
      <Button size="sm" variant="outline" onClick={() => onAdd(film)}>Add</Button>
    </li>
  );

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">Add films</div>
      <div className="flex gap-2">
        <Input
          placeholder="Search your library by title"
          aria-label="Search films to add"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setRemote(null); }}
          onKeyDown={(e) => { if (e.key === "Enter" && apiKey && query.trim()) search(); }}
        />
        {apiKey ? <Button size="sm" variant="outline" onClick={search} disabled={busy || !query.trim()}>{busy ? "Searching…" : "Search TMDb"}</Button> : null}
      </div>
      {local.length ? <ul className="space-y-1.5">{local.map((f) => row(f, `l-${f.id}`))}</ul> : null}
      {remote ? (
        remote.length ? (
          <div className="space-y-1.5">
            <div className="text-xs opacity-60">From TMDb</div>
            <ul className="space-y-1.5">{remote.map((f) => row(f, `t-${f.id}`))}</ul>
          </div>
        ) : (
          <div className="text-xs opacity-60">Nothing new on TMDb for that search.</div>
        )
      ) : null}
      {q && !local.length && !remote ? <div className="text-xs opacity-60">No matches in your library.{apiKey ? " Try Search TMDb." : ""}</div> : null}
    </div>
  );
}

export function ShelfDetail({ shelf, library, store, apiKey, onUpdate, onAdd, onOpenDetails, onBack }) {
  const toast = useToast();
  const prefs = useContentPrefs();
  const rows = entriesWithItems(shelf, library);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(shelfToText(shelf));
      toast("Copied the list to your clipboard.", { kind: "success" });
    } catch {
      toast("Couldn't copy. Use Export file instead.", { kind: "error" });
    }
  };
  const exportFile = () => downloadBlob(new Blob([JSON.stringify(shelfExport(shelf), null, 2)], { type: "application/json" }), `horrorhub-shelf-${slugify(shelf.name)}.json`);
  const watchlistAll = () => {
    rows.forEach(({ entry, item }) => (item ? onUpdate?.({ ...item, watchlist: true }) : onAdd?.({ ...entry, watchlist: true })));
    toast(`Added ${rows.length} film${rows.length === 1 ? "" : "s"} to your watchlist.`, { kind: "success" });
  };
  const deleteShelf = () => {
    if (!window.confirm(`Delete the shelf "${shelf.name}"? The films stay in your library.`)) return;
    store.remove(shelf.id);
    onBack();
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-1" /> All shelves
      </Button>

      <Card className="rounded-2xl">
        <CardContent className="space-y-3 p-4">
          <Input
            key={`name-${shelf.id}`}
            aria-label="Shelf name"
            defaultValue={shelf.name}
            maxLength={MAX_NAME}
            className="text-lg font-semibold"
            onBlur={(e) => {
              store.edit(shelf.id, { name: e.target.value });
              if (!e.target.value.trim()) e.target.value = shelf.name; // a shelf can't lose its name
            }}
          />
          <Textarea
            key={`desc-${shelf.id}`}
            aria-label="Shelf description"
            defaultValue={shelf.description}
            maxLength={MAX_DESCRIPTION}
            rows={2}
            placeholder="What's this shelf for?"
            onBlur={(e) => store.edit(shelf.id, { description: e.target.value })}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={watchlistAll} disabled={!rows.length}>Add all to watchlist</Button>
            <Button size="sm" variant="outline" onClick={exportFile}>Export file</Button>
            <Button size="sm" variant="outline" onClick={copyText}>Copy as text</Button>
            <Button size="sm" variant="ghost" onClick={deleteShelf}>Delete shelf</Button>
          </div>
        </CardContent>
      </Card>

      {rows.length ? (
        <ol className="space-y-3">
          {rows.map(({ entry, item }, i) => (
            <li key={entry.id} className="flex items-center gap-3 rounded-xl border p-3">
              <span className="w-5 text-right text-sm opacity-50">{i + 1}</span>
              {entry.poster ? (
                <img src={TMDB_IMG(entry.poster, "w92")} alt="" loading="lazy" decoding="async" className="h-16 w-11 rounded object-cover" />
              ) : (
                <div className="flex h-16 w-11 items-center justify-center rounded bg-white/10"><Film className="h-4 w-4 opacity-50" /></div>
              )}
              <div className="min-w-0 flex-1">
                <button className="text-left font-medium hover:underline" onClick={() => onOpenDetails?.(item || entry)}>
                  {entry.title}
                </button>
                {entry.year ? <span className="opacity-60"> ({entry.year})</span> : null}
                <div className="flex flex-wrap gap-1.5 text-[11px] opacity-80">
                  {item ? (
                    <>
                      {item.rating ? <span>{item.rating}★</span> : null}
                      <span>{(item.watchedDates || []).length ? "Watched" : item.watchlist ? "On watchlist" : "In your library"}</span>
                    </>
                  ) : (
                    <span>Not in your library</span>
                  )}
                </div>
                {item ? <ContentWarnings flags={itemFlags(item)} avoid={prefs.avoidFlags} showFlags={prefs.showWarnings} /> : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1">
                {!item ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => onAdd?.(entry)}>Add to library</Button>
                    <Button size="sm" variant="outline" onClick={() => onAdd?.({ ...entry, watchlist: true })}>Watchlist</Button>
                  </>
                ) : null}
                <Button size="icon" variant="ghost" aria-label={`Move ${entry.title} up`} onClick={() => store.moveFilm(shelf.id, entry.id, -1)} disabled={i === 0}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label={`Move ${entry.title} down`} onClick={() => store.moveFilm(shelf.id, entry.id, 1)} disabled={i === rows.length - 1}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" aria-label={`Remove ${entry.title} from this shelf`} onClick={() => store.removeFilm(shelf.id, entry.id)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="text-sm opacity-70">This shelf is empty. Add films below, or use the Shelves button on any film's page.</div>
      )}

      <AddFilms shelf={shelf} library={library} apiKey={apiKey} onAdd={(film) => store.addFilm(shelf.id, snapshotFilm(film))} />
    </div>
  );
}
