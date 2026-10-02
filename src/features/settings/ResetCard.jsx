import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { Label } from "../../components/ui/label.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog.jsx";
import { CONFIRM_WORD, resetApp } from "../../lib/reset.js";
import { plural } from "../../lib/text.js";

// "Reset app": erase everything HorrorHub keeps in this browser. It can't be undone, so
// it says exactly what will go, offers a backup first, and needs the word RESET typed.
// `counts` is { films, shelves, challenges, plans }; `resetFn` is injectable for tests.
export function ResetCard({ counts, onExportNow, onBeforeReset, resetFn = resetApp }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [keepSettings, setKeepSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const ready = typed.trim().toUpperCase() === CONFIRM_WORD && !busy;

  const change = (next) => {
    if (busy) return;
    if (next) {
      setTyped("");
      setKeepSettings(false);
    }
    setOpen(next);
  };
  const erase = async () => {
    setBusy(true);
    try {
      await onBeforeReset?.(); // stop automatic backups first so nothing writes after the reset
    } catch {
      /* the reset goes ahead regardless */
    }
    await resetFn({ keepSettings });
  };

  const parts = [
    counts.films ? plural(counts.films, "film") + " with your ratings, tags, notes and watch dates" : "",
    counts.shelves ? plural(counts.shelves, "shelf") : "",
    counts.challenges ? plural(counts.challenges, "challenge") : "",
    counts.plans ? plural(counts.plans, "saved plan") : "",
  ].filter(Boolean);

  return (
    <div className="space-y-3 rounded-2xl border border-red-500/40 bg-red-950/10 p-6">
      <div className="flex items-center gap-2 text-lg font-semibold text-red-300"><TriangleAlert className="h-5 w-5" /> Reset app</div>
      <div className="text-sm opacity-80">Erases everything HorrorHub has stored on this device and starts fresh, as if you'd just opened it for the first time. You'll be asked to confirm, and you can export a backup first.</div>
      <Dialog open={open} onOpenChange={change}>
        <DialogTrigger>
          <Button variant="outline" className="border-red-500/60 text-red-300">Reset app…</Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset HorrorHub?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-1 text-sm">
            <p>This permanently erases from this browser: {parts.length ? parts.join(", ") : "your library"}, your settings and API keys, your taste quiz answers, and the saved poster images. It can't be undone.</p>
            <p className="opacity-80">Files in your backup folder, and anything you've exported, are not touched.</p>
            {counts.films ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={onExportNow}>Export a backup first</Button>
                <span className="text-xs opacity-70">Downloads a file you can import again later.</span>
              </div>
            ) : null}
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={keepSettings} onChange={(e) => setKeepSettings(e.target.checked)} />
              <span>Keep my settings and API keys (comfort limits, region, TMDb token). My taste quiz answers are still cleared.</span>
            </label>
            <div className="space-y-1">
              <Label htmlFor="reset-confirm">Type {CONFIRM_WORD} to confirm</Label>
              <Input id="reset-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" autoFocus onClick={() => change(false)} disabled={busy}>Cancel</Button>
              <Button className="bg-red-600 text-white hover:bg-red-500" onClick={erase} disabled={!ready}>{busy ? "Erasing…" : "Erase everything"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
