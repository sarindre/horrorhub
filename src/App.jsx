import { Suspense, useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "./components/ui/button.jsx";
import { Tabs, TabsContent } from "./components/ui/tabs.jsx";
import { MainNav } from "./components/MainNav.jsx";
import { useHashTab } from "./hooks/useHashTab.js";
import { readJSON, readString, writeJSON, writeString } from "./lib/storage.js";
import { mergeLibraries, validateImport } from "./lib/library.js";
import { FlickerOverlay, FogOverlay, AmbientAudio, LightsOutOverlay } from "./components/overlays.jsx";
import { getMixer } from "./lib/settings.js";
import { ContentPrefsContext } from "./lib/contentContext.js";
import { useAutoTagger } from "./hooks/useAutoTagger.js";
import { useChallenges } from "./hooks/useChallenges.js";
import { useMarathons } from "./hooks/useMarathons.js";
import { useImportMatcher } from "./hooks/useImportMatcher.js";
import { isUnmatched } from "./lib/tmdbMatch.js";
import { GettingStarted } from "./components/GettingStarted.jsx";
import { isOnboardingDone, onboardingSteps } from "./lib/onboarding.js";
import { buildTasteProfile } from "./lib/taste.js";
import { usePersistentState } from "./lib/usePersistentState.js";
import { analyzeLocal } from "./lib/filmMeta.js";
import { cleanupLegacyKeywordTags, mergeInferred, tagState } from "./lib/tagging.js";
import { useSettings } from "./hooks/useSettings.js";
import { useTheme } from "./hooks/useTheme.js";
import { useLibrary } from "./hooks/useLibrary.js";
import { LibraryView } from "./features/library/LibraryView.jsx";
import { Discover } from "./features/discover/Discover.jsx";
import { WatchlistView } from "./features/watchlist/WatchlistView.jsx";
import { RecommendationsView } from "./features/recs/RecommendationsView.jsx";
import { ChallengesView, ContinuityGraph, MovieDetails, RatingRoulette, StatsView, preloadLazyViews } from "./lazyViews.js";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion.js";
import { Settings } from "./features/settings/Settings.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import { useToast } from "./lib/toastContext.js";

export function HorrorHub() {
  const toast = useToast();
  const { library, upsert, remove, relink, replaceLibrary, saveFailed } = useLibrary();
  const [settings, updateSettings] = useSettings();
  useTheme(settings.theme);
  const reducedMotion = usePrefersReducedMotion();

  // While the browser is idle, fetch the screens that load on demand so tab switches feel instant.
  useEffect(() => {
    const idle = window.requestIdleCallback || ((cb) => window.setTimeout(cb, 2000));
    const cancel = window.cancelIdleCallback || window.clearTimeout;
    const handle = idle(preloadLazyViews);
    return () => cancel(handle);
  }, []);
  const mixer = useMemo(() => getMixer(settings), [settings]);
  const [selected, setSelected] = useState(null); // movie object to show details
  const contentPrefs = useMemo(
    () => ({ showWarnings: settings.showWarnings, avoidFlags: settings.avoidFlags, maxScares: settings.maxScares, contentMode: settings.contentMode }),
    [settings.showWarnings, settings.avoidFlags, settings.maxScares, settings.contentMode]
  );

  const inLibraryIds = useMemo(() => new Set(library.map((i) => i.id)), [library]);
  const watchlistIds = useMemo(() => new Set(library.filter((i) => i.watchlist).map((i) => i.id)), [library]);
  const ratingById = useMemo(() => Object.fromEntries(library.map(i=> [i.id, i.rating||0])), [library]);

  // Only fields the caller actually provided are sent, so re-adding a title that
  // is already in the library can't reset its tags, watch dates or rating.
  // A film that is new to the library gets starter tags inferred from what we
  // already know about it (the background tagger enriches them from TMDb).
  const addToLibrary = (m) => {
    const fields = {
      id: m.id,
      title: m.title,
      year: m.year,
      poster: m.poster,
      overview: m.overview,
      releaseDate: m.releaseDate || m.date,
      rating: m.rating,
      scares: m.scares,
      tags: m.tags,
      autoTags: m.autoTags,
      removedTags: m.removedTags,
      contentFlags: m.contentFlags,
      autoFlags: m.autoFlags,
      removedFlags: m.removedFlags,
      keywords: m.keywords,
      runtime: m.runtime,
      taggedAt: m.taggedAt,
      watchedDates: m.watchedDates,
      notes: m.notes,
      watchlist: m.watchlist === undefined ? undefined : !!m.watchlist,
    };
    if (!inLibraryIds.has(m.id) && m.tags === undefined) {
      const starter = mergeInferred(tagState({}), analyzeLocal(m).tags);
      fields.tags = starter.list;
      fields.autoTags = starter.auto;
    }
    upsert(Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)));
  };

  // Validates the file, shows what will change, then merges. Existing titles
  // are never deleted; a bad file changes nothing.
  const importLib = (payload, label = "file") => {
    const { items: incoming, skipped, error } = validateImport(payload);
    if (error) return toast(error, { kind: "error" });
    const { items, added, updated } = mergeLibraries(library, incoming);
    const summary = `Import from ${label}:\n\n• ${added} new title${added === 1 ? "" : "s"}\n• ${updated} existing title${updated === 1 ? "" : "s"} updated (tags and watch dates are combined)${skipped ? `\n• ${skipped} row${skipped === 1 ? "" : "s"} skipped (missing id or title)` : ""}\n\nNothing in your library is deleted. Continue?`;
    if (!window.confirm(summary)) return;
    replaceLibrary(items);
    const newChallenges = Array.isArray(payload?.challenges) ? challengeStore.merge(payload.challenges) : 0;
    const newPlans = Array.isArray(payload?.marathons) ? marathonStore.merge(payload.marathons) : 0;
    const extra = [newChallenges && `${newChallenges} challenge${newChallenges === 1 ? "" : "s"}`, newPlans && `${newPlans} saved plan${newPlans === 1 ? "" : "s"}`].filter(Boolean);
    toast(`Imported from ${label}: ${added} new, ${updated} updated${extra.length ? `, ${extra.join(", ")}` : ""}.`, { kind: "success" });
  };

  const watchlist = library.filter((i) => i.watchlist);

  // Link Letterboxd/IMDb imports to TMDb (real ids, posters, metadata) in the background.
  // Runs before the tagger's next pass, which then tags the newly linked films.
  const matcher = useImportMatcher({
    library,
    upsert,
    relink,
    apiKey: settings.apiKey,
    enabled: settings.autoMatch,
    onProblem: (message) => toast(message, { kind: "error" }),
    onDone: ({ matched, failed }) =>
      toast(`Matched ${matched} of ${matched + failed} imported film${matched + failed === 1 ? "" : "s"} to TMDb.${failed ? ` ${failed} need a manual match in Settings.` : ""}`, { kind: failed ? "info" : "success" }),
  });
  const retryMatching = () => {
    replaceLibrary(library.map((i) => (isUnmatched(i) ? { ...i, tmdbMatchTriedAt: undefined } : i)));
    toast("Retrying the films that couldn't be matched…");
  };

  const challengeStore = useChallenges({
    library,
    onComplete: (c) => toast(`Challenge complete: ${c.title} 🎉`, { kind: "success" }),
  });

  const marathonStore = useMarathons();

  // The current view lives in the URL hash so Back/Forward move between views. Opening any
  // view (including the one you're on) leaves a film's details, and so does the browser's Back.
  const [tab, setTab] = useHashTab();
  const goTab = (next) => {
    setSelected(null);
    setTab(next);
  };
  useEffect(() => {
    setSelected(null);
  }, [tab]);

  // First-run checklist
  const [onboardingDismissed, setOnboardingDismissed] = usePersistentState("onboarding.dismissed", false);
  const signalCount = useMemo(() => buildTasteProfile(library).signalCount, [library]);
  const steps = onboardingSteps({ settings, library, signalCount });

  // Re-run auto-tagging on everything (your edits and removals are still respected).
  const retagAll = () => {
    if (!settings.apiKey) return toast("Add your TMDb API token first.", { kind: "error" });
    if (!settings.autoTag) return toast("Turn on auto-tagging first.", { kind: "error" });
    replaceLibrary(library.map((i) => ({ ...i, taggedAt: undefined })));
    toast("Re-tagging your library from TMDb data…");
  };
  // Old versions copied every TMDb keyword into tags; move those out of tags (search still finds them).
  const cleanupTags = () => {
    const { items, films, tags } = cleanupLegacyKeywordTags(library);
    if (!tags) return toast("No old keyword tags found. (This only looks at films that have already been auto-tagged.)");
    if (!window.confirm(`Move ${tags} old keyword tag${tags === 1 ? "" : "s"} on ${films} film${films === 1 ? "" : "s"} out of your tags?

They came from TMDb keywords (like "based-on-novel"). Your own tags and the curated ones stay, and the words remain searchable.`)) return;
    replaceLibrary(items);
    toast(`Cleaned up ${tags} tag${tags === 1 ? "" : "s"}.`, { kind: "success" });
  };

  // Background catalog intelligence: tag + flag untagged films from TMDb data.
  const tagger = useAutoTagger({
    library,
    upsert,
    apiKey: settings.apiKey,
    enabled: settings.autoTag,
    onProblem: (message) => toast(message, { kind: "error" }),
  });

  // Nudge engine: gentle reminder after N days
  const [showNudge, setShowNudge] = useState(false);
  useEffect(() => {
    // nudge engine is always on; cadence is controlled by nudgeDays
    const nudgeDays = Number(settings.nudgeDays || 7);
    const lastWatch = readString('horrorhub.lastWatch');
    if (!lastWatch) return;
    const last = new Date(lastWatch);
    const diffDays = Math.floor((Date.now() - last.getTime())/(1000*60*60*24));
    const lastNudge = Number(readString('horrorhub.lastNudge', 0));
    const sinceNudge = Math.floor((Date.now() - lastNudge)/(1000*60*60*24));
    if (diffDays >= nudgeDays && sinceNudge >= nudgeDays) setShowNudge(true);
  }, [settings.nudgeDays]);
  // Release Radar notifications effect
  useEffect(() => {
    if (!settings.releaseRadar) return;
    if (!("Notification" in window)) return;
    const key = 'horrorhub.notified.v1';
    const notified = new Set(readJSON(key, []));
    const today = new Date().toISOString().slice(0,10);
    const due = watchlist.filter(i => i.releaseDate && i.releaseDate <= today && !notified.has(i.id));
    if (!due.length) return;
    (async ()=>{
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
      due.slice(0,3).forEach(i=>{
        try { new Notification('Now Released', { body: `${i.title} is out today!` }); } catch { /* notifications unavailable */ }
        notified.add(i.id);
      });
      writeJSON(key, Array.from(notified));
    })();
  }, [settings.releaseRadar, watchlist]);

  return (
    <ContentPrefsContext.Provider value={contentPrefs}>
    <div className={`p-4 md:p-8 max-w-7xl mx-auto ${settings.highContrast ? 'hc' : ''} ${settings.dyslexic ? 'dyslexic' : ''}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs uppercase tracking-wider opacity-70">Your personal horror library</div>
          <h1 className={`text-3xl md:text-4xl font-bold flex items-center gap-2 ${settings.spookyFont ? 'font-spooky' : ''}`}>
            HorrorHub <Sparkles className="h-6 w-6" />
          </h1>
          <div className="opacity-80">Track what you've watched, find what to watch next, and plan the perfect night.</div>
        </div>
        <div className="flex gap-2">
          <Button variant={settings.lightsOut ? "default" : "outline"} onClick={() => updateSettings({ lightsOut: !settings.lightsOut })}>
            {settings.lightsOut ? 'Lights on' : 'Lights out'}
          </Button>
          {/* Export/Import moved to Settings */}
        </div>
      </div>
      {!onboardingDismissed && !isOnboardingDone(steps) && !selected ? (
        <GettingStarted steps={steps} onGo={goTab} onDismiss={() => setOnboardingDismissed(true)} />
      ) : null}
      {saveFailed ? (
        <div role="alert" className="mb-4 rounded-xl border border-red-500/40 bg-red-950/50 px-4 py-3 text-sm">
          Your browser refused to save your library (storage may be full or blocked). Changes since the last successful save
          could be lost on reload. Open Settings → Backup &amp; Import and export a backup now.
        </div>
      ) : null}
      {matcher.running ? (
        <div role="status" className="mb-3 text-xs opacity-70">
          Matching imported films to TMDb… {matcher.pending} left
        </div>
      ) : null}
      {tagger.running ? (
        <div role="status" className="mb-3 text-xs opacity-70">
          Auto-tagging your library from TMDb data… {tagger.pending} film{tagger.pending === 1 ? "" : "s"} left
        </div>
      ) : null}
      <Tabs value={tab} onValueChange={goTab}>
      <MainNav view={tab} onChange={goTab} />

      <div className="mt-6" />

        {selected ? (
          <div className="mt-6">
            <Button variant="outline" onClick={() => setSelected(null)}>
              ← Back
            </Button>
          <div className="mt-4">
              <Suspense fallback={<div role="status" className="mt-6 text-sm opacity-70">Loading…</div>}>
              <MovieDetails
                item={selected}
                localItem={library.find((i) => i.id === selected.id)}
                onUpdate={upsert}
                onAdd={(m) => upsert(m)}
                apiKey={settings.apiKey}
                omdbKey={settings.omdbKey}
                dddKey={settings.dddKey}
                externalOff={!!settings.externalOff}
              />
              </Suspense>
            </div>
          </div>
        ) : (
          <Suspense fallback={<div role="status" className="mt-6 text-sm opacity-70">Loading…</div>}>
          <>
        <TabsContent value="discover" className="mt-6">
          <Discover apiKey={settings.apiKey} onAdd={addToLibrary} onRemove={remove} inLibraryIds={inLibraryIds} onToggleWatchlist={addToLibrary} onOpenDetails={setSelected} watchlistIds={watchlistIds} ratingById={ratingById} />
        </TabsContent>

            <TabsContent value="library" className="mt-6">
              <LibraryView items={library} onUpdate={upsert} onRemove={remove} onOpenDetails={setSelected} />
            </TabsContent>

        <TabsContent value="watchlist" className="mt-6">
          <WatchlistView items={watchlist} library={library} marathonStore={marathonStore} onUpdate={upsert} onRemove={remove} onOpenDetails={setSelected} planDays={settings.planDays} planTime={settings.planTime} />
        </TabsContent>

        <TabsContent value="recs" className="mt-6">
  <RecommendationsView
    items={library}
    apiKey={settings.apiKey}
    onAdd={addToLibrary}
    onUpdate={upsert}
    onRemove={remove}
    onOpenDetails={setSelected}
    inLibraryIds={inLibraryIds}
    watchlistIds={watchlistIds}
    ratingById={ratingById}
    mixer={mixer}
    onMixerChange={(name, value) => updateSettings({ [`mixer${name}`]: value })}
  />
</TabsContent>
        <TabsContent value="continuity" className="mt-6">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6">
            <ContinuityGraph items={library} apiKey={settings.apiKey} onOpenDetails={setSelected} />
          </div>
        </TabsContent>

        <TabsContent value="rate" className="mt-6">
          <RatingRoulette apiKey={settings.apiKey} onAdd={addToLibrary} onOpenDetails={setSelected} ratingMap={ratingById} inLibraryIds={inLibraryIds} watchlistIds={watchlistIds} />
        </TabsContent>

            <TabsContent value="challenges" className="mt-6">
              <ChallengesView library={library} store={challengeStore} apiKey={settings.apiKey} onUpdate={upsert} onAdd={addToLibrary} onOpenDetails={setSelected} />
            </TabsContent>

            <TabsContent value="stats" className="mt-6">
              <StatsView items={library} longAgoYear={settings.longAgoYear} />
            </TabsContent>

            <TabsContent value="settings" className="mt-6">
              <Settings settings={settings} update={updateSettings} onImport={importLib} onRetagAll={retagAll} onCleanupTags={cleanupTags} onRelink={relink} onRetryMatching={retryMatching} extras={{ challenges: challengeStore.challenges, marathons: marathonStore.marathons }} watchlist={watchlist} data={library} />
            </TabsContent>
          </>
          </Suspense>
        )}
      </Tabs>

      <p className="mt-10 text-sm opacity-60">
        Your library lives in this browser. Back it up any time in Settings → Backup &amp; Import.
      </p>
      {settings.flicker && !reducedMotion && <FlickerOverlay />}
      {settings.fog && !reducedMotion && <FogOverlay />}
      {settings.ambientAudio ? <AmbientAudio /> : null}
      {settings.lightsOut ? <LightsOutOverlay /> : null}
      {showNudge ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
          <div className="flex items-center gap-3 rounded-2xl bg-black/70 text-white px-4 py-2 shadow-lg">
            <span className="text-sm">It’s been a while — roll a pick?</span>
            <Button size="sm" onClick={()=>{
              const pool = watchlist.length? watchlist : library;
              if (pool.length){ const pick = pool[Math.floor(Math.random()*pool.length)]; setSelected(pick); }
              setShowNudge(false); writeString('horrorhub.lastNudge', Date.now());
            }}>Roll</Button>
            <Button size="sm" variant="outline" onClick={()=>{ setShowNudge(false); writeString('horrorhub.lastNudge', Date.now()); }}>Dismiss</Button>
          </div>
        </div>
      ) : null}
    </div>
    </ContentPrefsContext.Provider>
  );
}

// Default export expected by Vite entry (main.jsx)
export default function App() {
  return (
    <ToastProvider>
      <HorrorHub />
    </ToastProvider>
  );
}
