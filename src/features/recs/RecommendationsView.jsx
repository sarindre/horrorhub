import { useMemo, useState } from "react";
import { Wand2, AlarmClock } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Slider } from "../../components/ui/slider.jsx";
import { MOOD_PRESETS, matchesMood } from "../../lib/moods.js";
import { useHybridRecommendations } from "../../hooks/useHybridRecommendations";
import { MovieCard } from "../../components/MovieCard.jsx";
import { useToast } from "../../lib/toastContext.js";
import { describeError, tmdbGet } from "../../lib/tmdb.js";

export function RecommendationsView({ items, apiKey, onAdd, onUpdate, onRemove, onOpenDetails, inLibraryIds, watchlistIds, mixer, ratingById }) {
  const toast = useToast();
  const [mood, setMood] = useState(5); // 0 = spooky, 10 = traumatizing
  const [moodPreset, setMoodPreset] = useState("all");

  const pool = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const isReleased = (i) => typeof i.year === "undefined" || Number(i.year) <= currentYear;
    const unwatched = (items || []).filter((i) => (i.watchedDates?.length || 0) === 0 && isReleased(i));
    if (unwatched.length) return unwatched;
    return (items || []).filter(isReleased);
  }, [items]);

  // Subgenre Mixer from settings (fallback to 1s)
  mixer = mixer || { ghosts: 1, occult: 1, slasher: 1, folk: 1 };

  const recs = useMemo(() => {
    const scored = pool.map((i) => {
      const s = i.scares ?? 5;
      const proximity = 1 - Math.min(1, Math.abs(mood - s) / 10); // 0..1
      const ratingBoost = ((i.rating || 0) / 5) * 0.3;
      const wlBoost = i.watchlist ? 0.2 : 0;
      const tags = (i.tags || []).map(t=>String(t).toLowerCase());
      const has = (arr)=>arr.some(t=>tags.includes(t));
      const ghostScore = has(['supernatural','haunted','possession']) ? mixer.ghosts : 0;
      const occultScore = has(['occult']) ? mixer.occult : 0;
      const slasherScore = has(['slasher','home-invasion']) ? mixer.slasher : 0;
      const folkScore = has(['folk-horror']) ? mixer.folk : 0;
      const presetBoost = moodPreset !== 'all' && matchesMood(i.tags || [], moodPreset) ? 0.65 : 0;
      const tagBoost = (ghostScore + occultScore + slasherScore + folkScore) * 0.15; // scaled
      const score = proximity * 0.6 + ratingBoost + wlBoost + tagBoost + presetBoost;
      return { item: i, score };
    });
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((x) => x.item);
  }, [pool, mood, moodPreset, mixer]);

  const { similarPicks, status, error, seedTitles } = useHybridRecommendations(items, apiKey, { moodId: moodPreset });
  const external = (similarPicks || [])
    .filter((r) => !inLibraryIds?.has(r.id))
    .slice(0, 12);

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-3 sm:px-4 md:px-6">
      <Card className="rounded-2xl">
        <CardContent className="p-4 flex flex-wrap items-center gap-4">
          <div className="text-sm whitespace-nowrap">How scared do you want to be tonight?</div>
          <div className="relative w-full max-w-3xl">
            <Slider value={[mood]} min={0} max={10} step={1} onValueChange={(v) => setMood(v[0])} className="w-full" />
            <div className="pointer-events-none absolute inset-0">
              <div className="flex justify-between text-xl px-1 select-none">
                <span role="img" aria-label="not scary">🥱</span>
                <span role="img" aria-label="terrifying">😱</span>
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 top-0 text-xl select-none">😐</div>
            </div>
          </div>
          <span className="text-sm opacity-80 w-28">{mood <= 3 ? "Spooky" : mood <= 6 ? "Intense" : "Traumatizing"}</span>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <div className="text-sm uppercase tracking-wide opacity-80">Night vibe</div>
          <div className="flex flex-wrap gap-2">
            {MOOD_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                size="sm"
                variant={moodPreset === preset.id ? "default" : "outline"}
                onClick={() => setMoodPreset(preset.id)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Mixer + Cold Night side-by-side on md+ */}
      <div className="grid gap-4 md:grid-cols-2">
      <Card className="rounded-2xl h-full">
        <CardContent className="p-4 h-full flex flex-col">
          <div className="text-sm font-semibold mb-2">Subgenre Mixer</div>
          <div className="grid sm:grid-cols-2 gap-4 text-xs opacity-80 items-center">
            <div className="flex items-center gap-2"><span>Ghosts</span><input type="range" min="0" max="2" step="1" defaultValue={mixer.ghosts} onChange={(e)=>{ mixer.ghosts = Number(e.target.value); }} /></div>
            <div className="flex items-center gap-2"><span>Occult</span><input type="range" min="0" max="2" step="1" defaultValue={mixer.occult} onChange={(e)=>{ mixer.occult = Number(e.target.value); }} /></div>
            <div className="flex items-center gap-2"><span>Slasher</span><input type="range" min="0" max="2" step="1" defaultValue={mixer.slasher} onChange={(e)=>{ mixer.slasher = Number(e.target.value); }} /></div>
            <div className="flex items-center gap-2"><span>Folk</span><input type="range" min="0" max="2" step="1" defaultValue={mixer.folk} onChange={(e)=>{ mixer.folk = Number(e.target.value); }} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Cold Night Roulette */}
        <Card className="rounded-2xl h-full">
          <CardContent className="p-3 space-y-2 h-full flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm uppercase tracking-wide opacity-80">
                <AlarmClock className="h-4 w-4" /> Cold Night Roulette
              </div>
              <Button size="sm" variant="outline" onClick={async () => {
                if (!apiKey) { toast('Add your TMDb API token in Settings first.', { kind: 'error' }); return; }
                if (!external.length) { toast('No TMDb recommendations available yet.'); return; }
                // runtimes aren't in the list response, so look them up (best effort)
                const enriched = await Promise.all(external.slice(0, 50).map(async (r) => {
                  try {
                    const d = await tmdbGet(`/movie/${r.id}?language=en-US`, { apiKey, cacheMs: 5 * 60 * 1000 });
                    return { ...r, runtime: d?.runtime || null, year: r.year || (d?.release_date ? Number(d.release_date.slice(0, 4)) : undefined) };
                  } catch (err) {
                    if (err?.kind === 'auth') throw err;
                    return r;
                  }
                })).catch((err) => { toast(describeError(err), { kind: 'error' }); return null; });
                if (!enriched) return;
                const classics = enriched.filter((x) => (x.year || 9999) < 1985);
                const shorties = classics.filter((x) => (x.runtime || 999) < 90);
                const pickFrom = shorties.length ? shorties : classics.length ? classics : enriched;
                const pick = pickFrom[Math.floor(Math.random() * pickFrom.length)];
                onOpenDetails?.({ id: pick.id, title: pick.title, year: pick.year ? Number(pick.year) : undefined, poster: pick.poster, overview: '' });
            }}>Spin</Button>
            </div>
            <div className="text-xs opacity-70">Picks TMDb recommendations (pre‑1985) under 90 minutes.</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm uppercase tracking-wide opacity-80">
          <Wand2 className="h-4 w-4" /> Similar to your favorites (from TMDb)
          {moodPreset !== "all" ? (
            <span className="normal-case tracking-normal opacity-70">· leaning {MOOD_PRESETS.find((p) => p.id === moodPreset)?.label}</span>
          ) : null}
        </div>
        {!apiKey ? (
          <div className="text-sm opacity-70">Add your TMDb API token in Settings to get suggestions based on your favorites.</div>
        ) : status === "error" ? (
          <div role="alert" className="text-sm text-red-300">{error?.message || "Couldn't load suggestions."}</div>
        ) : status === "loading" && !external.length ? (
          <div className="text-sm opacity-70">Finding films like {seedTitles.slice(0, 3).join(", ")}…</div>
        ) : !seedTitles.length ? (
          <div className="text-sm opacity-70">Rate a few films 4★ or higher and suggestions will appear here.</div>
        ) : !external.length ? (
          <div className="text-sm opacity-70">No new horror suggestions right now from {seedTitles.slice(0, 3).join(", ")}.</div>
        ) : (
          <>
            <div className="text-xs opacity-60">Based on {seedTitles.slice(0, 3).join(", ")}{seedTitles.length > 3 ? ` and ${seedTitles.length - 3} more` : ""}.</div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
              {external.map((r) => (
                <div key={r.id} className="space-y-1">
                  <MovieCard
                    item={{ id: r.id, title: r.title, year: r.year ? Number(r.year) : undefined, poster: r.poster, overview: "", voteAvg: r.voteAvg, rating: ratingById?.[r.id] || 0 }}
                    onAdd={onAdd}
                    onUpdate={(it) => onAdd?.(it)}
                    compact
                    onOpenDetails={onOpenDetails}
                    isInLibrary={inLibraryIds?.has(r.id)}
                    isWatchlisted={watchlistIds?.has(r.id)}
                  />
                  <div className="px-1 text-xs opacity-60">{r.reason}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm uppercase tracking-wide opacity-80">
          <Wand2 className="h-4 w-4" /> Mood-based picks (your watchlist)
          {moodPreset !== "all" ? (
            <span className="normal-case tracking-normal opacity-70">
              · {MOOD_PRESETS.find((p) => p.id === moodPreset)?.label}, scare level {mood}/10
            </span>
          ) : null}
        </div>
        {recs.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
            {recs.map((i) => (
              <MovieCard key={i.id} item={i} onUpdate={onUpdate} onRemove={onRemove} compact onOpenDetails={onOpenDetails} />
            ))}
          </div>
        ) : (
          <div className="opacity-70">Add a few movies to your library to enable mood‑based picks.</div>
        )}
      </div>

      
    </div>
  );
}
