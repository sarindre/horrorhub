import { Check } from "lucide-react";
import { Card, CardContent } from "./ui/card.jsx";
import { Button } from "./ui/button.jsx";
import { nextStep } from "../lib/onboarding.js";

// First-run checklist. Each unfinished step has a button that jumps to the
// right place; the next thing to do is highlighted.
export function GettingStarted({ steps, onGo, onDismiss }) {
  const next = nextStep(steps);
  const doneCount = steps.filter((s) => s.done).length;
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
        <ol className="space-y-3">
          {steps.map((s, i) => {
            const isNext = next?.id === s.id;
            return (
              <li key={s.id} className={`flex gap-3 rounded-xl p-2 ${isNext ? "bg-red-500/10" : ""}`}>
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${s.done ? "border-emerald-500 bg-emerald-600 text-white" : "opacity-70"}`}
                >
                  {s.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium ${s.done ? "line-through opacity-60" : ""}`}>
                    {s.title}
                    {s.optional ? <span className="ml-2 text-xs font-normal opacity-60">optional</span> : null}
                    <span className="sr-only">{s.done ? " (done)" : ""}</span>
                  </div>
                  {!s.done ? <div className="text-sm opacity-70">{s.detail}</div> : null}
                </div>
                {!s.done ? (
                  <Button size="sm" variant={isNext ? "default" : "outline"} onClick={() => onGo(s.action.tab)}>{s.action.label}</Button>
                ) : null}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
