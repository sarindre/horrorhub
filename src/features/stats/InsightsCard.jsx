import { useMemo } from "react";
import { Lightbulb } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { computeInsights } from "../../lib/insights.js";

// What your library says about you, in plain sentences. Each one shows how many
// films or watches it rests on, so you can judge how much to trust it.
export function InsightsCard({ items, longAgoYear }) {
  const result = useMemo(() => computeInsights(items, { longAgoYear }), [items, longAgoYear]);
  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-3 p-6">
        <div className="flex items-center gap-2 text-lg font-semibold"><Lightbulb className="h-5 w-5" /> What your habits say</div>
        {result.insights.length ? (
          <ul className="space-y-3">
            {result.insights.map((i) => (
              <li key={i.id} className="rounded-xl bg-muted p-3">
                <div>{i.text}</div>
                <div className="mt-1 text-xs opacity-60">Based on {i.evidence}</div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm opacity-70">{result.hint}</div>
        )}
        {result.insights.length ? <div className="text-xs opacity-60">These describe what you've logged so far. They shift as you rate and watch more.</div> : null}
      </CardContent>
    </Card>
  );
}
