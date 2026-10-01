import { Check } from "lucide-react";
import { Card, CardContent } from "./ui/card.jsx";
import { Button } from "./ui/button.jsx";
import { nextStep } from "../lib/onboarding.js";

// First-run guide: one clear next step with a button that takes you there, a progress bar,
// and the whole list one click away. Steps tick themselves off as you go.
export function GettingStarted({ steps, onGo, onDismiss }) {
  const next = nextStep(steps);
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  return (
    <Card className="mb-6 rounded-2xl border-red-500/40">
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-lg font-semibold">Welcome to HorrorHub</div>
            <div className="text-sm opacity-70">Your personal horror library. Everything stays in this browser. {doneCount} of {steps.length} steps done.</div>
          </div>
          <Button size="sm" variant="ghost" onClick={onDismiss}>Hide this</Button>
        </div>

        <div role="progressbar" aria-label="Getting started progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-1.5 overflow-hidden rounded bg-white/10">
          <div className="h-full rounded bg-red-600 transition-all" style={{ width: `${pct}%` }} />
        </div>

        {next ? (
          <div className="space-y-2 rounded-xl bg-red-500/10 p-3">
            <div className="text-xs uppercase tracking-wide opacity-70">Next step{next.optional ? " (optional)" : ""}</div>
            <div className="text-base font-semibold">{next.title}</div>
            <div className="text-sm opacity-80">{next.detail}</div>
            <div className="flex flex-wrap gap-2">
              {next.actions.map((a, i) => (
                <Button key={a.label} size="sm" variant={i === 0 ? "default" : "outline"} onClick={() => onGo(a.tab, a.intent)}>{a.label}</Button>
              ))}
            </div>
          </div>
        ) : null}

        <details className="text-sm">
          <summary className="cursor-pointer opacity-80">See all steps</summary>
          <ol className="mt-2 space-y-2">
            {steps.map((s, i) => (
              <li key={s.id} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${s.done ? "border-emerald-500 bg-emerald-600 text-white" : "opacity-70"}`}
                >
                  {s.done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className={s.done ? "line-through opacity-60" : ""}>
                  {s.title}
                  {s.optional ? <span className="ml-2 text-xs opacity-60">optional</span> : null}
                  <span className="sr-only">{s.done ? " (done)" : ""}</span>
                </span>
              </li>
            ))}
          </ol>
        </details>
      </CardContent>
    </Card>
  );
}
