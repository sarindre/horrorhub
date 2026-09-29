import { useId, useState } from "react";
import { Library } from "lucide-react";
import { Button } from "./ui/button.jsx";
import { Input } from "./ui/input.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog.jsx";
import { hasFilm } from "../lib/shelves.js";

// "Add to a shelf": tick the shelves this film belongs on, or start a new one.
export function AddToShelfDialog({ film, store }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const baseId = useId();
  const count = store.shelves.filter((s) => hasFilm(s, film.id)).length;

  const toggle = (shelf) => (hasFilm(shelf, film.id) ? store.removeFilm(shelf.id, film.id) : store.addFilm(shelf.id, film));
  const createAndAdd = () => {
    if (store.create({ name, films: [film] })) setName("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm" variant="outline">
          <Library className="h-4 w-4 mr-1" />
          Shelves{count ? ` (${count})` : ""}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to a shelf</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {store.shelves.length ? (
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {store.shelves.map((shelf) => (
                <li key={shelf.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" id={`${baseId}-${shelf.id}`} checked={hasFilm(shelf, film.id)} onChange={() => toggle(shelf)} />
                    <span className="flex-1">{shelf.name}</span>
                    <span className="opacity-60">{shelf.films.length} film{shelf.films.length === 1 ? "" : "s"}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm opacity-70">You don't have any shelves yet. Start one below.</div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="New shelf name"
              aria-label="New shelf name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createAndAdd(); }}
            />
            <Button onClick={createAndAdd} disabled={!name.trim()}>Create &amp; add</Button>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>Done</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
