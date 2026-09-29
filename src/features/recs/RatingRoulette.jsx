import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button.jsx";
import { usePersistentState } from "../../lib/usePersistentState.js";
import { useProviders } from "../../hooks/useProviders.js";
import { useContentGate } from "../../hooks/useContentGate.js";
import { HiddenNotice } from "../../components/HiddenNotice.jsx";
import { MovieCard } from "../../components/MovieCard.jsx";
import { describeError, isAbort, mapMovie, tmdbGet } from "../../lib/tmdb.js";

export function RatingRoulette({ apiKey, onAdd, onOpenDetails, ratingMap={}, inLibraryIds = new Set(), watchlistIds = new Set() }){
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageSize, setPageSize] = usePersistentState('roulette.pageSize', 12);
  const [hideRated, setHideRated] = usePersistentState('roulette.hideRated', true);
  const [hideInLibrary, setHideInLibrary] = usePersistentState('roulette.hideInLibrary', false);
  const [hideWatchlisted, setHideWatchlisted] = usePersistentState('roulette.hideWatchlisted', false);
  const [providersSel, setProvidersSel] = usePersistentState('roulette.providers', []);
  const [totalPages, setTotalPages] = useState(null);
  const [jumpVal, setJumpVal] = useState(1);
  const cacheRef = useRef(new Map()); // page -> rows
  const abortRef = useRef(null);
  const providerMap = useProviders(rows.map((r) => r.id), apiKey, (providersSel || []).length > 0);
  const gate = useContentGate(rows, apiKey);

  const fetchPage = useCallback(async (p) => {
    // a newer request (or a cached page) always wins over one still in flight
    abortRef.current?.abort();
    if (!apiKey) { setRows([]); setError(null); return; }
    if (cacheRef.current.has(p)) {
      setRows(cacheRef.current.get(p));
      setError(null);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const data = await tmdbGet(`/discover/movie?include_adult=false&language=en-US&with_genres=27&sort_by=popularity.desc&page=${p}`, { apiKey, signal: controller.signal });
      const mapped = (data.results || []).map(mapMovie);
      cacheRef.current.set(p, mapped);
      setRows(mapped);
      if (typeof data.total_pages === 'number') setTotalPages(data.total_pages);
    } catch (err) {
      if (!isAbort(err)) setError(err);
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }, [apiKey]);
  useEffect(() => { fetchPage(page); setJumpVal(page); }, [page, fetchPage]);
  // cancel any request still in flight when leaving the tab
  useEffect(() => () => abortRef.current?.abort(), []);

  // derive current ratings live from ratingMap and apply optional filters
  const derived = gate.visible.map(r => ({ ...r, rating: ratingMap[r.id] || 0 }));
  const filtered = derived.filter(r => {
    if (hideRated && (r.rating||0) > 0) return false;
    if (hideInLibrary && inLibraryIds.has(r.id)) return false;
    if (hideWatchlisted && watchlistIds.has(r.id)) return false;
    if ((providersSel||[]).length){
      const prov = providerMap[r.id] || [];
      if (!prov.some(p=> providersSel.includes(p))) return false;
    }
    return true;
  });
  const display = filtered.slice(0, pageSize);

  const canPrev = page > 1 && !loading;
  const canNext = !loading && (totalPages ? page < totalPages : true);
  const goJump = ()=>{
    const v = Math.max(1, Math.min(totalPages || Number.MAX_SAFE_INTEGER, Number(jumpVal)||1));
    setPage(v);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Rating Roulette</div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hideRated} onChange={(e)=> setHideRated(e.target.checked)} /> Hide already rated
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hideInLibrary} onChange={(e)=> setHideInLibrary(e.target.checked)} /> Skip titles in library
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hideWatchlisted} onChange={(e)=> setHideWatchlisted(e.target.checked)} /> Skip watchlisted
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            Page size
            <select className="bg-transparent border rounded px-2 py-1" value={pageSize} onChange={(e)=> setPageSize(Number(e.target.value))}>
              {[6,9,12,18,20].map(n=> <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span>Page {page}{totalPages? ` / ${totalPages}`: ''}</span>
            <input type="number" min={1} className="w-16 bg-transparent border rounded px-2 py-1" value={jumpVal}
                   onChange={(e)=> setJumpVal(Number(e.target.value)||1)}
                   onKeyDown={(e)=> { if (e.key==='Enter') goJump(); }} />
            <Button size="sm" variant="outline" onClick={goJump}>Go</Button>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span>Available on</span>
            {['netflix','prime','hulu','disney'].map(k=> (
              <label key={k} className="inline-flex items-center gap-1">
                <input type="checkbox" checked={providersSel.includes(k)} onChange={(e)=>{
                  setProvidersSel(prev=> e.target.checked ? Array.from(new Set([...(prev||[]), k])) : (prev||[]).filter(x=> x!==k));
                }} />
                <span className="capitalize">{k}</span>
              </label>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={()=>{ setHideRated(true); setHideInLibrary(false); setHideWatchlisted(false); setProvidersSel([]); setPageSize(12); }}>
            Reset to defaults
          </Button>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={()=> setPage(p=> Math.max(1, p-1))} disabled={!canPrev}>Prev</Button>
            <Button size="sm" onClick={()=> setPage(p=> p+1)} disabled={!canNext}>Next</Button>
          </div>
        </div>
      </div>

      {!apiKey ? (
        <div className="text-sm opacity-70">Add your TMDb API token in Settings to start rating films.</div>
      ) : error ? (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm">
          <span className="flex-1">{describeError(error)}</span>
          <Button size="sm" variant="outline" onClick={() => fetchPage(page)}>Retry</Button>
        </div>
      ) : loading && display.length === 0 ? (
        <div className="text-sm opacity-70">Loading…</div>
      ) : display.length === 0 ? (
        <div className="text-sm opacity-70">No titles to show with current filters. Try Next page or disable a filter.</div>
      ) : null}

      <HiddenNotice count={gate.hiddenCount} onReveal={gate.reveal} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {display.map(r => (
          <MovieCard key={r.id} item={r} onAdd={(it)=> onAdd?.(it)} onUpdate={(it)=> onAdd?.(it)} onOpenDetails={onOpenDetails} showWatchlist={false} compact isInLibrary={inLibraryIds.has(r.id)} isWatchlisted={watchlistIds.has(r.id)} providers={providerMap[r.id] || []} warnings={gate.flagsById[r.id] || []} />
        ))}
      </div>
    </div>
  );
}
