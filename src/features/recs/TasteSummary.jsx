import { Sparkles } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { isLearning } from "../../lib/taste.js";

// What HorrorHub has learned about your taste, so suggestions don't feel like magic.
export function TasteSummary({ profile, onUseScare }) {
  const { signalCount, likedTags, lovedMoods, scarePref } = profile;
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm uppercase tracking-wide opacity-80">
          <Sparkles className="h-4 w-4" /> Your taste
        </div>
        {signalCount === 0 ? (
          <div className="text-sm opacity-70">Rate or log a few films and HorrorHub will learn what you like, then use it to rank suggestions.</div>
        ) : (
          <div className="space-y-1 text-sm">
            <div className="opacity-70">
              Learned from {signalCount} film{signalCount === 1 ? "" : "s"} you rated or watched.
              {isLearning(profile) ? " Rate a few more to sharpen it." : ""}
            </div>
            {lovedMoods.length ? (
              <div>
                <span className="opacity-70">You lean: </span>
                {lovedMoods.map((m) => m.label).join(", ")}
              </div>
            ) : null}
            {likedTags.length ? (
              <div>
                <span className="opacity-70">Favorite tags: </span>
                {likedTags.map((t) => `#${t.tag}`).join(", ")}
              </div>
            ) : null}
            {scarePref != null ? (
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  <span className="opacity-70">Usual scare level: </span>
                  {Math.round(scarePref)}/10
                </span>
                <Button size="sm" variant="outline" onClick={() => onUseScare?.(Math.round(scarePref))}>
                  Match my usual
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
