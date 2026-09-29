import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search as SearchIcon, BellRing, Heart } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { usePersistentState } from "../../lib/usePersistentState.js";
import { useProviders } from "../../hooks/useProviders.js";
import { useToast } from "../../lib/toastContext.js";
import { MovieCard } from "../../components/MovieCard.jsx";
import { TMDB_IMG, describeError, isAbort, mapMovie, tmdbGet } from "../../lib/tmdb.js";

const NO_KEY_MESSAGE = "Add your TMDb API token in Settings first.";
const LIST_CACHE_MS = 5 * 60 * 1000;
const DISCOVER_BASE = "/discover/movie?include_adult=false&language=en-US&with_genres=27&region=US";
const CLASSIC_PATH = `${DISCOVER_BASE}&with_runtime.lte=90&primary_release_date.lte=1985-12-31&sort_by=primary_release_date.desc`;
const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function discoverPath(sortKey) {
  if (sortKey === "primary_release_date.desc") {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const end = new Date();
    end.setDate(end.getDate() + 14);
    return `${DISCOVER_BASE}&sort_by=primary_release_date.desc&primary_release_date.gte=${fmtDate(start)}&primary_release_date.lte=${fmtDate(end)}`;
  }
  return `${DISCOVER_BASE}&sort_by=${sortKey}`;
}

