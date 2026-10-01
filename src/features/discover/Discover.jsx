import { useCallback, useEffect, useRef, useState } from "react";
import { Search as SearchIcon, BellRing, Heart } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { usePersistentState } from "../../lib/usePersistentState.js";
import { REGIONS } from "../../lib/regions.js";
import { useProviders } from "../../hooks/useProviders.js";
import { useContentGate } from "../../hooks/useContentGate.js";
import { HiddenNotice } from "../../components/HiddenNotice.jsx";
import { useToast } from "../../lib/toastContext.js";
import { MovieCard } from "../../components/MovieCard.jsx";
import { useTouchedCards } from "../../hooks/useTouchedCards.js";
import { TMDB_IMG, describeError, isAbort, mapMovie, tmdbGet } from "../../lib/tmdb.js";

const PROVIDER_NAMES = { netflix: "Netflix", prime: "Prime Video", hulu: "Hulu", disney: "Disney+" };
const NO_KEY_MESSAGE = "Add your TMDb API token in Settings first.";
const LIST_CACHE_MS = 5 * 60 * 1000;
const discoverBase = (region) => `/discover/movie?include_adult=false&language=en-US&with_genres=27&region=${region}`;
const classicPath = (region) => `${discoverBase(region)}&with_runtime.lte=90&primary_release_date.lte=1985-12-31&sort_by=primary_release_date.desc`;
const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function discoverPath(sortKey, region) {
  const DISCOVER_BASE = discoverBase(region);
  if (sortKey === "primary_release_date.desc") {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const end = new Date();
    end.setDate(end.getDate() + 14);
    return `${DISCOVER_BASE}&sort_by=primary_release_date.desc&primary_release_date.gte=${fmtDate(start)}&primary_release_date.lte=${fmtDate(end)}`;
  }
  return `${DISCOVER_BASE}&sort_by=${sortKey}`;
}

