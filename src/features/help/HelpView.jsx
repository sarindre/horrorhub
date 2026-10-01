import { useMemo, useState } from "react";
import { LifeBuoy } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { FAQ, GLOSSARY, HELP, SHORTCUTS, searchHelp } from "../../lib/help.js";
import { NAV, VIEW_IDS } from "../../lib/nav.js";
import { setPref } from "../../lib/prefs.js";
import { usePersistentState } from "../../lib/usePersistentState.js";
import { useToast } from "../../lib/toastContext.js";

const SCREEN_ORDER = NAV.flatMap((g) => g.views.map((v) => v.id)).filter((id) => id !== "help");
const labelFor = (id) => NAV.flatMap((g) => g.views).find((v) => v.id === id)?.label || id;

// Everything explained in one place: how each screen works, the words you'll see,
// answers to common questions, and the switch for first-visit tips.
export function HelpView({ onGo }) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [autoOpen, setAutoOpen] = usePersistentState("help.autoOpen", true);
  const found = useMemo(() => searchHelp(query, { views: SCREEN_ORDER }), [query]);
  const nothing = !found.screens.length && !found.glossary.length && !found.faq.length;

  const showTipsAgain = () => {
    for (const id of VIEW_IDS) setPref(`help.seen.${id}`, false);
    setAutoOpen(true);
    toast("Tips will open again the first time you visit each screen.", { kind: "success" });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-3 sm:px-4 md:px-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold"><LifeBuoy className="h-5 w-5" /> Help</h2>
        <p className="text-sm opacity-70">HorrorHub is a private horror library that lives on your device. Here's how everything works.</p>
      </div>

      <Input aria-label="Search help" placeholder="Search help: scare level, backup, streak, token…" value={query} onChange={(e) => setQuery(e.target.value)} />

      {!query ? (
        <Card className="rounded-2xl">
          <CardContent className="space-y-3 p-4 text-sm">
            <div className="font-semibold">Getting started</div>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Add your free TMDb token (Settings → Connections) so search, posters and suggestions work.</li>
              <li>Add films: search in Browse, or import your history from Letterboxd or IMDb in Settings.</li>
              <li>Rate a few you've seen, and take the 60-second taste quiz on Tonight.</li>
              <li>Open Tonight for a pick. Set your comfort limits in Settings, and a backup folder so your library is safe.</li>
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {found.screens.length ? (
        <section aria-label="Screens" className="space-y-2">
          <h3 className="text-sm uppercase tracking-wide opacity-80">The screens</h3>
          <ul className="space-y-2">
            {found.screens.map((id) => (
              <li key={id}>
                <details className="rounded-xl border p-3" open={!!query}>
                  <summary className="cursor-pointer font-medium">{labelFor(id)}<span className="font-normal opacity-70"> · {HELP[id].what}</span></summary>
                  <div className="mt-3 space-y-2 text-sm">
                    <ul className="list-disc space-y-1 pl-5">{HELP[id].points.map((p) => <li key={p}>{p}</li>)}</ul>
                    {HELP[id].tips.map((t) => <div key={t} className="text-xs opacity-80">Tip: {t}</div>)}
                    <Button size="sm" variant="outline" onClick={() => onGo(id)}>Open {labelFor(id)}</Button>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {found.glossary.length ? (
        <section aria-label="Words you'll see" className="space-y-2">
          <h3 className="text-sm uppercase tracking-wide opacity-80">Words you'll see</h3>
          <dl className="space-y-3 text-sm">
            {found.glossary.map((g) => (
              <div key={g.term}>
                <dt className="font-semibold">{g.term}</dt>
                <dd className="opacity-80">{g.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {found.faq.length ? (
        <section aria-label="Questions" className="space-y-2">
          <h3 className="text-sm uppercase tracking-wide opacity-80">Questions</h3>
          <ul className="space-y-2">
            {found.faq.map((f) => (
              <li key={f.q}>
                <details className="rounded-xl border p-3" open={!!query}>
                  <summary className="cursor-pointer font-medium">{f.q}</summary>
                  <p className="mt-2 text-sm opacity-80">{f.a}</p>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {nothing ? <div className="text-sm opacity-70">Nothing in the help matches “{query}”. Try a shorter word.</div> : null}

      {!query ? (
        <>
          <section aria-label="Keyboard and links" className="space-y-2">
            <h3 className="text-sm uppercase tracking-wide opacity-80">Keyboard and links</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm opacity-80">{SHORTCUTS.map((s) => <li key={s}>{s}</li>)}</ul>
          </section>

          <section aria-label="Tips" className="space-y-2 border-t pt-4">
            <h3 className="text-sm uppercase tracking-wide opacity-80">First-visit tips</h3>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!autoOpen} onChange={(e) => setAutoOpen(e.target.checked)} />
              Open a short tip the first time I visit each screen
            </label>
            <Button size="sm" variant="outline" onClick={showTipsAgain}>Show every tip again</Button>
            <div className="text-xs opacity-60">Every screen also has a "How this screen works" button at the top.</div>
          </section>
        </>
      ) : null}
    </div>
  );
}