export function Discover({ apiKey, onAdd, onRemove, inLibraryIds, onToggleWatchlist, onOpenDetails, watchlistIds, ratingById }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [sort, setSort] = useState("popularity.desc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [hideWatchlisted, setHideWatchlisted] = usePersistentState('discover.hideWatchlisted', false);
  const [hideInLibrary, setHideInLibrary] = usePersistentState('discover.hideInLibrary', false);
  const [providersSel, setProvidersSel] = usePersistentState('discover.providers', []);
  const providerMap = useProviders(results.map((r) => r.id), apiKey, (providersSel || []).length > 0);

  // Every list request goes through here. Starting a new one cancels the previous,
  // so a slow earlier response can never overwrite a newer one.
  const abortRef = useRef(null);
  const lastPathRef = useRef(null);
  const load = useCallback(
    async (path) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      lastPathRef.current = path;
      setLoading(true);
      setError(null);
      try {
        const data = await tmdbGet(path, { apiKey, signal: controller.signal, cacheMs: LIST_CACHE_MS });
        setResults((data.results || []).map(mapMovie));
      } catch (err) {
        if (!isAbort(err)) setError(err);
      } finally {
        if (abortRef.current === controller) setLoading(false);
      }
    },
    [apiKey]
  );

  useEffect(() => {
    if (!apiKey) {
      setResults([]);
      return;
    }
    load(discoverPath(sort));
  }, [apiKey, sort, load]);
  // cancel any request still in flight when leaving the tab
  useEffect(() => () => abortRef.current?.abort(), []);

  const requireKey = () => {
    if (apiKey) return true;
    toast(NO_KEY_MESSAGE, { kind: "error" });
    return false;
  };
  const classicUnder90 = () => {
    if (requireKey()) load(CLASSIC_PATH);
  };
  const search = () => {
    if (!requireKey()) return;
    const term = q.trim();
    load(term ? `/search/movie?include_adult=false&language=en-US&query=${encodeURIComponent(term)}` : discoverPath(sort));
  };

  const loadUpcoming = async () => {
    if (!requireKey()) return;
    if (!upcoming.length) {
      try {
        const data = await tmdbGet(`${DISCOVER_BASE}&sort_by=primary_release_date.asc&primary_release_date.gte=${fmtDate(new Date())}`, { apiKey, cacheMs: LIST_CACHE_MS });
        setUpcoming((data.results || []).slice(0, 9).map((m) => ({ id: m.id, title: m.title, date: m.release_date, poster: m.poster_path })));
      } catch (err) {
        toast(describeError(err), { kind: "error" });
        return;
      }
    }
    setShowUpcoming((v) => !v);
  };

  const shown = results
    .filter((r) => (hideWatchlisted ? !watchlistIds?.has(r.id) : true))
    .filter((r) => (hideInLibrary ? !inLibraryIds?.has(r.id) : true))
    .filter((r) => {
      if (!(providersSel || []).length) return true;
      return (providerMap[r.id] || []).some((p) => providersSel.includes(p));
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Input placeholder="Search horror (title)..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }} />
          <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
        </div>

        {/* sort quick buttons */}
        <div className="flex gap-2 text-sm">
          <Button size="sm" variant={sort === "popularity.desc" ? "default" : "outline"} onClick={() => setSort("popularity.desc")}>Popular</Button>
          <Button size="sm" variant={sort === "vote_average.desc" ? "default" : "outline"} onClick={() => setSort("vote_average.desc")}>Critically rated</Button>
          <Button size="sm" variant={sort === "primary_release_date.desc" ? "default" : "outline"} onClick={() => setSort("primary_release_date.desc")}>Newest</Button>
          <Button size="sm" variant={sort === "primary_release_date.asc" ? "default" : "outline"} onClick={() => setSort("primary_release_date.asc")}>Oldest</Button>
          <Button size="sm" variant="outline" onClick={classicUnder90}>Classic &lt;90m</Button>
        </div>

        <Button size="sm" onClick={search}>
          <SearchIcon className="h-4 w-4 mr-2" />
          Search
        </Button>

        <Button size="sm" variant="outline" onClick={loadUpcoming}>
          <BellRing className="h-4 w-4 mr-2" />
          {showUpcoming ? "Hide upcoming" : "Upcoming releases"}
        </Button>

        <div className="flex items-center gap-4 ml-auto">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hideInLibrary} onChange={(e)=> setHideInLibrary(e.target.checked)} />
            Skip titles in library
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hideWatchlisted} onChange={(e)=> setHideWatchlisted(e.target.checked)} />
            Skip watchlisted
          </label>
        </div>
      </div>

      {showUpcoming && upcoming.length ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm uppercase tracking-wide opacity-80">
            <BellRing className="h-4 w-4" />
            Upcoming releases
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((u) => (
              <Card key={u.id} className="rounded-xl">
                <CardContent className="p-3 flex gap-3 items-center">
                  <img src={TMDB_IMG(u.poster)} alt={u.title} className="w-16 h-24 object-cover rounded" />
                  <div className="flex-1">
                    <div className="font-medium leading-tight">{u.title}</div>
                    <div className="text-sm opacity-70">Releases {new Date(u.date).toLocaleDateString()}</div>
                    <div className="pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onToggleWatchlist?.({
                            id: u.id,
                            title: u.title,
                            year: u.date ? Number(u.date.slice(0, 4)) : undefined,
                            poster: u.poster,
                            overview: "",
                            watchlist: true,
                          })
                        }
                      >
                        <Heart className="h-4 w-4 mr-1" />
                        Add to Watchlist
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-xs opacity-70">
        <span className="inline-block text-[10px] leading-3 px-1.5 py-0.5 rounded bg-emerald-600 text-white">Library</span>
        <span className="inline-block text-[10px] leading-3 px-1.5 py-0.5 rounded bg-rose-600 text-white">Watchlist</span>
        <span>(badges appear on poster)</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] opacity-70">
        <span className="inline-block text-[9px] leading-3 px-1 rounded text-white bg-[#e50914]" title="Netflix">N</span>
        <span className="inline-block text-[9px] leading-3 px-1 rounded text-white bg-[#00a8e1]" title="Prime Video">P</span>
        <span className="inline-block text-[9px] leading-3 px-1 rounded text-white bg-[#1ce783]" title="Hulu">H</span>
        <span className="inline-block text-[9px] leading-3 px-1 rounded text-white bg-[#113ccf]" title="Disney+">D</span>
        <span>provider legends</span>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span>Available on</span>
        {['netflix','prime','hulu','disney'].map(k=> (
          <label key={k} className="inline-flex items-center gap-1">
            <input type="checkbox" checked={providersSel.includes(k)} onChange={(e)=>{
              setProvidersSel(prev=> e.target.checked ? Array.from(new Set([...(prev||[]), k])) : (prev||[]).filter(x=> x!==k));
            }} />
            <span className="capitalize">{k}</span>
          </label>
        ))}
        <Button size="sm" variant="ghost" onClick={()=>{ setHideWatchlisted(false); setHideInLibrary(false); setProvidersSel([]); }}>Reset to defaults</Button>
      </div>

      {!apiKey ? (
        <div className="text-sm opacity-70">Add your TMDb API token in Settings to browse horror films.</div>
      ) : error ? (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm">
          <span className="flex-1">{describeError(error)}</span>
          <Button size="sm" variant="outline" onClick={() => load(lastPathRef.current || discoverPath(sort))}>Retry</Button>
        </div>
      ) : loading && !results.length ? (
        <div className="text-sm opacity-70">Loading…</div>
      ) : !loading && !shown.length ? (
        <div className="text-sm opacity-70">No films match. Try another search or loosen the filters.</div>
      ) : null}

      <div className={`grid gap-4 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 ${loading && results.length ? "opacity-60 transition-opacity" : ""}`}>
        {shown.map((r) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <MovieCard
              item={{ ...r, rating: ratingById?.[r.id] ?? 0 }}
              onAdd={(it) => onAdd?.(it)}
              onUpdate={(it) => onAdd?.(it)}
              onRemove={(id) => onRemove?.(id)}
              showWatchlist={false}
              compact
              onOpenDetails={onOpenDetails}
              isInLibrary={inLibraryIds.has(r.id)}
              isWatchlisted={watchlistIds ? watchlistIds.has(r.id) : false}
              providers={providerMap[r.id] || []}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
