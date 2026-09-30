import { useMemo, useRef, useState } from "react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { useToast } from "../../lib/toastContext.js";
import { useContentPrefs } from "../../lib/contentContext.js";
import { buildTasteProfile } from "../../lib/taste.js";
import { parseShelfPayload, smartShelves, snapshotFilm } from "../../lib/shelves.js";
import { FilmTile, ShelfCover } from "./ShelfParts.jsx";
import { ShelfDetail } from "./ShelfDetail.jsx";

// Your shelves (lists you make) and curated collections (built from your taste).
// `store` is the useShelves() result; the app owns it so backups and imports include shelves.
export function ShelvesView({ library, store, apiKey, onUpdate, onAdd, onOpenDetails }) {
  const toast = useToast();
  const prefs = useContentPrefs();
  const fileRef = useRef(null);
  const [openId, setOpenId] = useState(null);
  const [name, setName] = useState("");

  const profile = useMemo(() => buildTasteProfile(library), [library]);
  const curated = useMemo(() => smartShelves(library, { profile, prefs }), [library, profile, prefs]);
  const open = store.shelves.find((s) => s.id === openId);

  if (open) {
    return (
      <div className="mx-auto max-w-4xl px-3 sm:px-4 md:px-6">
        <ShelfDetail shelf={open} library={library} store={store} apiKey={apiKey} onUpdate={onUpdate} onAdd={onAdd} onOpenDetails={onOpenDetails} onBack={() => setOpenId(null)} />
      </div>
    );
  }

  const create = () => {
    const shelf = store.create({ name });
    if (shelf) {
      setName("");
      setOpenId(shelf.id);
    }
  };

  const saveCurated = (shelf) => {
    const saved = store.create({ name: shelf.title, description: shelf.blurb, films: shelf.films.map((f) => snapshotFilm(f.item)) });
    if (saved) toast(`Saved "${saved.name}" to your shelves.`, { kind: "success" });
  };
  const watchlistCurated = (shelf) => {
    shelf.films.forEach((f) => onUpdate?.({ ...f.item, watchlist: true }));
    toast(`Added ${shelf.films.length} films to your watchlist.`, { kind: "success" });
  };

  const importFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      let payload;
      try {
        payload = JSON.parse(String(reader.result || ""));
      } catch {
        return toast("That file isn't valid JSON.", { kind: "error" });
      }
      const { shelves, skipped } = parseShelfPayload(payload);
      if (!shelves.length) return toast("No shelves found in that file.", { kind: "error" });
      const added = store.merge(shelves);
      toast(
        added ? `Imported ${added} shelf${added === 1 ? "" : "s"}.${skipped ? ` ${skipped} couldn't be read.` : ""}` : "You already have that shelf.",
        { kind: added ? "success" : "info" }
      );
    };
    reader.readAsText(file);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-3 sm:px-4 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-lg font-semibold">Shelves</div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="New shelf name"
            aria-label="New shelf name"
            className="w-56"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") create(); }}
          />
          <Button size="sm" onClick={create} disabled={!name.trim()}>Create shelf</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Import a shelf file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
              e.target.value = "";
            }}
          />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>Import shelf</Button>
        </div>
      </div>

      {store.shelves.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {store.shelves.map((shelf) => (
            <button key={shelf.id} type="button" onClick={() => setOpenId(shelf.id)} className="min-w-0 text-left" aria-label={`Open shelf ${shelf.name}`}>
              <Card className="h-full rounded-2xl transition-colors hover:border-red-500/60">
                <CardContent className="flex gap-3 p-3">
                  <ShelfCover films={shelf.films} className="h-24 w-20 shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{shelf.name}</div>
                    <div className="text-xs opacity-60">{shelf.films.length} film{shelf.films.length === 1 ? "" : "s"}</div>
                    {shelf.description ? <div className="mt-1 line-clamp-2 text-sm opacity-80">{shelf.description}</div> : null}
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border p-6 text-center text-sm">
          <div className="mb-1 text-base font-medium">No shelves yet</div>
          <div className="opacity-70">Make one above (a "Halloween marathon", "Comfort horror", "Films to show a friend"), or save one of the collections below. You can also file any film from its page with the Shelves button.</div>
        </div>
      )}

      <div className="space-y-4">
        <div className="text-sm uppercase tracking-wide opacity-80">Curated for you</div>
        {curated.length ? (
          curated.map((shelf) => (
            <section key={shelf.id} aria-label={shelf.title} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="font-medium">{shelf.title}</div>
                  <div className="text-xs opacity-60">{shelf.blurb}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => saveCurated(shelf)}>Save as shelf</Button>
                  <Button size="sm" variant="ghost" onClick={() => watchlistCurated(shelf)}>Add to watchlist</Button>
                </div>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {shelf.films.map(({ item, reasons }) => (
                  <FilmTile key={item.id} item={item} reasons={reasons} onOpen={onOpenDetails} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="text-sm opacity-70">
            Rate and tag a few films and HorrorHub will build collections here: what to watch next in the mood you love most, your best of each subgenre, and favorites due for a rewatch.
          </div>
        )}
      </div>
    </div>
  );
}
