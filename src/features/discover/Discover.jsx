import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search as SearchIcon, BellRing, Heart } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { usePersistentState } from "../../lib/usePersistentState.js";
import { MovieCard } from "../../components/MovieCard.jsx";
import { TMDB_BASE, TMDB_IMG } from "../../lib/tmdb.js";

export function Discover({ apiKey, onAdd, onRemove, inLibraryIds, onToggleWatchlist, onOpenDetails, watchlistIds, ratingById }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [sort, setSort] = useState("popularity.desc");
  const [upcoming, setUpcoming] = useState([]);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [hideWatchlisted, setHideWatchlisted] = usePersistentState('horrorhub.discover.hideWatchlisted', false);
  const [hideInLibrary, setHideInLibrary] = usePersistentState('horrorhub.discover.hideInLibrary', false);
  const [providersSel, setProvidersSel] = usePersistentState('horrorhub.discover.providers', []);
  const providersRef = useRef(new Map()); // id -> [slugs]

  const authHeader = apiKey ? { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json;charset=utf-8" } : undefined;

  const buildDiscoverUrl = (sortKey) => {
    const base = `${TMDB_BASE}/discover/movie?include_adult=false&language=en-US&with_genres=27&region=US`;
    if (sortKey === "primary_release_date.desc") {
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      const end = new Date(now);
      end.setDate(end.getDate() + 14);
      const pad = (n) => String(n).padStart(2, "0");
      const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return `${base}&sort_by=primary_release_date.desc&primary_release_date.gte=${fmt(start)}&primary_release_date.lte=${fmt(end)}`;
    }
    return `${base}&sort_by=${sortKey}`;
  };

  const classicUnder90 = async () => {
    if (!apiKey) { alert('Enter your TMDb API key in Settings.'); return; }
    const base = `${TMDB_BASE}/discover/movie?include_adult=false&language=en-US&with_genres=27&region=US&with_runtime.lte=90&primary_release_date.lte=1985-12-31&sort_by=primary_release_date.desc`;
    const res = await fetch(base, { headers: authHeader });
    const data = await res.json();
    const mapped = (data.results || []).map((m) => ({
      id: m.id,
      title: m.title,
      year: m.release_date ? Number(m.release_date.slice(0, 4)) : undefined,
      poster: m.poster_path,
      overview: m.overview,
      voteAvg: typeof m.vote_average === 'number' ? m.vote_average : undefined,
      addedAt: new Date().toISOString(),
      watchedDates: [],
    }));
    setResults(mapped);
  };

  const search = async () => {
    if (!apiKey) {
      alert("Enter your TMDb API key in Settings.");
      return;
    }
    const url = q
      ? `${TMDB_BASE}/search/movie?include_adult=false&language=en-US&query=${encodeURIComponent(q)}`
      : buildDiscoverUrl(sort);
    const res = await fetch(url, { headers: authHeader });
    const data = await res.json();
    const mapped = (data.results || []).map((m) => ({
      id: m.id,
      title: m.title,
      year: m.release_date ? Number(m.release_date.slice(0, 4)) : undefined,
      poster: m.poster_path,
      overview: m.overview,
      voteAvg: typeof m.vote_average === "number" ? m.vote_average : undefined,
      rating: ratingById?.[m.id] ?? 0,
      addedAt: new Date().toISOString(),
      watchedDates: [],
    }));
    setResults(mapped);
  };

  useEffect(() => {
    // initial discover (no upcoming by default)
    const init = async () => {
      if (!apiKey) return;
      const url = buildDiscoverUrl(sort);
      const res = await fetch(url, { headers: authHeader });
      const data = await res.json();
      const mapped = (data.results || []).map((m) => ({
        id: m.id,
        title: m.title,
        year: m.release_date ? Number(m.release_date.slice(0, 4)) : undefined,
        poster: m.poster_path,
        overview: m.overview,
        voteAvg: typeof m.vote_average === "number" ? m.vote_average : undefined,
        rating: ratingById?.[m.id] ?? 0,
        addedAt: new Date().toISOString(),
        watchedDates: [],
      }));
    setResults(mapped);
  };
    init();
  }, [apiKey, sort]);

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
        const res = await fetch(`${TMDB_BASE}/movie/${id}/watch/providers`, { headers: authHeader });
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
  useEffect(()=>{ if ((providersSel||[]).length){ ensureProvidersFor(results.map(r=> r.id)); } },[results, providersSel, apiKey]);

  const loadUpcoming = async () => {
    if (!apiKey) {
      alert("Enter your TMDb API key in Settings.");
      return;
    }
    if (!upcoming.length) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const upcomingUrl = `${TMDB_BASE}/discover/movie?include_adult=false&language=en-US&with_genres=27&region=US&sort_by=primary_release_date.asc&primary_release_date.gte=${y}-${m}-${d}`;
      const ures = await fetch(upcomingUrl, { headers: authHeader });
      const udata = await ures.json();
      const up = (udata.results || [])
        .slice(0, 9)
        .map((mm) => ({ id: mm.id, title: mm.title, date: mm.release_date, poster: mm.poster_path }));
      setUpcoming(up);
    }
    setShowUpcoming((v) => !v ? true : false);
  };

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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
        {results
          .filter(r => hideWatchlisted ? !(watchlistIds && watchlistIds.has(r.id)) : true)
          .filter(r => hideInLibrary ? !(inLibraryIds && inLibraryIds.has(r.id)) : true)
          .filter(r => {
            if (!(providersSel||[]).length) return true;
            const prov = providersRef.current.get(r.id) || [];
            return prov.some(p=> providersSel.includes(p));
          })
          .map((r) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <MovieCard
              item={r}
              onAdd={(it) => onAdd?.(it)}
              onUpdate={(it) => onAdd?.(it)}
              onRemove={(id) => onRemove?.(id)}
              showWatchlist={false}
              compact
              onOpenDetails={onOpenDetails}
              isInLibrary={inLibraryIds.has(r.id)}
              isWatchlisted={watchlistIds ? watchlistIds.has(r.id) : false}
              providers={(providersRef.current.get(r.id)||[])}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