export function Discover({ apiKey, region = "US", onAdd, onRemove, inLibraryIds, onToggleWatchlist, onOpenDetails, watchlistIds, ratingById }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [sort, setSort] = useState("popularity.desc");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [hideWatchlisted, setHideWatchlisted] = usePersistentState('discover.hideWatchlisted', false);
  const [hideInLibrary, setHideInLibrary] = usePersistentState('discover.hideInLibrary', false);
  const [providersSel, setProvidersSel] = usePersistentState('discover.providers', []);
  const { map: providerMap, loading: providersLoading, failed: providersFailed, retry: retryProviders } = useProviders(results.map((r) => r.id), apiKey, (providersSel || []).length > 0, region);
  const gate = useContentGate(results, apiKey);

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
      setLoadingMore(false);
      setError(null);
      try {
        const data = await tmdbGet(path, { apiKey, signal: controller.signal, cacheMs: LIST_CACHE_MS });
        setResults((data.results || []).map(mapMovie));
        setPage(1);
        setTotalPages(Math.max(1, Number(data.total_pages) || 1));
      } catch (err) {
        if (!isAbort(err)) setError(err);
      } finally {
        if (abortRef.current === controller) setLoading(false);
      }
    },
    [apiKey]
  );
  // The next page of the same list, added below what's already shown. If you start a new
  // search or sort while it loads, the old request is cancelled and its results dropped.
  const loadMore = async () => {
    const path = lastPathRef.current;
    if (!path || loadingMore || page >= totalPages) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoadingMore(true);
    try {
      const data = await tmdbGet(`${path}${path.includes("?") ? "&" : "?"}page=${page + 1}`, { apiKey, signal: controller.signal, cacheMs: LIST_CACHE_MS });
      if (lastPathRef.current !== path) return;
      setResults((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...(data.results || []).map(mapMovie).filter((m) => !seen.has(m.id))];
      });
      setPage((p) => p + 1);
    } catch (err) {
      if (!isAbort(err)) toast(describeError(err), { kind: "error" });
    } finally {
      if (abortRef.current === controller) setLoadingMore(false);
    }
  };

  useEffect(() => setUpcoming([]), [region]);

  useEffect(() => {
    if (!apiKey) {
      setResults([]);
      return;
    }
    load(discoverPath(sort, region));
  }, [apiKey, sort, region, load]);
  // cancel any request still in flight when leaving the tab
  useEffect(() => () => abortRef.current?.abort(), []);

  const requireKey = () => {
    if (apiKey) return true;
    toast(NO_KEY_MESSAGE, { kind: "error" });
    return false;
  };
  const classicUnder90 = () => {
    if (requireKey()) load(classicPath(region));
  };
  const search = () => {
    if (!requireKey()) return;
    const term = q.trim();
    load(term ? `/search/movie?include_adult=false&language=en-US&query=${encodeURIComponent(term)}` : discoverPath(sort, region));
  };

  const loadUpcoming = async () => {
    if (!requireKey()) return;
    if (!upcoming.length) {
      try {
        const data = await tmdbGet(`${discoverBase(region)}&sort_by=primary_release_date.asc&primary_release_date.gte=${fmtDate(new Date())}`, { apiKey, cacheMs: LIST_CACHE_MS });
        setUpcoming((data.results || []).slice(0, 9).map((m) => ({ id: m.id, title: m.title, date: m.release_date, poster: m.poster_path })));
      } catch (err) {
        toast(describeError(err), { kind: "error" });
        return;
      }
    }
    setShowUpcoming((v) => !v);
  };

  // a film you've just rated or added stays on screen (the filters below would drop it at once)
  const { touched, handle } = useTouchedCards({ ratingById, inLibraryIds, watchlistIds, onAdd, resetKey: results });

  const shown = gate.visible
    .filter((r) => touched.has(r.id) || (hideWatchlisted ? !watchlistIds?.has(r.id) : true))
    .filter((r) => touched.has(r.id) || (hideInLibrary ? !inLibraryIds?.has(r.id) : true))
    .filter((r) => {
      if (touched.has(r.id)) return true;
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
        <div className="flex flex-wrap gap-2 text-sm">
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

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
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
      {(providersSel || []).length && apiKey && results.length ? (
        <div role="status" className="text-sm opacity-80">
          {providersLoading ? (
            "Checking where these are streaming…"
          ) : providersFailed ? (
            <>
              Couldn't check {providersFailed} film{providersFailed === 1 ? "" : "s"}, so {providersFailed === 1 ? "it is" : "they are"} hidden.{" "}
              <Button size="sm" variant="outline" onClick={retryProviders}>Try again</Button>
            </>
          ) : !shown.length ? (
            `None of these are streaming on ${providersSel.map((k) => PROVIDER_NAMES[k] || k).join(" or ")} in ${REGIONS.find(([c]) => c === region)?.[1] || region}. New releases often aren't yet. Try another service, or Reset.`
          ) : null}
        </div>
      ) : null}

      {!apiKey ? (
        <div className="text-sm opacity-70">Add your TMDb API token in Settings to browse horror films.</div>
      ) : error ? (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm">
          <span className="flex-1">{describeError(error)}</span>
          <Button size="sm" variant="outline" onClick={() => load(lastPathRef.current || discoverPath(sort, region))}>Retry</Button>
        </div>
      ) : loading && !results.length ? (
        <div className="text-sm opacity-70">Loading…</div>
      ) : !loading && !shown.length ? (
        <div className="text-sm opacity-70">No films match. Try another search or loosen the filters.</div>
      ) : null}

      <HiddenNotice count={gate.hiddenCount} onReveal={gate.reveal} />

      <div className={`grid gap-4 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 ${loading && results.length ? "opacity-60 transition-opacity" : ""}`}>
        {shown.map((r) => (
          <div key={r.id} className="fade-in-up min-w-0">
            <MovieCard
              item={{ ...r, rating: ratingById?.[r.id] ?? 0 }}
              onAdd={handle}
              onUpdate={handle}
              onRemove={(id) => onRemove?.(id)}
              showWatchlist={false}
              compact
              onOpenDetails={onOpenDetails}
              isInLibrary={inLibraryIds.has(r.id)}
              isWatchlisted={watchlistIds ? watchlistIds.has(r.id) : false}
              providers={providerMap[r.id] || []}
              warnings={gate.flagsById[r.id] || []}
            />
          </div>
        ))}
      </div>

      {apiKey && results.length ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="opacity-70">
            Showing {shown.length} of {results.length} loaded
            {gate.visible.length - shown.length > 0 ? ` (${gate.visible.length - shown.length} hidden by your filters)` : ""}.
            {page >= totalPages ? " That's everything for this list." : ""}
          </span>
          {page < totalPages ? (
            <Button variant="outline" onClick={loadMore} disabled={loadingMore || loading}>{loadingMore ? "Loading…" : "Show more films"}</Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
