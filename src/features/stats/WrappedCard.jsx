import { useMemo, useState } from "react";
import { Download, Copy, Gift } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { useToast } from "../../lib/toastContext.js";
import { scareBias } from "../../lib/scare.js";
import { buildWrapped, defaultWrappedYear, wrappedText, wrappedYears } from "../../lib/wrapped.js";
import { wrappedBlob } from "../../lib/wrappedImage.js";
import { downloadBlob } from "../../lib/download.js";
import { plural } from "../../lib/text.js";

const Stat = ({ value, label }) => (
  <div className="rounded-xl bg-muted p-3">
    <div className="text-2xl font-bold tabular-nums">{value}</div>
    <div className="text-xs opacity-70">{label}</div>
  </div>
);

// Your year in horror: the numbers, a personality, and a card you can save or share.
export function WrappedCard({ items, longAgoYear }) {
  const toast = useToast();
  const years = useMemo(() => wrappedYears(items, { longAgoYear }), [items, longAgoYear]);
  const [picked, setPicked] = useState(null);
  const year = picked && years.includes(picked) ? picked : defaultWrappedYear(items, { longAgoYear });
  const wrapped = useMemo(() => (year ? buildWrapped(items, year, { longAgoYear, bias: scareBias(items) }) : null), [items, year, longAgoYear]);
  const [busy, setBusy] = useState(false);

  if (!wrapped) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="space-y-2 p-6">
          <div className="flex items-center gap-2 text-lg font-semibold"><Gift className="h-5 w-5" /> Horror Wrapped</div>
          <div className="text-sm opacity-70">Log some watch dates and your year in horror shows up here, with a card you can save and share.</div>
        </CardContent>
      </Card>
    );
  }

  const saveImage = async () => {
    setBusy(true);
    try {
      downloadBlob(await wrappedBlob(wrapped), `horrorhub-wrapped-${wrapped.year}.png`);
    } catch (err) {
      toast(err?.message || "Couldn't make the image.", { kind: "error" });
    } finally {
      setBusy(false);
    }
  };
  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(wrappedText(wrapped));
      toast("Copied. Paste it anywhere.", { kind: "success" });
    } catch {
      toast("Couldn't copy. Your browser may block clipboard access here.", { kind: "error" });
    }
  };

  return (
    <Card className="rounded-2xl border-red-500/30">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-lg font-semibold"><Gift className="h-5 w-5" /> Horror Wrapped</div>
          {years.length > 1 ? (
            <label className="flex items-center gap-2 text-sm">
              Year
              <select value={wrapped.year} onChange={(e) => setPicked(Number(e.target.value))} className="h-8 rounded-md border bg-transparent px-2 text-sm">
                {years.map((y) => <option key={y} value={y} className="text-black">{y}</option>)}
              </select>
            </label>
          ) : null}
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide opacity-70">Your {wrapped.year} in horror</div>
          <div className="text-2xl font-bold">{wrapped.personality.title}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value={wrapped.films} label={wrapped.films === 1 ? "film" : "films"} />
          <Stat value={wrapped.hours} label={wrapped.estimatedHours ? "hours (est.)" : "hours"} />
          <Stat value={wrapped.newFilms} label="new to you" />
          <Stat value={wrapped.longestStreak} label={wrapped.longestStreak === 1 ? "day, best streak" : "days, best streak"} />
        </div>

        <ul className="space-y-1 text-sm">
          {wrapped.topTags.length ? <li><span className="opacity-70">Most watched: </span>{wrapped.topTags.map((t) => `#${t.tag}`).join(" ")}</li> : null}
          <li><span className="opacity-70">Scariest: </span>{wrapped.scariest.title}{wrapped.scariest.year ? ` (${wrapped.scariest.year})` : ""}, {wrapped.scariest.scare}/10{wrapped.scariest.estimated ? " (est.)" : ""}</li>
          {wrapped.topRated.length ? <li><span className="opacity-70">Top rated: </span>{wrapped.topRated.map((f) => `${f.title} ${f.rating}★`).join(", ")}</li> : null}
          <li><span className="opacity-70">Busiest month: </span>{wrapped.busiestMonth.name} ({plural(wrapped.busiestMonth.count, "watch")}) · <span className="opacity-70">Favorite night: </span>{wrapped.favoriteDay.name}s</li>
          {wrapped.bigNight ? <li><span className="opacity-70">Biggest night: </span>{plural(wrapped.bigNight.count, "film")} in one sitting</li> : null}
          {wrapped.oldest ? <li><span className="opacity-70">Oldest film: </span>{wrapped.oldest.title} ({wrapped.oldest.year})</li> : null}
        </ul>

        <div className="flex flex-wrap gap-2">
          <Button onClick={saveImage} disabled={busy}><Download className="mr-1 h-4 w-4" /> {busy ? "Drawing…" : "Save as image"}</Button>
          <Button variant="outline" onClick={copyText}><Copy className="mr-1 h-4 w-4" /> Copy as text</Button>
        </div>
        <div className="text-xs opacity-60">Made on your device. Nothing is uploaded; the image holds only what's on this card.</div>
      </CardContent>
    </Card>
  );
}
