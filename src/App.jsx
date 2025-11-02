import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Search as SearchIcon, Film, Calendar as CalIcon, Trash2, Plus, Heart, Check, Tags, Share2 } from "lucide-react";

import knifeSvg from "./assets/whiteknife.svg";
import { Card, CardContent } from "./components/ui/card.jsx";
import { Button } from "./components/ui/button.jsx";
import { Input } from "./components/ui/input.jsx";
import { Textarea } from "./components/ui/textarea.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./components/ui/dialog.jsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs.jsx";
import { Slider } from "./components/ui/slider.jsx";
import { Label } from "./components/ui/label.jsx";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover.jsx";
import { Calendar } from "./components/ui/calendar.jsx";

// --------------- minimal utilities ---------------
const STORAGE_KEY = "horrorhub.library.v2";
const SETTINGS_KEY = "horrorhub.settings.v1";
const isoDateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();

// TMDb image helpers
function tmdbImg(path, size = "w342") {
  if (!path) return "";
  if (typeof path !== "string") return "";
  return path.startsWith("/") ? `https://image.tmdb.org/t/p/${size}${path}` : path;
}
function normalizePoster(item, size = "w342") {
  if (!item) return "";
  const p = item.poster || item.poster_path || "";
  return tmdbImg(p, size);
}

function loadLibrary() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; } }
function saveLibrary(lib) { localStorage.setItem(STORAGE_KEY, JSON.stringify(lib)); }

function loadSettings(){ try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); } catch { return {}; } }
function saveSettings(s){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

function useLibrary() {
  const [library, setLibrary] = useState(loadLibrary());
  useEffect(() => { saveLibrary(library); }, [library]);
  const upsert = (item) => setLibrary((prev) => {
    const map = new Map(prev.map((i) => [i.id, i]));
    map.set(item.id, { ...(map.get(item.id) || {}), ...item });
    return Array.from(map.values());
  });
  const remove = (id) => setLibrary((prev) => prev.filter((i) => i.id !== id));
  return { library, upsert, remove };
}

// Knife icon via CSS mask (inherits currentColor)
function KnifeIcon({ className = "h-5 w-5" }) {
  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        backgroundColor: "currentColor",
        WebkitMaskImage: `url(${knifeSvg})`,
        maskImage: `url(${knifeSvg})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
      aria-hidden="true"
    />
  );
}

function StarRating({ value = 0, onChange }) {
  const [hover, setHover] = useState(null);
  const display = hover ?? value;
  return (
    <div className="flex items-center gap-0" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          onClick={() => onChange?.(n)}
          className="p-0"
        >
          <KnifeIcon className={`h-5 w-5 ${display >= n ? "text-rose-500" : "text-zinc-500/40"}`} />
        </button>
      ))}
      <Button size="icon" variant="ghost" onClick={() => onChange?.(0)} title="Clear">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Ambient overlays (simple versions)
function FlickerOverlay(){
  return <div className="pointer-events-none fixed inset-0 z-30" style={{background:"radial-gradient(100px 60px at 5% 10%, rgba(239,68,68,0.06), transparent 60%), radial-gradient(120px 80px at 95% 90%, rgba(255,255,255,0.05), transparent 60%)"}}/>;
}
function FogOverlay(){
  return <div className="pointer-events-none fixed inset-0 z-20">
    <div style={{position:'absolute',inset:0,background:'radial-gradient(70% 60% at 10% 50%, rgba(255,255,255,0.025), transparent 70%)'}}/>
    <div style={{position:'absolute',inset:0,background:'radial-gradient(70% 60% at 90% 50%, rgba(255,255,255,0.025), transparent 70%)'}}/>
  </div>;
}
function LightsOutOverlay(){
  return <div className="pointer-events-none fixed inset-0 z-40" style={{background:"radial-gradient(ellipse at center, rgba(0,0,0,0) 35%, rgba(0,0,0,0.65) 75%)"}}/>;
}

// Provider helpers (optional TMDb wiring)
const providerSlug = (name = "") => {
  const n = String(name).toLowerCase();
  if (n.includes("netflix")) return "netflix";
  if (n.includes("prime")) return "prime";
  if (n.includes("hulu")) return "hulu";
  if (n.includes("disney")) return "disney";
  return null;
};

function useProviders(movieId) {
  const [providers, setProviders] = useState([]);
  useEffect(() => {
    const id = movieId;
    if (!id) return;
    const token = localStorage.getItem("horrorhub.tmdb.token");
    if (!token) return; // no token set, skip
    const controller = new AbortController();
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json;charset=utf-8" };
    (async () => {
      try {
        const res = await fetch(`https://api.themoviedb.org/3/movie/${id}/watch/providers`, { headers, signal: controller.signal });
        const data = await res.json();
        const us = data?.results?.US || {};
        const flatrate = Array.isArray(us.flatrate) ? us.flatrate : [];
        const ads = Array.isArray(us.ads) ? us.ads : [];
        const arr = [...flatrate, ...ads].map((p) => providerSlug(p.provider_name)).filter(Boolean);
        setProviders(Array.from(new Set(arr)));
      } catch {}
    })();
    return () => controller.abort();
  }, [movieId]);
  return providers;
}

function TagEditor({ tags = [], onChange }) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim().toLowerCase();
    if (!v) return; if (tags.includes(v)) return;
    onChange?.([...tags, v]); setInput("");
  };
  const remove = (t) => onChange?.(tags.filter((x) => x !== t));
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs">
          #{t}
          <button onClick={() => remove(t)} title="Remove">
            ×
          </button>
        </span>
      ))}
      <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Add tag" className="w-32" />
      <Button size="sm" onClick={add}>
        Add
      </Button>
    </div>
  );
}

