import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button.jsx";
import { usePersistentState } from "../../lib/usePersistentState.js";
import { MovieCard } from "../../components/MovieCard.jsx";
import { TMDB_BASE } from "../../lib/tmdb.js";

export function RatingRoulette({ apiKey, onAdd, onOpenDetails, ratingMap={}, inLibraryIds = new Set(), watchlistIds = new Set() }){
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageSize, setPageSize] = usePersistentState('horrorhub.roulette.pageSize', 12);
  const [hideRated, setHideRated] = usePersistentState('horrorhub.roulette.hideRated', true);
  const [hideInLibrary, setHideInLibrary] = usePersistentState('horrorhub.roulette.hideInLibrary', false);
  const [hideWatchlisted, setHideWatchlisted] = usePersistentState('horrorhub.roulette.hideWatchlisted', false);
  const [providersSel, setProvidersSel] = usePersistentState('horrorhub.roulette.providers', []);
  const [totalPages, setTotalPages] = useState(null);
  const [jumpVal, setJumpVal] = useState(1);
  const cacheRef = useRef(new Map()); // page -> rows
  const providersRef = useRef(new Map()); // id -> [slugs]
  const headers = apiKey ? { Authorization:`Bearer ${apiKey}`, 'Content-Type':'application/json;charset=utf-8' } : undefined;

  const fetchPage = async (p)=>{
    if (!apiKey) { alert('Enter your TMDb API key in Settings.'); return; }
    // use cache if available
    if (cacheRef.current.has(p)) {
      setRows(cacheRef.current.get(p));
      return;
    }
    setLoading(true);
    try{
      const url = `${TMDB_BASE}/discover/movie?include_adult=false&language=en-US&with_genres=27&sort_by=popularity.desc&page=${p}`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      const mapped = (data.results||[]).map(m => ({ id:m.id, title:m.title, year: m.release_date? Number(m.release_date.slice(0,4)) : undefined, poster:m.poster_path, overview:m.overview, rating: ratingMap[m.id]||0, addedAt:new Date().toISOString(), watchedDates:[] }));
      cacheRef.current.set(p, mapped);
      setRows(mapped);
      if (typeof data.total_pages === 'number') setTotalPages(data.total_pages);
    }catch{} finally{ setLoading(false); }
  };
  useEffect(()=>{ fetchPage(page); setJumpVal(page); },[page, apiKey]);

  const providerSlug = (name='')=>{
    const n = String(name).toLowerCase();
    if (n.includes('netflix')) return 'netflix';
    if (n.includes('prime')) return 'prime';
    if (n.includes('hulu')) return 'hulu';
    if (n.includes('disney')) return 'disney';
    return null;
  };
  const ensureProvidersFor = async (ids=[])=>{
    if (!apiKey || !ids.length) return;
    const pending = ids.filter(id=> !providersRef.current.has(id));
    if (!pending.length) return;
    const reqs = pending.map(async (id)=>{
      try{
        const res = await fetch(`${TMDB_BASE}/movie/${id}/watch/providers`, { headers });
        const data = await res.json();
        const us = data?.results?.US || {};
        const flatrate = Array.isArray(us.flatrate)? us.flatrate : [];
        const ads = Array.isArray(us.ads)? us.ads : [];
        const arr = [...flatrate, ...ads].map(p=> providerSlug(p.provider_name)).filter(Boolean);
        providersRef.current.set(id, Array.from(new Set(arr)));
      }catch{ providersRef.current.set(id, []); }
    });
    await Promise.all(reqs);
  };
  useEffect(()=>{ if ((providersSel||[]).length){ ensureProvidersFor(rows.map(r=> r.id)); } },[rows, providersSel, apiKey]);

  // derive current ratings live from ratingMap and apply optional filters
  const derived = rows.map(r => ({ ...r, rating: ratingMap[r.id] || r.rating || 0 }));
  const filtered = derived.filter(r => {
    if (hideRated && (r.rating||0) > 0) return false;
    if (hideInLibrary && inLibraryIds.has(r.id)) return false;
    if (hideWatchlisted && watchlistIds.has(r.id)) return false;
    if ((providersSel||[]).length){
      const prov = providersRef.current.get(r.id) || [];
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

      {display.length === 0 && !loading ? (
        <div className="text-sm opacity-70">No titles to show with current filters. Try Next page or disable a filter.</div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {display.map(r => (
          <MovieCard key={r.id} item={r} onAdd={(it)=> onAdd?.(it)} onUpdate={(it)=> onAdd?.(it)} onOpenDetails={onOpenDetails} showWatchlist={false} compact isInLibrary={inLibraryIds.has(r.id)} isWatchlisted={watchlistIds.has(r.id)} providers={(providersRef.current.get(r.id)||[])} />
        ))}
      </div>
    </div>
  );
}
