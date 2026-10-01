import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Badge } from "../../components/ui/badge.jsx";
import { badgesFor, levelFor, xpFor } from "../../lib/progress.js";

// Your rank, earned from XP (10 per watch, plus streak days), and the badges
// you've earned or are close to.
export function LevelCard({ items, longAgoYear }) {
  const { xp, level, badges } = useMemo(() => {
    const xp = xpFor(items, { longAgoYear });
    return { xp, level: levelFor(xp), badges: badgesFor(items, { longAgoYear }) };
  }, [items, longAgoYear]);
  const earned = badges.filter((b) => b.earned).length;

  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2 text-lg font-semibold"><Trophy className="h-5 w-5" /> Rank and badges</div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <span className="text-xs uppercase tracking-wide opacity-70">Level {level.number}</span>
              <div className="text-2xl font-bold">{level.name}</div>
            </div>
            <div className="text-sm opacity-80"><span className="font-semibold tabular-nums">{xp}</span> XP</div>
          </div>
          <div role="progressbar" aria-label={`Progress to ${level.next?.name || "the top"}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={level.pct} className="h-2 overflow-hidden rounded bg-white/10">
            <div className="h-full rounded bg-red-600 transition-all" style={{ width: `${level.pct}%` }} />
          </div>
          <div className="text-xs opacity-70">
            {level.next ? `${level.toNext} XP to ${level.next.name}.` : "You've reached the top rank."} Each logged watch is 10 XP, and every day of a live streak after the first adds 5.
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm opacity-80">{earned} of {badges.length} badges</div>
          <ul className="flex flex-wrap gap-2 text-sm">
            {badges.map((b) => (
              <li key={b.id}>
                <Badge variant={b.earned ? "default" : "secondary"}>
                  {b.label} {b.earned ? "✓" : <span className="opacity-70">{b.have}/{b.need}</span>}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
