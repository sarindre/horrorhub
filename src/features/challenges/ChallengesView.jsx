import { useMemo } from "react";
import { CalendarClock, Flame } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { ChallengeCard } from "./ChallengeCard.jsx";
import { CHALLENGE_TEMPLATES, evaluateChallenge, seasonalTemplates, watchStreak } from "../../lib/challenges.js";
import { buildTasteProfile } from "../../lib/taste.js";

// Themed goals with progress tracked from your watch dates. `store` is the
// useChallenges() result; the app owns it so exports and imports can include it.
export function ChallengesView({ library, store, apiKey, onUpdate, onAdd, onOpenDetails }) {
  const { challenges, start, remove } = store;
  const now = new Date();
  const profile = useMemo(() => buildTasteProfile(library), [library]);

  const evaluated = challenges.map((challenge) => ({ challenge, result: evaluateChallenge(challenge, library, now) }));
  const live = evaluated.filter((e) => e.result.status === "active" || e.result.status === "upcoming");
  const finished = evaluated
    .filter((e) => e.result.status === "completed" || e.result.status === "expired")
    .sort((a, b) => b.challenge.endDate.localeCompare(a.challenge.endDate));
  const liveTemplateIds = new Set(live.map((e) => e.challenge.templateId));

  const streak = watchStreak(library, now);
  const inSeason = seasonalTemplates(now).filter((s) => !liveTemplateIds.has(s.template.id));
  const available = CHALLENGE_TEMPLATES.filter((t) => !liveTemplateIds.has(t.id));

  const card = (e) => (
    <ChallengeCard
      key={e.challenge.id}
      challenge={e.challenge}
      result={e.result}
      library={library}
      profile={profile}
      apiKey={apiKey}
      onUpdate={onUpdate}
      onAdd={onAdd}
      onOpenDetails={onOpenDetails}
      onRemove={remove}
    />
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-3 sm:px-4 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-lg font-semibold">Challenges</div>
        <div className="flex items-center gap-2 text-sm">
          <Flame className="h-4 w-4" />
          Watch streak {streak.current} day{streak.current === 1 ? "" : "s"}
          <span className="opacity-60">· best {streak.longest}</span>
        </div>
      </div>

      {inSeason.length ? (
        <Card className="rounded-2xl border-red-500/40">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm uppercase tracking-wide opacity-80">
              <CalendarClock className="h-4 w-4" /> In season
            </div>
            {inSeason.map(({ template, reason }) => (
              <div key={template.id} className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{template.title}</div>
                  <div className="text-xs opacity-70">{reason}. {template.blurb}</div>
                </div>
                <Button size="sm" onClick={() => start(template.id)}>Start</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        <div className="text-sm uppercase tracking-wide opacity-80">Your challenges</div>
        {live.length ? (
          <div className="grid gap-4 lg:grid-cols-2">{live.map(card)}</div>
        ) : (
          <div className="text-sm opacity-70">Nothing in progress. Pick one below and HorrorHub will track it as you log watches.</div>
        )}
      </div>

      <div className="space-y-3">
        <div className="text-sm uppercase tracking-wide opacity-80">Start a challenge</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((t) => (
            <Card key={t.id} className="rounded-xl">
              <CardContent className="p-3 flex h-full flex-col justify-between gap-2">
                <div>
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs opacity-70">{t.blurb}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => start(t.id)}>Start</Button>
              </CardContent>
            </Card>
          ))}
          {!available.length ? <div className="text-sm opacity-70">You're running every challenge. Impressive.</div> : null}
        </div>
      </div>

      {finished.length ? (
        <div className="space-y-3">
          <div className="text-sm uppercase tracking-wide opacity-80">Finished</div>
          <div className="grid gap-4 lg:grid-cols-2">{finished.map(card)}</div>
        </div>
      ) : null}
    </div>
  );
}
