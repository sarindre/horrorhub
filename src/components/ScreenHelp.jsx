import { useId, useState } from "react";
import { CircleHelp } from "lucide-react";
import { Button } from "./ui/button.jsx";
import { HELP } from "../lib/help.js";
import { usePersistentState } from "../lib/usePersistentState.js";

// "How this screen works": a short panel at the top of every screen. It opens by
// itself the first time you visit a screen (unless you've turned that off on the Help
// screen), and afterwards stays folded behind a small button. Give it a `key` of
// the view so each screen remembers its own state.
export function ScreenHelp({ view, onOpenHelp }) {
  const entry = HELP[view];
  const panelId = useId();
  const [autoOpen] = usePersistentState("help.autoOpen", true);
  const [seen, setSeen] = usePersistentState(`help.seen.${view}`, false);
  const [open, setOpen] = useState(autoOpen && !seen);
  if (!entry) return null;

  return (
    <div className="mx-auto mb-4 max-w-6xl px-3 sm:px-4 md:px-6">
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
          <CircleHelp className="mr-1 h-4 w-4" /> {open ? "Hide help" : "How this screen works"}
        </Button>
      </div>
      {open ? (
        <section id={panelId} aria-label={`Help: ${entry.title}`} className="mt-2 space-y-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 text-sm">
          <h3 className="text-base font-semibold">{entry.title}</h3>
          <p>{entry.what}</p>
          <ul className="list-disc space-y-1 pl-5">
            {entry.points.map((p) => <li key={p}>{p}</li>)}
          </ul>
          {entry.tips.length ? (
            <ul className="space-y-1 text-xs opacity-80">
              {entry.tips.map((t) => <li key={t}>Tip: {t}</li>)}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => { setSeen(true); setOpen(false); }}>Got it</Button>
            <Button size="sm" variant="outline" onClick={onOpenHelp}>More help</Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
