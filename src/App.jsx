import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "./components/ui/button.jsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs.jsx";
import { readJSON, readString, writeJSON, writeString } from "./lib/storage.js";
import { mergeLibraries, validateImport } from "./lib/library.js";
import { FlickerOverlay, FogOverlay, AmbientAudio, LightsOutOverlay } from "./components/overlays.jsx";
import { getMixer } from "./lib/settings.js";
import { useSettings } from "./hooks/useSettings.js";
import { useTheme } from "./hooks/useTheme.js";
import { useLibrary } from "./hooks/useLibrary.js";
import { LibraryView } from "./features/library/LibraryView.jsx";
import { Discover } from "./features/discover/Discover.jsx";
import { WatchlistView } from "./features/watchlist/WatchlistView.jsx";
import { RecommendationsView } from "./features/recs/RecommendationsView.jsx";
import { ContinuityGraph } from "./features/recs/ContinuityGraph.jsx";
import { RatingRoulette } from "./features/recs/RatingRoulette.jsx";
import { StatsView } from "./features/stats/StatsView.jsx";
import { MovieDetails } from "./features/details/MovieDetails.jsx";
import { Settings } from "./features/settings/Settings.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import { useToast } from "./lib/toastContext.js";

export function HorrorHub() {
  const toast = useToast();
  const { library, upsert, remove, replaceLibrary, saveFailed } = useLibrary();
  const [settings, updateSettings] = useSettings();
  useTheme(settings.theme);
  const mixer = useMemo(() => getMixer(settings), [settings]);
  const [selected, setSelected] = useState(null); // movie object to show details

  const inLibraryIds = useMemo(() => new Set(library.map((i) => i.id)), [library]);
  const watchlistIds = useMemo(() => new Set(library.filter((i) => i.watchlist).map((i) => i.id)), [library]);
  const ratingById = useMemo(() => Object.fromEntries(library.map(i=> [i.id, i.rating||0])), [library]);

  // Only fields the caller actually provided are sent, so re-adding a title that
  // is already in the library can't reset its tags, watch dates or rating.
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
      watchedDates: m.watchedDates,
      notes: m.notes,
      watchlist: m.watchlist === undefined ? undefined : !!m.watchlist,
    };
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
    toast(`Imported from ${label}: ${added} new, ${updated} updated.`, { kind: "success" });
  };

  const watchlist = library.filter((i) => i.watchlist);

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
    <div className={`p-4 md:p-8 max-w-7xl mx-auto ${settings.highContrast ? 'hc' : ''} ${settings.dyslexic ? 'dyslexic' : ''}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs uppercase tracking-wider opacity-70">MVP • Local first</div>
          <h1 className={`text-3xl md:text-4xl font-bold flex items-center gap-2 ${settings.spookyFont ? 'font-spooky' : ''}`}>
            HorrorHub <Sparkles className="h-6 w-6" />
          </h1>
          <div className="opacity-80">Find horror movies, rate them, tag vibes, log watches, manage a watchlist, and get smarter picks.</div>
        </div>
        <div className="flex gap-2">
          <Button variant={settings.lightsOut ? "default" : "outline"} onClick={() => updateSettings({ lightsOut: !settings.lightsOut })}>
            {settings.lightsOut ? 'Lights on' : 'Lights out'}
          </Button>
          {/* Export/Import moved to Settings */}
        </div>
      </div>
      {saveFailed ? (
        <div role="alert" className="mb-4 rounded-xl border border-red-500/40 bg-red-950/50 px-4 py-3 text-sm">
          Your browser refused to save your library (storage may be full or blocked). Changes since the last successful save
          could be lost on reload. Open Settings → Backup &amp; Import and export a backup now.
        </div>
      ) : null}
      <Tabs defaultValue="discover" className="w-full">
      <TabsList className="grid w-full grid-cols-8">
        <TabsTrigger value="discover">Discover</TabsTrigger>
        <TabsTrigger value="library">My Library</TabsTrigger>
        <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
        <TabsTrigger value="recs" className="text-sm whitespace-nowrap">Recommendations</TabsTrigger>
        <TabsTrigger value="rate">Rating Roulette</TabsTrigger>
        <TabsTrigger value="continuity">Because You Liked…</TabsTrigger>
        <TabsTrigger value="stats">Stats</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

        {selected ? (
          <div className="mt-6">
            <Button variant="outline" onClick={() => setSelected(null)}>
              ← Back
            </Button>
          <div className="mt-4">
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
            </div>
          </div>
        ) : (
          <>
        <TabsContent value="discover" className="mt-6">
          <Discover apiKey={settings.apiKey} onAdd={addToLibrary} onRemove={remove} inLibraryIds={inLibraryIds} onToggleWatchlist={addToLibrary} onOpenDetails={setSelected} watchlistIds={watchlistIds} ratingById={ratingById} />
        </TabsContent>

            <TabsContent value="library" className="mt-6">
              <LibraryView items={library} onUpdate={upsert} onRemove={remove} onOpenDetails={setSelected} />
            </TabsContent>

        <TabsContent value="watchlist" className="mt-6">
          <WatchlistView items={watchlist} onUpdate={upsert} onRemove={remove} onOpenDetails={setSelected} planDays={settings.planDays} planTime={settings.planTime} />
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

            <TabsContent value="stats" className="mt-6">
              <StatsView items={library} longAgoYear={settings.longAgoYear} />
            </TabsContent>

            <TabsContent value="settings" className="mt-6">
              <Settings settings={settings} update={updateSettings} onImport={importLib} watchlist={watchlist} data={library} />
            </TabsContent>
          </>
        )}
      </Tabs>

      <div className="mt-10 text-sm opacity-70">
        <p className="mb-2 font-medium">How to use</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>
            Go to <span className="font-semibold">Settings</span> and paste your TMDb v4 <em>Bearer</em> token.
          </li>
          <li>
            Search or browse in <span className="font-semibold">Discover</span>. Add titles or upcoming releases to your <em>Watchlist</em>.
          </li>
          <li>
            In <span className="font-semibold">My Library</span>, rate, tag, and log watch dates; heart to manage watchlist; use <em>Tonight's pick</em> when indecisive.
          </li>
          <li>
            Check <span className="font-semibold">Stats</span> for heatmap, scare↔rating scatter, and tag affinities.
          </li>
          <li>
            Use <span className="font-semibold">Export</span>/<span className="font-semibold">Import</span> to back up your library; <em>Export ICS</em> creates a calendar file for your watchlist.
          </li>
        </ol>
        <p className="mt-3">Data is stored in your browser. Later you can sync to Supabase/SQLite or add push notifications via a backend.</p>
      </div>
      {settings.flicker && <FlickerOverlay />}
      {settings.fog && <FogOverlay />}
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