function MovieCard({ item, onAdd, onUpdate, onRemove, compact = false, onOpenDetails, isInLibrary = false, isWatchlisted = false }) {
  const [open, setOpen] = useState(false);
  const [watchOpen, setWatchOpen] = useState(false);
  const [notes, setNotes] = useState(item.notes || "");
  const [tags, setTags] = useState(item.tags || []);
  const [rating, setRating] = useState(item.rating || 0);
  const [scares, setScares] = useState(item.scares ?? 5);
  const [date, setDate] = useState(new Date());

  const saveDetails = () => { onUpdate?.({ ...item, notes, tags, rating, scares }); setOpen(false); };
  const addWatch = () => { const iso = isoDateOnly(date); const watchedDates = Array.from(new Set([...(item.watchedDates || []), iso])); onUpdate?.({ ...item, watchedDates, watchlist: false }); setWatchOpen(false); };
  const addWatchToday = () => { const iso = isoDateOnly(new Date()); const watchedDates = Array.from(new Set([...(item.watchedDates || []), iso])); onUpdate?.({ ...item, watchedDates, watchlist: false }); setWatchOpen(false); };
  const addWatchLongAgo = () => { const iso = isoDateOnly(new Date(1900, 0, 1)); const watchedDates = Array.from(new Set([...(item.watchedDates || []), iso])); onUpdate?.({ ...item, watchedDates, watchlist: false }); setWatchOpen(false); };

  const poster = normalizePoster(item, "w342");

  if (compact) {
    return (
      <Card className="rounded-2xl overflow-hidden">
        <CardContent className="p-3 flex gap-3 items-center" tabIndex={0} onKeyDown={(e)=>{
          const key = e.key;
          if (key>='1' && key<='5'){ onUpdate? onUpdate({ ...item, rating: Number(key) }): onAdd?.({ ...item, rating: Number(key) }); }
          if (key==='w' || key==='W'){ onUpdate? onUpdate({ ...item, watchlist: !item.watchlist }): onAdd?.({ ...item, watchlist: true }); }
          if (key==='d' || key==='D'){ onOpenDetails?.(item); }
        }}>
          <div className="w-16 h-24 bg-muted rounded flex items-center justify-center cursor-pointer" onClick={() => onOpenDetails?.(item)} title="Open details">
            {poster ? <img src={poster} alt={item.title} className="w-16 h-24 object-cover" loading="lazy" /> : <Film className="h-6 w-6 opacity-60" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium leading-tight truncate cursor-pointer hover:underline" onClick={() => onOpenDetails?.(item)} title="Open details">
              {item.title} {item.year ? <span className="opacity-70 font-normal">({item.year})</span> : null}
              {(isInLibrary || isWatchlisted) && (
                <span className="ml-2 inline-flex gap-1 align-middle text-[10px]">
                  {isInLibrary && <span className="px-1 rounded bg-emerald-600/80 text-white">Library</span>}
                  {isWatchlisted && <span className="px-1 rounded bg-rose-600/80 text-white">Watchlist</span>}
                </span>
              )}
            </div>
            <div className="text-sm opacity-80 line-clamp-2">{item.overview}</div>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <StarRating value={rating} onChange={(v) => { setRating(v); onUpdate ? onUpdate({ ...item, rating: v }) : onAdd?.({ ...item, rating: v }); }} />
              <div className="text-xs opacity-70">Scare: {scares}</div>
              <Button size="sm" variant="outline" onClick={async ()=>{
                const canvas = document.createElement('canvas');
                canvas.width = 600; canvas.height = 900; const ctx = canvas.getContext('2d');
                ctx.fillStyle='#0b0b0b'; ctx.fillRect(0,0,canvas.width,canvas.height);
                if (poster){ const img=new Image(); img.crossOrigin='anonymous'; await new Promise(res=>{ img.onload=res; img.onerror=res; img.src=poster; }); ctx.drawImage(img, 40,60, 360,540); }
                ctx.fillStyle='#fff'; ctx.font='bold 28px system-ui, sans-serif'; ctx.fillText((item.title||'Untitled').slice(0,28), 40, 660);
                const knives = Math.round(rating||0); for(let k=0;k<5;k++){ ctx.fillStyle = k<knives? '#ef4444':'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(420+k*32,80); ctx.lineTo(440+k*32,96); ctx.lineTo(420+k*32,112); ctx.closePath(); ctx.fill(); }
                const url = canvas.toDataURL('image/png'); const a=document.createElement('a'); a.href=url; a.download=`${(item.title||'poster').replace(/[^a-z0-9]+/gi,'-')}.png`; a.click();
              }}><Share2 className="h-4 w-4 mr-1"/>Share</Button>

              <Dialog open={watchOpen} onOpenChange={setWatchOpen}>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="sm">
                    <CalIcon className="h-4 w-4 mr-1" />
                    Log watch
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Log a watch date</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">{date.toDateString()}</Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-2" align="start">
                        <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <div className="flex gap-2">
                      <Button onClick={addWatch}><Check className="h-4 w-4 mr-2" />Save date</Button>
                      <Button variant="outline" onClick={addWatchToday}><CalIcon className="h-4 w-4 mr-2" />Watched today</Button>
                      <Button variant="outline" onClick={addWatchLongAgo}><CalIcon className="h-4 w-4 mr-2" />Watched long ago</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Tags className="h-4 w-4 mr-1" />
                    Notes & Tags
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Edit details</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label>Notes</Label>
                      <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Tags</Label>
                      <TagEditor tags={tags} onChange={setTags} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                      <Button onClick={saveDetails}>Save</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={() => onAdd?.(item)}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
              <Button size="sm" variant={item.watchlist ? "default" : "outline"} onClick={() => onUpdate?.({ ...item, watchlist: !item.watchlist })}>
                <Heart className="h-4 w-4 mr-1" />
                {item.watchlist ? "Watchlisted" : "Watchlist"}
              </Button>
              {onRemove && (
                <Button size="icon" variant="ghost" onClick={() => onRemove(item.id)} title="Remove">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // non-compact simplified
  return (
    <Card className="rounded-2xl overflow-hidden">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="cursor-pointer" onClick={() => onOpenDetails?.(item)}>
            <div className="text-lg font-semibold hover:underline">
              {item.title} {item.year ? <span className="opacity-70 font-normal">({item.year})</span> : null}
            </div>
            <div className="text-sm opacity-80 line-clamp-2">{item.overview}</div>
          </div>
          <div className="flex gap-1">
            <Button size="sm" onClick={() => onAdd?.(item)}><Plus className="h-4 w-4 mr-1"/>Add</Button>
            {onRemove && <Button size="icon" variant="ghost" onClick={() => onRemove(item.id)} title="Remove"><Trash2 className="h-4 w-4"/></Button>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StarRating value={rating} onChange={(v) => onUpdate?.({ ...item, rating: v })} />
          <Button size="sm" variant={item.watchlist ? "default" : "outline"} onClick={() => onUpdate?.({ ...item, watchlist: !item.watchlist })}>
            <Heart className="h-4 w-4 mr-1" />
            {item.watchlist ? "Watchlisted" : "Watchlist"}
          </Button>
          <Dialog open={watchOpen} onOpenChange={setWatchOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm"><CalIcon className="h-4 w-4 mr-1"/>Log watch</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Log a watch date</DialogTitle></DialogHeader>
              <div className="flex flex-col gap-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">{date.toDateString()}</Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-2" align="start">
                    <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                  </PopoverContent>
                </Popover>
                <div className="flex gap-2">
                  <Button onClick={addWatch}><Check className="h-4 w-4 mr-2" />Save date</Button>
                  <Button variant="outline" onClick={addWatchToday}><CalIcon className="h-4 w-4 mr-2" />Watched today</Button>
                  <Button variant="outline" onClick={addWatchLongAgo}><CalIcon className="h-4 w-4 mr-2" />Watched long ago</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

function MovieDetails({ item, localItem, onBack, onUpdate }){
  const title = item?.title || localItem?.title || 'Movie';
  const year = item?.year || localItem?.year;
  const overview = item?.overview || localItem?.overview || '';
  const [date, setDate] = useState(new Date());
  const [watchOpen, setWatchOpen] = useState(false);
  const providers = useProviders(item?.id);

  const addWatch = () => {
    const iso = isoDateOnly(date);
    const watchedDates = Array.from(new Set([...(localItem?.watchedDates || []), iso]));
    onUpdate?.({ ...(localItem || item), watchedDates, watchlist: false });
    setWatchOpen(false);
  };
  const addWatchToday = () => {
    const iso = isoDateOnly(new Date());
    const watchedDates = Array.from(new Set([...(localItem?.watchedDates || []), iso]));
    onUpdate?.({ ...(localItem || item), watchedDates, watchlist: false });
    setWatchOpen(false);
  };
  const addWatchLongAgo = () => {
    const iso = isoDateOnly(new Date(1900, 0, 1));
    const watchedDates = Array.from(new Set([...(localItem?.watchedDates || []), iso]));
    onUpdate?.({ ...(localItem || item), watchedDates, watchlist: false });
    setWatchOpen(false);
  };
  return (
    <div className="space-y-3">
      <Button variant="outline" onClick={onBack}>← Back</Button>
      <div className="text-2xl font-bold">
        {title} {year? <span className="opacity-70 font-normal">({year})</span>: null}
        {Array.isArray(providers) && providers.length ? (
          <span className="ml-2 inline-flex gap-1 align-middle">
            {providers.slice(0,4).map((p)=> (
              <span key={p} title={p==='netflix'?'Netflix': p==='prime'?'Prime Video': p==='hulu'?'Hulu': p==='disney'?'Disney+': p}
                    className={`text-[10px] px-1 rounded text-white ${p==='netflix'?'bg-[#e50914]': p==='prime'?'bg-[#00a8e1]': p==='hulu'?'bg-[#1ce783]': p==='disney'?'bg-[#113ccf]':'bg-zinc-600'}`}>
                {p==='netflix'?'N': p==='prime'?'P': p==='hulu'?'H': p==='disney'?'D': p.slice(0,1).toUpperCase()}
              </span>
            ))}
          </span>
        ) : null}
      </div>
      <div className="text-sm opacity-80">{overview}</div>
      <TmdbMeta itemId={item?.id} />
      {Array.isArray(providers) && providers.length ? (
        <div className="text-xs opacity-80">Available on: {providers.map(p => (p==='netflix'?'Netflix': p==='prime'?'Prime Video': p==='hulu'?'Hulu': p==='disney'?'Disney+': p)).join(', ')}</div>
      ) : null}
      <CastGrid itemId={item?.id} />

      <Dialog open={watchOpen} onOpenChange={setWatchOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm"><CalIcon className="h-4 w-4 mr-1"/>Log watch</Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Log a watch date</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">{date.toDateString()}</Button>
              </PopoverTrigger>
              <PopoverContent className="p-2" align="start"><Calendar mode="single" selected={date} onSelect={setDate} initialFocus /></PopoverContent>
            </Popover>
            <div className="flex gap-2">
              <Button onClick={addWatch}><Check className="h-4 w-4 mr-2" />Save date</Button>
              <Button variant="outline" onClick={addWatchToday}><CalIcon className="h-4 w-4 mr-2" />Watched today</Button>
              <Button variant="outline" onClick={addWatchLongAgo}><CalIcon className="h-4 w-4 mr-2" />Watched long ago</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Button size="sm" variant="outline" onClick={async ()=>{
        const canvas = document.createElement('canvas');
        canvas.width = 800; canvas.height = 1200;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0b0b0b'; ctx.fillRect(0,0,canvas.width,canvas.height);
        if (item.poster){
          const img = new Image(); img.crossOrigin='anonymous';
          await new Promise(res=>{ img.onload=res; img.onerror=res; img.src=(normalizePoster(item, 'w500')||''); });
          const w = 500, h = 750; ctx.drawImage(img, 50, 80, w, h);
        }
        ctx.fillStyle = '#fff'; ctx.font = 'bold 34px system-ui, sans-serif';
        const fullTitle = `${item.title || 'Untitled'}${item.year? ' ('+item.year+')':''}`;
        ctx.fillText(fullTitle.slice(0,40), 50, 880);
        const knives = Math.round(localItem?.rating || item.rating || 0);
        for (let k=0;k<5;k++){
          ctx.fillStyle = k<knives? '#ef4444' : 'rgba(255,255,255,0.25)';
          ctx.beginPath(); ctx.moveTo(380+k*70,110); ctx.lineTo(420+k*70,140); ctx.lineTo(380+k*70,170); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.font='14px system-ui, sans-serif'; ctx.fillText('HorrorHub', 50, 1150);
        const url = canvas.toDataURL('image/png'); const a = document.createElement('a'); a.href=url; a.download=`${(item.title||'poster').replace(/[^a-z0-9]+/gi,'-')}.png`; a.click();
      }}>Share Poster Card</Button>
    </div>
  );
}

// Helper meta and cast components (use TMDb when token present)
function useTmdbHeaders(){
  const token = typeof window!=='undefined'? localStorage.getItem('horrorhub.tmdb.token'): null;
  return token? { Authorization:`Bearer ${token}`, 'Content-Type':'application/json;charset=utf-8' } : null;
}
function TmdbMeta({ itemId }){
  const headers = useTmdbHeaders();
  const [meta, setMeta] = useState(null);
  const [cert, setCert] = useState("");
  useEffect(()=>{
    if (!headers || !itemId) return; const controller = new AbortController();
    (async()=>{
      try{
        const [dres, rres] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/movie/${itemId}?language=en-US`, { headers, signal: controller.signal }),
          fetch(`https://api.themoviedb.org/3/movie/${itemId}/release_dates`, { headers, signal: controller.signal }),
        ]);
        const d = await dres.json(); setMeta(d);
        const rd = await rres.json(); const rels = rd?.results||[]; const us = rels.find(r=> r.iso_3166_1==='US'); const pick = (us?.release_dates||[]).find(x=> x.certification) || rels.flatMap(r=> r.release_dates||[]).find(x=> x.certification); setCert(pick?.certification||"");
      }catch{}
    })();
    return ()=> controller.abort();
  },[itemId]);
  if (!headers || !itemId) return null;
  return (
    <div className="text-xs opacity-80 flex items-center gap-3">
      {meta?.runtime? <span>Runtime: {meta.runtime}m</span> : null}
      {cert? <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-semibold">Rated {cert}</span> : null}
      {meta?.release_date? <span>Released: {new Date(meta.release_date).toLocaleDateString()}</span> : null}
    </div>
  );
}
function CastGrid({ itemId }){
  const headers = useTmdbHeaders();
  const [cast, setCast] = useState([]);
  useEffect(()=>{
    if (!headers || !itemId) return; const controller = new AbortController();
    (async()=>{
      try{
        const res = await fetch(`https://api.themoviedb.org/3/movie/${itemId}/credits?language=en-US`, { headers, signal: controller.signal }); const data = await res.json(); setCast((data?.cast||[]).slice(0,10));
      }catch{}
    })();
    return ()=> controller.abort();
  },[itemId]);
  if (!headers || !itemId) return null;
  if (!cast.length) return null;
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">Cast</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {cast.map(p=> (
          <div key={p.id} className="flex items-center gap-2 min-w-0">
            {p.profile_path? <img src={`https://image.tmdb.org/t/p/w185${p.profile_path}`} alt={p.name} className="w-8 h-8 rounded-full object-cover"/> : <div className="w-8 h-8 rounded-full bg-muted"/>}
            <div className="truncate">
              <div className="text-sm leading-tight truncate">{p.name}</div>
              <div className="text-xs opacity-70 truncate">as {p.character}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Discover({ onAdd, onOpenDetails }){
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [providersSel, setProvidersSel] = useState([]); // ['netflix','prime','hulu','disney']
  const providersRef = useRef(new Map()); // id -> [slugs]
  const samples = useMemo(() => ([
    { id:'stub-the-thing-1982', title:'The Thing', year:1982, poster:'', overview:'Scientists in Antarctica confront a shape-shifting alien.', watchedDates:[], rating:0, scares:6 },
    { id:'stub-halloween-1978', title:'Halloween', year:1978, poster:'', overview:'A masked killer stalks babysitters on Halloween night.', watchedDates:[], rating:0, scares:5 },
    { id:'stub-alien-1979', title:'Alien', year:1979, poster:'', overview:'A deadly organism terrorizes a spaceship crew.', watchedDates:[], rating:0, scares:7 },
  ]), []);
  const search = async () => {
    const term = q.trim();
    const token = localStorage.getItem('horrorhub.tmdb.token');
    if (!token) {
      // No token: fall back to samples/stub
      if (!term) { setResults(samples); return; }
      setResults([{ id: 'stub-'+term, title: term, year: undefined, poster: '', overview: 'No data (offline stub)', watchedDates: [], rating:0, scares:5 }]);
      return;
    }
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type':'application/json;charset=utf-8' };
    try {
      if (term) {
        const url = `https://api.themoviedb.org/3/search/movie?include_adult=false&language=en-US&query=${encodeURIComponent(term)}`;
        const res = await fetch(url, { headers });
        const data = await res.json();
        const mapped = (data.results||[]).map(m=> ({
          id: m.id,
          title: m.title,
          year: m.release_date? Number(m.release_date.slice(0,4)) : undefined,
          poster: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : '',
          overview: m.overview,
          watchedDates: [], rating: 0, scares: 5,
        }));
        setResults(mapped);
      } else {
        const url = `https://api.themoviedb.org/3/discover/movie?include_adult=false&language=en-US&with_genres=27&sort_by=popularity.desc&page=1`;
        const res = await fetch(url, { headers });
        const data = await res.json();
        const mapped = (data.results||[]).map(m=> ({
          id: m.id,
          title: m.title,
          year: m.release_date? Number(m.release_date.slice(0,4)) : undefined,
          poster: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : '',
          overview: m.overview,
          watchedDates: [], rating: 0, scares: 5,
        }));
        setResults(mapped);
      }
    } catch {
      // On error, keep samples
      if (!term) setResults(samples);
    }
  };

  // Helper to fetch and map TMDb lists
  const fetchList = async (url) => {
    const token = localStorage.getItem('horrorhub.tmdb.token');
    if (!token) { setResults(samples); return; }
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type':'application/json;charset=utf-8' };
    try {
      const res = await fetch(url, { headers });
      const data = await res.json();
      const mapped = (data.results||[]).map(m=> ({
        id: m.id,
        title: m.title,
        year: m.release_date? Number(m.release_date.slice(0,4)) : undefined,
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : '',
        overview: m.overview,
        watchedDates: [], rating: 0, scares: 5,
      }));
      setResults(mapped);
    } catch { /* ignore */ }
  };

  const loadPopular = async () => {
    const params = new URLSearchParams({ include_adult:'false', language:'en-US', with_genres:'27', sort_by:'popularity.desc', page:'1' });
    await fetchList(`https://api.themoviedb.org/3/discover/movie?${params.toString()}`);
  };
  const loadTopRated = async () => {
    const params = new URLSearchParams({ include_adult:'false', language:'en-US', with_genres:'27', sort_by:'vote_average.desc', 'vote_count.gte':'200', page:'1' });
    await fetchList(`https://api.themoviedb.org/3/discover/movie?${params.toString()}`);
  };
  const loadUpcoming = async () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth()+1).padStart(2,'0');
    const d = String(now.getDate()).padStart(2,'0');
    const base = `https://api.themoviedb.org/3/discover/movie?include_adult=false&language=en-US&with_genres=27&region=US&sort_by=primary_release_date.asc&primary_release_date.gte=${y}-${m}-${d}&page=1`;
    await fetchList(base);
  };
  const loadNewest = async () => {
    const params = new URLSearchParams({ include_adult:'false', language:'en-US', with_genres:'27', sort_by:'primary_release_date.desc', page:'1' });
    await fetchList(`https://api.themoviedb.org/3/discover/movie?${params.toString()}`);
  };
  // Simple debounce to auto-search after typing
  useEffect(()=>{
    const t = setTimeout(()=>{ if (q.length>=3 || q.length===0) search(); }, 400);
    return ()=> clearTimeout(t);
  }, [q]);

  // Fetch providers for current results when filters are active
  useEffect(()=>{
    const token = localStorage.getItem('horrorhub.tmdb.token');
    if (!token) return;
    if (!(providersSel||[]).length) return;
    const pending = results.map(r=> r.id).filter(id=> !providersRef.current.has(id));
    if (!pending.length) return;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type':'application/json;charset=utf-8' };
    (async()=>{
      await Promise.all(pending.map(async(id)=>{
        try{
          const res = await fetch(`https://api.themoviedb.org/3/movie/${id}/watch/providers`, { headers });
          const data = await res.json();
          const us = data?.results?.US || {};
          const flatrate = Array.isArray(us.flatrate)? us.flatrate : [];
          const ads = Array.isArray(us.ads)? us.ads : [];
          const arr = [...flatrate, ...ads].map(p=> providerSlug(p.provider_name)).filter(Boolean);
          providersRef.current.set(id, Array.from(new Set(arr)));
        }catch{ providersRef.current.set(id, []); }
      }));
    })();
  }, [results, providersSel]);
  return (
    <div className="space-y-4">
      <ProviderLegend />
      <div className="flex gap-2 items-center">
        <Input id="discover-query" name="q" placeholder="Search horror (title)..." value={q} onChange={(e)=> setQ(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') search(); }} />
        <Button size="sm" onClick={search}><SearchIcon className="h-4 w-4 mr-2"/>Search</Button>
      </div>
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <span className="opacity-70 text-xs">Quick picks:</span>
        <Button size="sm" variant="outline" onClick={loadPopular}>Popular</Button>
        <Button size="sm" variant="outline" onClick={loadTopRated}>Top Rated</Button>
        <Button size="sm" variant="outline" onClick={loadNewest}>Newest</Button>
        <Button size="sm" variant="outline" onClick={loadUpcoming}>Upcoming</Button>
        <Button size="sm" variant="outline" onClick={async ()=>{
          const token = localStorage.getItem('horrorhub.tmdb.token'); if (!token) return;
          const headers = { Authorization: `Bearer ${token}`, 'Content-Type':'application/json;charset=utf-8' };
          const url = `https://api.themoviedb.org/3/discover/movie?include_adult=false&language=en-US&with_genres=27&with_runtime.lte=90&primary_release_date.lte=1985-12-31&sort_by=primary_release_date.desc&page=1`;
          try{ const res = await fetch(url, { headers }); const data = await res.json(); const mapped=(data.results||[]).map(m=>({ id:m.id,title:m.title,year:m.release_date?Number(m.release_date.slice(0,4)):undefined, poster:m.poster_path?`https://image.tmdb.org/t/p/w342${m.poster_path}`:'', overview:m.overview, watchedDates:[], rating:0, scares:5 })); setResults(mapped); }catch{}
        }}>Classic &lt;90m</Button>
        <Button size="sm" variant="outline" onClick={async ()=>{
          const token = localStorage.getItem('horrorhub.tmdb.token'); if (!token) return;
          const headers = { Authorization: `Bearer ${token}`, 'Content-Type':'application/json;charset=utf-8' };
          const url = `https://api.themoviedb.org/3/discover/movie?include_adult=false&language=en-US&with_genres=27&with_runtime.lte=90&sort_by=vote_average.desc&vote_count.gte=200&page=1`;
          try{ const res = await fetch(url, { headers }); const data = await res.json(); const mapped=(data.results||[]).map(m=>({ id:m.id,title:m.title,year:m.release_date?Number(m.release_date.slice(0,4)):undefined, poster:m.poster_path?`https://image.tmdb.org/t/p/w342${m.poster_path}`:'', overview:m.overview, watchedDates:[], rating:0, scares:5 })); setResults(mapped); }catch{}
        }}>Cold Night</Button>
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
        {(providersSel||[]).length ? (
          <span className="text-xs opacity-70">Filtering list by selected providers</span>
        ) : null}
      </div>
      {results.length === 0 ? (
        <div className="text-sm opacity-70">Type a title and press Search, or leave the box empty and click Search to load a few sample titles.</div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(providersSel.length? results.filter(r=> {
          const prov = providersRef.current.get(r.id) || [];
          return prov.some(p=> providersSel.includes(p));
        }) : results).map((r)=> (
          <motion.div key={r.id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}>
            <MovieCard item={r} onAdd={onAdd} onUpdate={onAdd} onOpenDetails={onOpenDetails} compact />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Continuity (graph) ----------------
function ContinuityView({ library = [], onOpenDetails }) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('horrorhub.tmdb.token') : null;
  const [edges, setEdges] = useState([]); // {from, to}
  const [nodes, setNodes] = useState([]); // {id,title,poster}
  const [loading, setLoading] = useState(false);

  const seeds = useMemo(() => {
    const rated = [...library].filter(i => (i.rating || 0) >= 4);
    const pick = (rated.length ? rated : library).slice(0, 3);
    return pick.map(i => ({ id: i.id_tmdb || i.id, title: i.title, raw: i }));
  }, [library]);

  useEffect(() => {
    if (!token || !seeds.length) { setEdges([]); setNodes([]); return; }
    const controller = new AbortController();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type':'application/json;charset=utf-8' };
    (async () => {
      setLoading(true);
      try {
        const center = seeds.map(s => ({ id: String(s.id), title: s.title, poster: normalizePoster(s.raw) }));
        const seen = new Map(center.map(n => [n.id, n]));
        const newEdges = [];
        for (const s of seeds) {
          const sid = String(s.id);
          if (!/^\d+$/.test(sid)) continue;
          const recRes = await fetch(`https://api.themoviedb.org/3/movie/${sid}/recommendations?language=en-US&page=1`, { headers, signal: controller.signal });
          const data = await recRes.json();
          const results = Array.isArray(data?.results) ? data.results.slice(0, 8) : [];
          for (const r of results) {
            const nid = String(r.id);
            if (!seen.has(nid)) {
              const node = { id: nid, title: r.title, poster: tmdbImg(r.poster_path, 'w185') };
              seen.set(nid, node);
            }
            newEdges.push({ from: sid, to: String(r.id) });
          }
        }
        setNodes([...seen.values()]);
        setEdges(newEdges);
      } catch (e) {
        console.error('Continuity fetch failed', e);
        setNodes([]); setEdges([]);
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [token, seeds]);

  const layout = useMemo(() => {
    const centers = seeds.map((s, idx) => ({ id: String(s.id), x: 200 + idx*220, y: 120 }));
    const recs = nodes.filter(n => !centers.find(c => c.id === n.id));
    const R = 140;
    const cx = 300, cy = 240;
    const placed = recs.map((n, i) => ({ id: n.id, x: cx + R * Math.cos((i/recs.length || 1) * 2*Math.PI), y: cy + R * Math.sin((i/recs.length || 1) * 2*Math.PI) }));
    return { centers, placed };
  }, [nodes, seeds]);

  const mapPos = (id) => {
    const c = layout.centers.find(p => p.id === id);
    if (c) return c;
    const p = layout.placed.find(p => p.id === id);
    return p || { x: 0, y: 0 };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Continuity Navigator</div>
        <div className="text-xs opacity-70">Seeds: {seeds.map(s => s.title).join(', ') || 'None'} { !token && '(add TMDb token in Settings)' }</div>
      </div>
      <div className="rounded-2xl border bg-black/20">
        <svg viewBox="0 0 640 360" className="w-full h-[360px]">
          <g stroke="rgba(255,255,255,0.2)" strokeWidth="1">
            {edges.map((e, idx) => {
              const a = mapPos(e.from), b = mapPos(e.to);
              return <line key={idx} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            })}
          </g>
          <g>
            {nodes.map(n => {
              const p = mapPos(n.id);
              return (
                <g key={n.id} transform={`translate(${p.x-20}, ${p.y-20})`}>
                  <circle cx="20" cy="20" r="22" fill="rgba(239,68,68,0.2)" stroke="rgba(239,68,68,0.6)" />
                  <image href={n.poster || ''} x={-6} y={-6} width={52} height={52} preserveAspectRatio="xMidYMid slice" clipPath="circle(20px at 20px 20px)" />
                  <title>{n.title}</title>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="text-sm opacity-80">Edges</div>
      <div className="grid md:grid-cols-2 gap-2">
        {edges.length ? edges.slice(0, 20).map((e, idx) => {
          const A = nodes.find(n => n.id === e.from)?.title || e.from;
          const B = nodes.find(n => n.id === e.to)?.title || e.to;
          return <div key={idx} className="text-xs opacity-75">{A} → {B}</div>
        }) : <div className="text-xs opacity-60">No continuity edges yet.</div>}
      </div>
    </div>
  );
}
function ProviderLegend(){
  return (
    <div className="flex items-center gap-2 text-xs opacity-70">
      <span className="inline-block text-[9px] px-1 rounded text-white bg-[#e50914]" title="Netflix">N</span>
      <span className="inline-block text-[9px] px-1 rounded text-white bg-[#00a8e1]" title="Prime Video">P</span>
      <span className="inline-block text-[9px] px-1 rounded text-white bg-[#1ce783]" title="Hulu">H</span>
      <span className="inline-block text-[9px] px-1 rounded text-white bg-[#113ccf]" title="Disney+">D</span>
      <span>provider legend</span>
    </div>
  );
}

function Settings({ settings, onChange }){
  const [token, setToken] = useState(() => localStorage.getItem('horrorhub.tmdb.token') || '');
  const [highContrast, setHighContrast] = useState(settings?.highContrast ?? false);
  const [dyslexic, setDyslexic] = useState(settings?.dyslexic ?? false);
  const [flicker, setFlicker] = useState(settings?.flicker ?? true);
  const [fog, setFog] = useState(settings?.fog ?? true);
  const [lightsOut, setLightsOut] = useState(settings?.lightsOut ?? false);
  const [nudgeDays, setNudgeDays] = useState(settings?.nudgeDays ?? 7);
  const [mGhosts, setMGhosts] = useState(settings?.mixerGhosts ?? 1);
  const [mOccult, setMOccult] = useState(settings?.mixerOccult ?? 1);
  const [mSlasher, setMSlasher] = useState(settings?.mixerSlasher ?? 1);
  const [mFolk, setMFolk] = useState(settings?.mixerFolk ?? 1);
  useEffect(()=>{ try{ localStorage.setItem('horrorhub.tmdb.token', token||''); }catch{} },[token]);
  useEffect(()=>{ onChange?.({ highContrast, dyslexic, flicker, fog, lightsOut, nudgeDays, mixerGhosts:mGhosts, mixerOccult:mOccult, mixerSlasher:mSlasher, mixerFolk:mFolk }); },[highContrast,dyslexic,flicker,fog,lightsOut,nudgeDays,mGhosts,mOccult,mSlasher,mFolk]);
  return (
    <div className="space-y-4 w-full">
      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-2">
          <div className="text-lg font-semibold">Connections</div>
          <Label className="text-sm">TMDb API Access Token (v4 Bearer)</Label>
          <Input type="password" placeholder="Paste your Bearer token" value={token} onChange={(e)=> setToken(e.target.value)} />
          <div className="text-xs opacity-70">Used by Discover, Recommendations, Roulette, and provider badges. Stored locally in your browser only.</div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-3">
          <div className="text-lg font-semibold">Appearance & Ambience</div>
          <div className="grid grid-cols-2 gap-2 text-sm items-center">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={highContrast} onChange={(e)=> setHighContrast(e.target.checked)} /> High contrast</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={dyslexic} onChange={(e)=> setDyslexic(e.target.checked)} /> Dyslexia font</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={flicker} onChange={(e)=> setFlicker(e.target.checked)} /> Edge flicker</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={fog} onChange={(e)=> setFog(e.target.checked)} /> Fog overlay</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={lightsOut} onChange={(e)=> setLightsOut(e.target.checked)} /> Lights‑out vignette</label>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-2">
          <div className="text-lg font-semibold">Reminders</div>
          <div className="flex items-center gap-2 text-sm">
            <Label className="text-sm">Nudge cadence (days)</Label>
            <Input type="number" min={3} max={14} className="w-24" value={nudgeDays} onChange={(e)=> setNudgeDays(Math.min(14, Math.max(3, Number(e.target.value)||7)))} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-2">
          <div className="text-lg font-semibold">Subgenre Mixer (defaults)</div>
          <div className="grid grid-cols-2 gap-3 text-sm items-center">
            <Label>Ghosts</Label><Slider value={[mGhosts]} min={0} max={2} step={1} onValueChange={(v)=> setMGhosts(v[0])} />
            <Label>Occult</Label><Slider value={[mOccult]} min={0} max={2} step={1} onValueChange={(v)=> setMOccult(v[0])} />
            <Label>Slasher</Label><Slider value={[mSlasher]} min={0} max={2} step={1} onValueChange={(v)=> setMSlasher(v[0])} />
            <Label>Folk</Label><Slider value={[mFolk]} min={0} max={2} step={1} onValueChange={(v)=> setMFolk(v[0])} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LibraryView({ items, onUpdate, onRemove, onOpenDetails }){
  const [query, setQuery] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [tagFilter, setTagFilter] = useState("");

  const allTags = useMemo(() => {
    const counts = new Map();
    items.forEach((i) => (i.tags || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    return Array.from(counts.entries()).sort((a,b)=> b[1]-a[1] || String(a[0]).localeCompare(String(b[0]))).map(([t])=> t);
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = items;
    if (q) {
      arr = arr.filter((i)=> (i.title||"").toLowerCase().includes(q) || (i.notes||"").toLowerCase().includes(q) || (i.tags||[]).some(t=> String(t).toLowerCase().includes(q)) );
    }
    if (tagFilter) arr = arr.filter((i)=> (i.tags||[]).includes(tagFilter));
    arr = arr.filter((i)=> (i.rating||0) >= minRating);
    return arr;
  }, [items, query, tagFilter, minRating]);

  return (
    <div className="space-y-3">
      <div className="text-lg font-semibold">My Library</div>
      <ProviderLegend />

      <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl border">
        <div className="flex items-center gap-2">
          <Label>Search</Label>
          <Input value={query} onChange={(e)=> setQuery(e.target.value)} placeholder="title, notes, tags" className="w-64" />
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-sm">Min rating</Label>
          <Slider value={[minRating]} min={0} max={5} step={0.5} className="w-40" onValueChange={(v)=> setMinRating(v[0])} />
          <span className="text-sm opacity-70 w-6 text-right">{minRating}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant={tagFilter===""? 'default':'outline'} onClick={()=> setTagFilter("")}>All tags</Button>
          {(allTags.slice(0, tagsExpanded ? allTags.length : 5)).map((t)=> (
            <Button key={t} size="sm" variant={tagFilter===t? 'default':'outline'} onClick={()=> setTagFilter(t)}>#{t}</Button>
          ))}
          {allTags.length>5 ? (
            <Button size="sm" variant="ghost" onClick={()=> setTagsExpanded(v=>!v)}>{tagsExpanded? 'Show fewer':'Show more'}</Button>
          ): null}
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={()=> { setQuery(""); setMinRating(0); setTagFilter(""); setTagsExpanded(false); }}>Clear</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((i)=> (
          <MovieCard key={i.id} item={i} onUpdate={onUpdate} onRemove={onRemove} compact onOpenDetails={onOpenDetails} isInLibrary={true} />
        ))}
      </div>
    </div>
  );
}

function StatsView({ items }){
  const total = items.length;
  const avg = (items.reduce((s,i)=> s+(i.rating||0),0)/Math.max(1,total)).toFixed(2);
  const avgScare = (items.reduce((s,i)=> s+(i.scares||0),0)/Math.max(1,total)).toFixed(2);
  const watches = items.reduce((s,i)=> s+(i.watchedDates?.length||0),0);

  // streak calc
  const allDates = items.flatMap(i=> (i.watchedDates||[])).map(d=> new Date(d).toDateString());
  const uniqueDates = Array.from(new Set(allDates)).map(s=> new Date(s)).sort((a,b)=> a-b);
  let currentStreak = 0;
  if (uniqueDates.length){
    // count consecutive days backward from most recent
    let idx = uniqueDates.length-1;
    let last = uniqueDates[idx];
    currentStreak = 1;
    while(idx-1>=0){
      const expect = new Date(last); expect.setDate(expect.getDate()-1);
      if (uniqueDates[idx-1].toDateString() === expect.toDateString()){ currentStreak++; last = uniqueDates[idx-1]; idx--; }
      else break;
    }
  }
  const xp = watches*10 + Math.max(0,currentStreak-1)*5 + Math.round(items.filter(i=> (i.rating||0)>=4).length*2);

  const tagCounts = useMemo(()=>{
    const m = new Map();
    items.forEach(i=> (i.tags||[]).forEach(t=> m.set(t, (m.get(t)||0)+1)));
    return Array.from(m.entries()).sort((a,b)=> b[1]-a[1]);
  },[items]);
  const topTags = tagCounts.slice(0,10).map(([t])=> t);
  const tagIndex = Object.fromEntries(topTags.map((t,idx)=> [t,idx]));
  const matrix = Array.from({length: topTags.length}, ()=> Array(topTags.length).fill(0));
  items.forEach(i=>{
    const t = (i.tags||[]).filter(x=> tagIndex[x]!==undefined);
    for(let a=0;a<t.length;a++) for(let b=0;b<t.length;b++) if(a!==b) matrix[tagIndex[t[a]]][tagIndex[t[b]]]++;
  });
  const maxAffinity = Math.max(1, ...matrix.flat());
  const [showAff, setShowAff] = useState(false);

  const recent = items.flatMap(i=> (i.watchedDates||[]).map(d=> ({title:i.title, date:d}))).sort((a,b)=> new Date(b.date)-new Date(a.date)).slice(0,8);

  // badges
  const watchedSet = new Set(items.filter(i=> (i.watchedDates||[]).length).map(i=> i.id));
  const isWatched = (i)=> watchedSet.has(i.id);
  const folkBadge = items.filter(i=> isWatched(i) && (i.tags||[]).includes('folk-horror')).length >= 3;
  const slasher80s = items.filter(i=> isWatched(i) && (i.tags||[]).includes('slasher') && (i.year||0)>=1980 && (i.year||0)<=1989).length >= 3;
  const marathon3 = currentStreak >= 3;
  const ghosts5 = items.filter(i=> isWatched(i) && ((i.tags||[]).some(t=> ['ghost','haunted','possession','supernatural'].includes(String(t).toLowerCase())))).length >= 5;
  const gore5 = items.filter(i=> isWatched(i) && ((i.tags||[]).some(t=> ['gore','graphic-violence'].includes(String(t).toLowerCase())))).length >= 5;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="p-3 rounded-2xl border">
          <div className="text-xs opacity-70">Movies</div>
          <div className="text-2xl font-semibold">{total}</div>
        </div>
        <div className="p-3 rounded-2xl border">
          <div className="text-xs opacity-70">Avg rating</div>
          <div className="text-2xl font-semibold">{avg}</div>
        </div>
        <div className="p-3 rounded-2xl border">
          <div className="text-xs opacity-70">Avg scare</div>
          <div className="text-2xl font-semibold">{avgScare}</div>
        </div>
        <div className="p-3 rounded-2xl border">
          <div className="text-xs opacity-70">Total watches</div>
          <div className="text-2xl font-semibold">{watches}</div>
        </div>
      </div>

      <div className="rounded-2xl border p-4 space-y-2">
        <div className="text-lg font-semibold">Badges & XP</div>
        <div className="text-sm">XP: <span className="font-semibold">{xp}</span> · Streak: <span className="font-semibold">{currentStreak}d</span></div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className={`px-2 py-1 rounded ${folkBadge?'bg-emerald-600 text-white':'bg-muted'}`}>Folk Horror Initiate</span>
          <span className={`px-2 py-1 rounded ${slasher80s?'bg-emerald-600 text-white':'bg-muted'}`}>80s Slasher Fan</span>
          <span className={`px-2 py-1 rounded ${marathon3?'bg-emerald-600 text-white':'bg-muted'}`}>Midnight Marathon (3 in a row)</span>
          <span className={`px-2 py-1 rounded ${ghosts5?'bg-emerald-600 text-white':'bg-muted'}`}>Ghost Hunter</span>
          <span className={`px-2 py-1 rounded ${gore5?'bg-emerald-600 text-white':'bg-muted'}`}>Gore Hound</span>
        </div>
      </div>

      <div className="rounded-2xl border p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Tag affinity (top 10)</div>
          <Button size="sm" variant="outline" onClick={()=> setShowAff(v=>!v)}>{showAff? 'Hide':'Show'}</Button>
        </div>
        {!showAff ? (
          <div className="text-sm opacity-70">Shows co-occurrence strength between your most-used tags.</div>
        ) : topTags.length ? (
          <div className="overflow-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr>
                  <th className="p-2 text-left"></th>
                  {topTags.map(t=> <th key={t} className="p-2 text-left whitespace-nowrap">#{t}</th>)}
                </tr>
              </thead>
              <tbody>
                {topTags.map((row,i)=> (
                  <tr key={row}>
                    <td className="p-2 font-medium whitespace-nowrap">#{row}</td>
                    {topTags.map((col,j)=> {
                      const val = matrix[i][j];
                      const alpha = val? 0.2 + 0.8*(val/maxAffinity) : 0.04;
                      return <td key={row+col} className="p-2"><div className="w-6 h-6 rounded" style={{background:`rgba(16,185,129,${alpha})`}}/></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm opacity-70">Add tags to see affinities.</div>
        )}
      </div>

      <div className="rounded-2xl border p-4">
        <div className="text-lg font-semibold mb-2">Recently watched</div>
        <div className="grid md:grid-cols-2 gap-2">
          {recent.length? recent.map((r,idx)=> (
            <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-muted">
              <div className="truncate pr-3">{r.title}</div>
              <div className="text-xs opacity-70">{new Date(r.date).toLocaleDateString()}</div>
            </div>
          )): <div className="opacity-70">Nothing logged yet</div>}
        </div>
      </div>
    </div>
  );
}

function WatchlistView({ items, onUpdate, onRemove, onOpenDetails }){
  const watch = items.filter(i => i.watchlist);
  const tonight = watch.length ? watch[Math.floor(Math.random()*watch.length)] : null;
  // Simple ICS exporter
  const createICS = ({ events }) => {
    const pad = (n)=> String(n).padStart(2,'0');
    const fmt = (d)=>{
      const dt = new Date(d); return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth()+1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00Z`;
    };
    const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//HorrorHub//EN"];
    events.forEach((e,i)=>{ lines.push("BEGIN:VEVENT",`UID:${i}-${Date.now()}@horrorhub`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(e.start)}`, e.end?`DTEND:${fmt(e.end)}`:`DURATION:PT2H`, `SUMMARY:${e.title.replace(/\n/g,' ')}`, "END:VEVENT"); });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  };
  const exportPlan = () => {
    if (!watch.length) return;
    const start = new Date(); start.setHours(20,0,0,0);
    const events = watch.slice(0, Math.min(28, watch.length)).map((m,idx)=> ({ title:`Watch: ${m.title} (${m.year||''})`, start: new Date(start.getTime() + idx*24*60*60*1000)}));
    const ics = createICS({ events });
    const blob = new Blob([ics], { type:'text/calendar' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`horrorhub-plan-${new Date().toISOString().slice(0,10)}.ics`; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-3">
      <div className="text-lg font-semibold">Your Watchlist</div>
      <ProviderLegend />
      <div className="rounded-2xl border p-3">
        <div className="text-sm opacity-80">Tonight's pick</div>
        {tonight ? (
          <div className="flex items-center justify-between mt-1">
            <button className="hover:underline text-left" onClick={()=> onOpenDetails?.(tonight)}>{tonight.title}</button>
            <Button size="sm" variant="outline" onClick={()=> onUpdate?.({ ...tonight, watchlist: false })}>Remove</Button>
          </div>
        ) : (
          <div className="text-xs opacity-70">Add items to your watchlist to enable.</div>
        )}
        <div className="mt-2">
          <Button size="sm" variant="outline" onClick={exportPlan}>Export weekly plan (ICS)</Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {watch.map((i)=> (
          <MovieCard key={i.id} item={i} onUpdate={onUpdate} onRemove={onRemove} compact onOpenDetails={onOpenDetails} isInLibrary={true} />
        ))}
      </div>
    </div>
  );
}

function RecommendationsView({ onAdd, onOpenDetails, library=[] }){
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mood, setMood] = useState(5); // 0=spooky, 10=traumatizing
  const [mix, setMix] = useState({ ghosts: 1, occult: 1, slasher: 1, folk: 1 });
  const token = typeof window !== 'undefined' ? localStorage.getItem('horrorhub.tmdb.token') : null;
  const [edges, setEdges] = useState([]); // continuity edges
  useEffect(()=>{
    if (!token) return;
    const controller = new AbortController();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type':'application/json;charset=utf-8' };
    (async()=>{
      setLoading(true);
      try{
        // Basic mood/mix heuristics: adjust sort and year filters
        const params = new URLSearchParams({ include_adult:'false', language:'en-US', with_genres:'27', sort_by: mood>=7? 'vote_average.desc':'popularity.desc', page:'1' });
        if (mood>=7) params.set('vote_count.gte','200'); // favor acclaimed
        // crude subgenre weighting via keywords
        const kw = [];
        if (mix.ghosts>1) kw.push('9715'); // ghost
        if (mix.occult>1) kw.push('1595'); // occult
        if (mix.slasher>1) kw.push('14967'); // slasher
        if (mix.folk>1) kw.push('80308'); // folk horror
        if (kw.length) params.set('with_keywords', kw.join(','));
        const url = `https://api.themoviedb.org/3/discover/movie?${params.toString()}`;
        const res = await fetch(url, { headers, signal: controller.signal });
        const data = await res.json();
        const map = (m)=> ({
          id: m.id,
          title: m.title,
          year: m.release_date ? Number(m.release_date.slice(0,4)) : undefined,
          poster: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : '',
          overview: m.overview,
          watchedDates: [],
          rating: 0,
          scares: 5,
        });
        setRecs((data.results||[]).slice(0,18).map(map));
      } catch {} finally { setLoading(false); }
    })();
    return ()=> controller.abort();
  }, [token]);
  // Continuity: because you liked X -> try Y (use one highly rated title from library)
  useEffect(()=>{
    if (!token) return; const top = (library||[]).filter(i=> (i.rating||0)>=4 && Number.isFinite(Number(i.id))).slice(0,1);
    if (!top.length) { setEdges([]); return; }
    const controller = new AbortController();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type':'application/json;charset=utf-8' };
    (async()=>{
      try{
        const res = await fetch(`https://api.themoviedb.org/3/movie/${top[0].id}/recommendations?language=en-US&page=1`, { headers, signal: controller.signal });
        const data = await res.json();
        const picks = (data.results||[]).slice(0,5).map(m=> ({ id:m.id, title:m.title }));
        setEdges(picks.map(p=> ({ from: top[0], to: p })));
      }catch{ setEdges([]); }
    })();
    return ()=> controller.abort();
  }, [token, library]);
  return (
    <div className="space-y-3">
      <div className="text-lg font-semibold">Recommendations</div>
      {!token ? (
        <div className="text-sm opacity-80">Set your TMDb v4 token to load picks: <code>localStorage.setItem('horrorhub.tmdb.token','YOUR_BEARER_TOKEN')</code></div>
      ) : null}
      <div className="rounded-2xl border p-3 space-y-3">
        <div className="text-sm font-medium">How scared do you want to be tonight?</div>
        <div className="flex items-center gap-3">
          <span className="text-xs opacity-70">Spooky</span>
          <Slider value={[mood]} min={0} max={10} step={1} className="w-64" onValueChange={(v)=> setMood(v[0])} />
          <span className="text-xs opacity-70">Traumatizing</span>
          <span className="text-xs opacity-70">({mood})</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm items-center">
          <Label>Ghosts</Label>
          <Slider value={[mix.ghosts]} min={0} max={2} step={1} onValueChange={(v)=> setMix(m=>({...m, ghosts:v[0]}))} />
          <Label>Occult</Label>
          <Slider value={[mix.occult]} min={0} max={2} step={1} onValueChange={(v)=> setMix(m=>({...m, occult:v[0]}))} />
          <Label>Slasher</Label>
          <Slider value={[mix.slasher]} min={0} max={2} step={1} onValueChange={(v)=> setMix(m=>({...m, slasher:v[0]}))} />
          <Label>Folk</Label>
          <Slider value={[mix.folk]} min={0} max={2} step={1} onValueChange={(v)=> setMix(m=>({...m, folk:v[0]}))} />
        </div>
        <div className="text-xs opacity-70">Adjust sliders then revisit this tab to refresh, or I can auto-refresh on change if you prefer.</div>
      </div>
      {loading ? <div className="text-sm opacity-70">Loading…</div> : null}
      {edges.length ? (
        <div className="rounded-2xl border p-3 space-y-2">
          <div className="text-sm font-medium">Continuity Navigator</div>
          <div className="relative w-full h-40">
            <svg width="100%" height="100%" viewBox="0 0 600 160">
              <circle cx="100" cy="80" r="24" fill="#ef4444"/>
              <text x="100" y="80" textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="10">You</text>
              {edges.map((e,idx)=>{
                const x = 220 + idx*90; const y = 40 + (idx%2)*80;
                return (
                  <g key={idx}>
                    <line x1="124" y1="80" x2={x} y2={y} stroke="#888" strokeWidth="1.5"/>
                    <circle cx={x} cy={y} r="18" fill="#16a34a"/>
                    <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="9">{idx+1}</text>
                  </g>
                );
              })}
            </svg>
          </div>
          {edges.map((e,idx)=> (
            <div key={idx} className="text-sm">
              Because you liked <button className="hover:underline" onClick={()=> onOpenDetails?.(e.from)}>{e.from.title}</button> → try <button className="hover:underline" onClick={()=> onOpenDetails?.(e.to)}>{e.to.title}</button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {recs.map((r)=> (
          <motion.div key={r.id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}>
            <MovieCard item={r} onAdd={onAdd} onUpdate={onAdd} onOpenDetails={onOpenDetails} compact />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function RatingRoulette({ onAdd, onOpenDetails, ratingById, inLibraryIds, watchlistIds }){
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageSize, setPageSize] = useState(12);
  const [hideRated, setHideRated] = useState(true);
  const [hideInLibrary, setHideInLibrary] = useState(false);
  const [hideWatchlisted, setHideWatchlisted] = useState(false);
  const [providersSel, setProvidersSel] = useState([]);
  const provRef = useRef(new Map()); // id -> [slugs]
  const cacheRef = useRef(new Map());
  const token = typeof window !== 'undefined' ? localStorage.getItem('horrorhub.tmdb.token') : null;
  const headers = token ? { Authorization: `Bearer ${token}`, 'Content-Type':'application/json;charset=utf-8' } : undefined;

  useEffect(()=>{
    const run = async()=>{
      if (!token){ setRows([]); return; }
      if (cacheRef.current.has(page)) { setRows(cacheRef.current.get(page)); return; }
      setLoading(true);
      try{
        const url = `https://api.themoviedb.org/3/discover/movie?include_adult=false&language=en-US&with_genres=27&sort_by=popularity.desc&page=${page}`;
        const res = await fetch(url, { headers });
        const data = await res.json();
        const mapped = (data.results||[]).map(m=> ({ id:m.id, title:m.title, year:m.release_date? Number(m.release_date.slice(0,4)) : undefined, poster: m.poster_path? `https://image.tmdb.org/t/p/w342${m.poster_path}`:'', overview:m.overview, watchedDates:[], rating: ratingById[m.id]||0, scares:5 }));
        cacheRef.current.set(page, mapped); setRows(mapped);
      } catch { setRows([]); } finally { setLoading(false); }
    };
    run();
  }, [page, token]);

  const derived = rows.map(r=> ({ ...r, rating: ratingById[r.id] || r.rating || 0 }));
  const filtered = derived.filter(r=> {
    if (hideRated && (r.rating||0)>0) return false;
    if (hideInLibrary && inLibraryIds.has(r.id)) return false;
    if (hideWatchlisted && watchlistIds.has(r.id)) return false;
    if ((providersSel||[]).length){
      const p = provRef.current.get(r.id) || [];
      if (!p.some(x=> providersSel.includes(x))) return false;
    }
    return true;
  });
  const display = filtered.slice(0, pageSize);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Rating Roulette</div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={hideRated} onChange={(e)=> setHideRated(e.target.checked)} /> Hide rated</label>
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={hideInLibrary} onChange={(e)=> setHideInLibrary(e.target.checked)} /> Skip in library</label>
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={hideWatchlisted} onChange={(e)=> setHideWatchlisted(e.target.checked)} /> Skip watchlisted</label>
          <div className="flex items-center gap-2 text-sm">
            <span>Providers</span>
            {['netflix','prime','hulu','disney'].map(k=> (
              <label key={k} className="inline-flex items-center gap-1">
                <input type="checkbox" checked={providersSel.includes(k)} onChange={(e)=> setProvidersSel(prev=> e.target.checked ? Array.from(new Set([...(prev||[]), k])) : (prev||[]).filter(x=> x!==k))} />
                <span className="capitalize">{k}</span>
              </label>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 text-sm">Page size
            <select className="bg-transparent border rounded px-2 py-1" value={pageSize} onChange={(e)=> setPageSize(Number(e.target.value))}>
              {[6,9,12,18,20].map(n=> <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={()=> setPage(p=> Math.max(1,p-1))} disabled={loading || page<=1}>Prev</Button>
            <Button size="sm" onClick={()=> setPage(p=> p+1)} disabled={loading}>Next</Button>
          </div>
        </div>
      </div>
      {!token ? <div className="text-sm opacity-70">Set your TMDb token in Settings to use Roulette.</div> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {display.map(r=> (
          <MovieCard key={r.id} item={r} onAdd={onAdd} onUpdate={onAdd} onOpenDetails={onOpenDetails} compact />
        ))}
      </div>
    </div>
  );
}

export function HorrorHub(){
  const { library, upsert, remove } = useLibrary();
  const [selected, setSelected] = useState(null);
  const [settings, setSettings] = useState(()=> loadSettings());
  useEffect(()=>{ saveSettings(settings); },[settings]);
  const inLibraryIds = useMemo(()=> new Set(library.map(i=> i.id)), [library]);
  const watchlistIds = useMemo(()=> new Set(library.filter(i=> i.watchlist).map(i=> i.id)), [library]);
  const ratingById = useMemo(()=> Object.fromEntries(library.map(i=> [i.id, i.rating||0])), [library]);
  return (
    <div className={`max-w-7xl mx-auto p-4 ${settings.highContrast? 'contrast-150':''} ${settings.dyslexic? 'font-[system-ui] tracking-[.01em]':''}`}>
      <div className="sticky top-0 z-50 mb-3 backdrop-blur bg-black/25 rounded-xl border px-3 py-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold tracking-wide">HorrorHub</div>
            <div className="text-xs opacity-70">Find, rate, and track every scare.</div>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Button size="sm" className="h-8 px-2" variant={settings.lightsOut? 'default':'outline'} onClick={()=> setSettings(s=> ({...s, lightsOut: !s.lightsOut}))}>Lights Out</Button>
          </div>
        </div>
      </div>
      <Tabs defaultValue={selected? 'details':'discover'}>
        <TabsList className="tabbar p-0">
          <TabsTrigger value="discover" className="h-8 px-3 flex-1 min-w-fit">Discover</TabsTrigger>
          <TabsTrigger value="library" className="h-8 px-3 flex-1 min-w-fit">My Library</TabsTrigger>
          <TabsTrigger value="watchlist" className="h-8 px-3 flex-1 min-w-fit">Watchlist</TabsTrigger>
          <TabsTrigger value="recs" className="h-8 px-3 flex-1 min-w-fit">Recommendations</TabsTrigger>
          <TabsTrigger value="continuity" className="h-8 px-3 flex-1 min-w-fit">Continuity</TabsTrigger>
          <TabsTrigger value="roulette" className="h-8 px-3 flex-1 min-w-fit">Roulette</TabsTrigger>
          <TabsTrigger value="stats" className="h-8 px-3 flex-1 min-w-fit">Stats</TabsTrigger>
          <TabsTrigger value="settings" className="h-8 px-3 flex-1 min-w-fit">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="discover" className="mt-4">
          <Discover onAdd={upsert} onOpenDetails={setSelected} />
        </TabsContent>
        <TabsContent value="library" className="mt-4">
          <LibraryView items={library} onUpdate={upsert} onRemove={remove} onOpenDetails={setSelected} />
        </TabsContent>
        <TabsContent value="continuity" className="mt-4">
          <ContinuityView library={library} onOpenDetails={setSelected} />
        </TabsContent>
        <TabsContent value="watchlist" className="mt-4">
          <WatchlistView items={library} onUpdate={upsert} onRemove={remove} onOpenDetails={setSelected} />
        </TabsContent>
        <TabsContent value="recs" className="mt-4">
          <RecommendationsView onAdd={upsert} onOpenDetails={setSelected} />
        </TabsContent>
        <TabsContent value="continuity" className="mt-4">
          <ContinuityView library={library} onOpenDetails={setSelected} />
        </TabsContent>
        <TabsContent value="roulette" className="mt-4">
          <RatingRoulette onAdd={upsert} onOpenDetails={setSelected} ratingById={ratingById} inLibraryIds={inLibraryIds} watchlistIds={watchlistIds} />
        </TabsContent>
        <TabsContent value="stats" className="mt-4">
          <StatsView items={library} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <Settings settings={settings} onChange={(s)=> setSettings(v=> ({...v, ...s}))} />
        </TabsContent>
        {selected? (
          <TabsContent value="details" className="mt-4">
            <MovieDetails item={selected} localItem={library.find(i=> i.id===selected.id)} onBack={()=> setSelected(null)} onUpdate={upsert} />
          </TabsContent>
        ) : null}
      </Tabs>
      {settings.flicker? <FlickerOverlay/>: null}
      {settings.fog? <FogOverlay/>: null}
      {settings.lightsOut? <LightsOutOverlay/>: null}
    </div>
  );
}

function App(){ return <HorrorHub />; }
export default App;



