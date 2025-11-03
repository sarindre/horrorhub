import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  Upload,
  Search as SearchIcon,
  Film,
  Calendar as CalIcon,
  Trash2,
  Plus,
  Flame,
  BookmarkPlus,
  Wand2,
  Check,
  Tags,
  Save,
  Sparkles,
  BarChart3,
  BellRing,
  AlarmClock,
  Heart,
  CalendarPlus,
  Info,
  AlertCircle,
} from "lucide-react";
import knifeSvg from "./assets/whiteknife.svg";

// Knife icon via CSS mask based on whiteknife.svg so it inherits currentColor
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
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";

import { Card, CardContent } from "./components/ui/card.jsx";
import { Button } from "./components/ui/button.jsx";
import { Input } from "./components/ui/input.jsx";
import { Textarea } from "./components/ui/textarea.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./components/ui/dialog.jsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs.jsx";
import { Badge } from "./components/ui/badge.jsx";
import { Calendar } from "./components/ui/calendar.jsx";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover.jsx";
import { Label } from "./components/ui/label.jsx";
import { Slider } from "./components/ui/slider.jsx";
// (Select components are imported in case you add them later)
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select.jsx";
import { useHybridRecommendations } from "./hooks/useHybridRecommendations";
import SearchBar from "./components/SearchBar.jsx";

// ----------------- utils & constants -----------------
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = (path, size = "w342") => (path ? `https://image.tmdb.org/t/p/${size}${path}` : "");
const STORAGE_KEY = "horrorhub.library.v2";
const SETTINGS_KEY = "horrorhub.settings.v1";
const isoDateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();

function loadLibrary() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveLibrary(lib) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lib));
}
function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ----------------- rating stars -----------------
function StarRating({ value = 0, onChange, iconClass = "h-5 w-5", showClear = true }) {
  const [hover, setHover] = useState(null);
  const display = hover ?? value;
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-0 flex-nowrap whitespace-nowrap shrink-0" aria-label="Star rating">
      {stars.map((s) => {
        const full = display >= s;
        const half = !full && display >= s - 0.5;
        return (
          <button
            key={s}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(null)}
            onClick={() => { onChange?.(s); try { if (window.navigator?.vibrate) window.navigator.vibrate(10); } catch {} }}
            onContextMenu={(e) => {
              e.preventDefault();
              onChange?.(s - 0.5);
              try { if (window.navigator?.vibrate) window.navigator.vibrate(5); } catch {}
            }}
            className="p-0"
            title="Right-click for halves"
          >
            {full ? (
              <KnifeIcon className={`${iconClass} text-rose-500`} />
            ) : half ? (
              <KnifeIcon className={`${iconClass} text-rose-500 opacity-60`} />
            ) : (
              <KnifeIcon className={`${iconClass} text-zinc-500/40`} />
            )}
          </button>
        );
      })}
      {showClear ? (
        <Button size="icon" variant="ghost" onClick={() => onChange?.(0)} title="Clear rating">
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

// ----------------- tags -----------------
const SUGGESTED_TAGS = [
  "supernatural",
  "slasher",
  "found-footage",
  "psychological",
  "gore",
  "slow-burn",
  "folk-horror",
  "creature",
  "haunted",
  "possession",
  "vampire",
  "zombie",
  "occult",
  "sci-horror",
  "cosmic",
  "home-invasion",
  "survival",
  "arthouse",
  "campy",
  "classic",
];

function TagEditor({ tags = [], onChange }) {
  const [input, setInput] = useState("");
  const add = (t) => {
    const v = t.trim().toLowerCase();
    if (!v) return;
    if (tags.includes(v)) return;
    onChange?.([...tags, v]);
    setInput("");
  };
  const remove = (t) => onChange?.(tags.filter((x) => x !== t));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <Badge key={t} className="cursor-pointer" onClick={() => remove(t)} title="Remove tag">
            #{t}
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Add tag and press Enter"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add(input);
          }}
        />
        <Button onClick={() => add(input)}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 text-sm opacity-80">
        {SUGGESTED_TAGS.map((t) => (
          <button key={t} onClick={() => add(t)} className="px-2 py-1 rounded-full border hover:bg-muted">
            #{t}
          </button>
        ))}
      </div>
    </div>
  );
}

// ----------------- library hook -----------------
function useLibrary() {
  const [library, setLibrary] = useState(loadLibrary());
  useEffect(() => {
    saveLibrary(library);
  }, [library]);

  const upsert = (item) =>
    setLibrary((prev) => {
      const i = prev.findIndex((x) => x.id === item.id);
      if (i >= 0) {
        const merged = { ...prev[i], ...item };
        const next = [...prev];
        next[i] = merged;
        return next;
      }
      return [{ ...item, addedAt: new Date().toISOString(), watchedDates: item.watchedDates || [], watchlist: !!item.watchlist }, ...prev];
    });
  const remove = (id) => setLibrary((prev) => prev.filter((x) => x.id !== id));

  return { library, upsert, remove };
}

// ----------------- export/import & ICS -----------------
function createICS({ events }) {
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) => {
    const dt = new Date(d);
    return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(
      dt.getUTCMinutes()
    )}00Z`;
  };
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HorrorHub//EN"];
  events.forEach((e, i) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${i}-${Date.now()}@horrorhub`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(e.start)}`,
      e.end ? `DTEND:${fmt(e.end)}` : `DURATION:PT2H`,
      `SUMMARY:${(e.title || "Movie").replace(/\n/g, " ")}`,
      e.description ? `DESCRIPTION:${e.description.replace(/[\n\r]/g, " ")}` : null,
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  return lines.filter(Boolean).join("\r\n");
}

function ExportImport({ data, onImport, watchlist = [] }) {
  const fileRef = useRef(null);
  const lbRef = useRef(null);
  const imdbRef = useRef(null);
  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `horrorhub-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  // Minimal CSV parser supporting quotes and commas
  const parseCSV = (text) => {
    const rows = [];
    let cur = '';
    let row = [];
    let q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; } else { q = false; }
        } else {
          cur += c;
        }
      } else {
        if (c === '"') q = true;
        else if (c === ',') { row.push(cur); cur = ''; }
        else if (c === '\n' || c === '\r') {
          if (cur !== '' || row.length) { row.push(cur); rows.push(row); row = []; cur = ''; }
          // swallow consecutive CRLF
          if (c === '\r' && text[i + 1] === '\n') i++;
        } else cur += c;
      }
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  };
  const uploadCSVLetterboxd = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCSV(String(reader.result || ''));
        if (!rows.length) return alert('Empty CSV');
        const header = rows[0].map(h => h.trim().toLowerCase());
        const find = (names) => names.map(n=>n.toLowerCase()).map(n=> header.indexOf(n)).find(idx=> idx>=0);
        const idxTitle = find(['name','title']);
        const idxYear = find(['year']);
        const idxWatched = find(['watched on','watched date','date']);
        const idxRating = find(['rating','your rating']);
        const items = rows.slice(1).filter(r=> r.length).map(r => {
          const title = r[idxTitle] || '';
          const year = Number(r[idxYear]) || undefined;
          const watched = r[idxWatched] ? [new Date(r[idxWatched]).toISOString()] : [];
          const rating = Number(r[idxRating]) || 0;
          return {
            id: `letterboxd:${title}:${year||''}`,
            title,
            year,
            watchedDates: watched,
            rating,
            scares: 5,
            tags: [],
            watchlist: false,
          };
        });
        // merge with existing by id
        const map = new Map(data.map(i=> [String(i.id), i]));
        items.forEach(i=> map.set(String(i.id), { ...(map.get(String(i.id))||{}), ...i }));
        onImport?.(Array.from(map.values()));
      } catch {
        alert('Invalid CSV');
      }
    };
    reader.readAsText(file);
  };
  const uploadCSVImdb = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCSV(String(reader.result || ''));
        if (!rows.length) return alert('Empty CSV');
        const header = rows[0].map(h => h.trim().toLowerCase());
        const col = (name) => header.indexOf(name.toLowerCase());
        const idxConst = col('const');
        const idxTitle = col('title');
        const idxYear = col('year');
        const idxYourRating = col('your rating');
        const idxDateRated = col('date rated');
        const items = rows.slice(1).filter(r=> r.length).map(r => {
          const imdbid = idxConst>=0 ? r[idxConst] : '';
          const title = r[idxTitle] || '';
          const year = Number(r[idxYear]) || undefined;
          const rating = Number(r[idxYourRating]) || 0;
          const watched = r[idxDateRated] ? [new Date(r[idxDateRated]).toISOString()] : [];
          return {
            id: imdbid ? `imdb:${imdbid}` : `imdb:${title}:${year||''}`,
            title,
            year,
            watchedDates: watched,
            rating,
            scares: 5,
            tags: [],
            watchlist: false,
          };
        });
        const map = new Map(data.map(i=> [String(i.id), i]));
        items.forEach(i=> map.set(String(i.id), { ...(map.get(String(i.id))||{}), ...i }));
        onImport?.(Array.from(map.values()));
      } catch {
        alert('Invalid CSV');
      }
    };
    reader.readAsText(file);
  };
  const upload = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        onImport?.(parsed);
      } catch {
        alert("Invalid JSON");
      }
    };
    reader.readAsText(file);
  };
  const downloadICS = () => {
    const days = Math.min(30, watchlist.length);
    const start = new Date();
    const events = Array.from({ length: days }).map((_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      d.setHours(20, 0, 0, 0);
      const m = watchlist[i];
      return { title: `Watch: ${m.title} (${m.year || ""})`, start: d, description: `From your HorrorHub watchlist.` };
    });
    const ics = createICS({ events });
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `horrorhub-watchlist-${new Date().toISOString().slice(0, 10)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="flex gap-2 flex-wrap">
      <Button onClick={downloadJSON}>
        <Download className="h-4 w-4 mr-2" />
        Export
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />
      <Button variant="secondary" onClick={() => fileRef.current?.click()}>
        <Upload className="h-4 w-4 mr-2" />
        Import
      </Button>
      <input
        ref={lbRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e)=>{ const f = e.target.files?.[0]; if (f) uploadCSVLetterboxd(f); }}
      />
      <Button variant="secondary" onClick={() => lbRef.current?.click()}>
        <Upload className="h-4 w-4 mr-2" />
        Import Letterboxd CSV
      </Button>
      <input
        ref={imdbRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e)=>{ const f = e.target.files?.[0]; if (f) uploadCSVImdb(f); }}
      />
      <Button variant="secondary" onClick={() => imdbRef.current?.click()}>
        <Upload className="h-4 w-4 mr-2" />
        Import IMDb CSV
      </Button>
      <Button variant="outline" onClick={downloadICS}>
        <CalendarPlus className="h-4 w-4 mr-2" />
        Export ICS
      </Button>
    </div>
  );
}

// ----------------- movie card -----------------
function MovieCard({ item, onAdd, onUpdate, onRemove, showWatchlist = true, compact = false, onOpenDetails, isInLibrary = false, isWatchlisted = false, providers = [] }) {
  const [open, setOpen] = useState(false);
  const [watchOpen, setWatchOpen] = useState(false);
  const [date, setDate] = useState(new Date());
  const [notes, setNotes] = useState(item.notes || "");
  const [tags, setTags] = useState(item.tags || []);
  const [rating, setRating] = useState(item.rating || 0);
  const [scares, setScares] = useState(item.scares ?? 5);
  const [addedUI, setAddedUI] = useState(false);
  const [watchlistedUI, setWatchlistedUI] = useState(!!item.watchlist || isWatchlisted);
  const isWatched = isInLibrary || (item.watchedDates?.length || 0) > 0;
  const [tagsExpanded, setTagsExpanded] = useState(false);

  useEffect(() => {
    setNotes(item.notes || "");
    setTags(item.tags || []);
    setRating(item.rating || 0);
    setScares(item.scares ?? 5);
    setAddedUI(false);
    setWatchlistedUI(!!item.watchlist || isWatchlisted);
  }, [item.id, isWatchlisted]);

  const poster = item.poster ? TMDB_IMG(item.poster, "w342") : "";

  const saveDetails = () => {
    onUpdate?.({ ...item, notes, tags, rating, scares });
    setOpen(false);
  };
  const addWatch = () => {
    const iso = isoDateOnly(date);
    const watchedDates = Array.from(new Set([...(item.watchedDates || []), iso]));
    onUpdate?.({ ...item, watchedDates, watchlist: false });
    setWatchOpen(false);
    try { localStorage.setItem('horrorhub.lastWatch', iso); } catch {}
  };
  const addWatchToday = () => {
    const today = new Date();
    const iso = isoDateOnly(today);
    const watchedDates = Array.from(new Set([...(item.watchedDates || []), iso]));
    onUpdate?.({ ...item, watchedDates, watchlist: false });
    setWatchOpen(false);
    try { localStorage.setItem('horrorhub.lastWatch', iso); } catch {}
  };
  const addWatchLongAgo = () => {
    let y = 1900;
    try {
      const s = JSON.parse(localStorage.getItem('horrorhub.settings.v1') || '{}');
      y = Number(s.longAgoYear ?? localStorage.getItem('horrorhub.longAgoYear') ?? 1900);
      if (!Number.isFinite(y)) y = 1900;
    } catch { try { y = Number(localStorage.getItem('horrorhub.longAgoYear') || 1900); } catch { y = 1900; } }
    const old = new Date(y, 0, 1);
    const iso = isoDateOnly(old);
    const watchedDates = Array.from(new Set([...(item.watchedDates || []), iso]));
    onUpdate?.({ ...item, watchedDates, watchlist: false });
    setWatchOpen(false);
  };
  const toggleWatchlist = () => {
    if (item.watchlist) {
      onRemove?.(item.id);
    } else {
      onUpdate?.({ ...item, watchlist: true });
    }
  };

  if (compact) {
    return (
      <Card className="rounded-2xl overflow-hidden shadow-sm">
        <CardContent className="p-0">
          <div
            className="p-3 flex gap-3 items-center outline-none"
            tabIndex={0}
            onKeyDown={(e)=>{
              const tag = String(e.target.tagName||'').toLowerCase();
              if (['input','textarea','select','button'].includes(tag)) return;
              const key = e.key;
              if (key>='1' && key<='5') {
                e.preventDefault();
                const v = Number(key);
                setRating(v);
                const updated = { ...item, rating: v };
                if (onUpdate) onUpdate(updated); else onAdd?.(updated);
              } else if (key==='w' || key==='W') {
                e.preventDefault();
                if (onUpdate) onUpdate({ ...item, watchlist: !(item.watchlist || watchlistedUI) });
                else onAdd?.({ ...item, watchlist: true });
                setWatchlistedUI(v=> !v);
              } else if (key==='a' || key==='A') {
                e.preventDefault();
                if (isInLibrary || addedUI) { onRemove?.(item.id); setAddedUI(false); setWatchlistedUI(false); }
                else { onAdd?.(item); setAddedUI(true); }
              } else if (key==='d' || key==='D') {
                e.preventDefault(); onOpenDetails?.(item);
              } else if (key==='Escape') {
                e.preventDefault(); setOpen(false); setWatchOpen(false);
              }
            }}
          >
            <div
              className="relative w-16 h-24 rounded bg-muted overflow-hidden flex items-center justify-center cursor-pointer"
              onClick={() => onOpenDetails?.(item)}
              title="Open details"
            >
              <ShimmerImage src={poster} alt={item.title} className="w-16 h-24 object-cover" />
              {/* Poster overlays removed per request (no pill banners on posters) */}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="font-medium leading-tight truncate cursor-pointer hover:underline"
                onClick={() => onOpenDetails?.(item)}
                title="Open details"
              >
                {item.title} {item.year ? <span className="opacity-70 font-normal">({item.year})</span> : null}
                {(isInLibrary || isWatchlisted) && (
                  <span className="ml-2 inline-flex gap-1 align-middle">
                    {isInLibrary && <span className="text-[10px] px-1 rounded bg-emerald-600/80 text-white">Library</span>}
                    {isWatchlisted && <span className="text-[10px] px-1 rounded bg-rose-600/80 text-white">Watchlist</span>}
                  </span>
                )}
                {Array.isArray(providers) && providers.length ? (
                  <span className="ml-2 inline-flex gap-0.5 align-middle">
                    {providers.slice(0,3).map((p)=> (
                      <span
                        key={p}
                        title={p==='netflix'?'Netflix': p==='prime'?'Prime Video': p==='hulu'?'Hulu': p==='disney'?'Disney+': p}
                        className={`text-[9px] px-1 rounded text-white ${p==='netflix'?'bg-[#e50914]': p==='prime'?'bg-[#00a8e1]': p==='hulu'?'bg-[#1ce783]': p==='disney'?'bg-[#113ccf]':'bg-zinc-600'}`}
                      >
                        {p==='netflix'?'N': p==='prime'?'P': p==='hulu'?'H': p==='disney'?'D': p.slice(0,1).toUpperCase()}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
              <div className="text-sm opacity-80 line-clamp-2">{item.overview}</div>
              {typeof item.voteAvg === "number" ? (
                <div className="text-xs opacity-80 mt-1">TMDb {item.voteAvg.toFixed(1)}/10</div>
              ) : null}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <StarRating
                  value={rating}
                  iconClass="h-5 w-5"
                  showClear={false}
                  onChange={(v) => {
                    setRating(v);
                    const updated = { ...item, rating: v };
                    if (onUpdate) onUpdate(updated);
                    else onAdd?.(updated);
                  }}
                />
                <div className="flex items-center gap-2 text-xs">
                  <span role="img" aria-label="bored" className="text-lg">🥱</span>
                  <Label className="text-xs opacity-80">Scare</Label>
                  <Slider
                    value={[scares]}
                    min={0}
                    max={10}
                    step={1}
                    onValueChange={(val) => {
                      const v = val[0];
                      setScares(v);
                      const updated = { ...item, scares: v };
                      if (onUpdate) onUpdate(updated);
                      else onAdd?.(updated);
                    }}
                    className="w-28"
                  />
                  <span role="img" aria-label="screaming" className="text-lg">😱</span>
                  <span className="tabular-nums">{scares}</span>
                </div>
                {onUpdate && (
                  <Dialog open={watchOpen} onOpenChange={setWatchOpen}>
                    <DialogTrigger asChild>
                      <Button variant="secondary" size="sm">
                        <CalIcon className="h-4 w-4 mr-1" />
                        Watched
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Log a watch date</DialogTitle>
                      </DialogHeader>
                      <div className="flex flex-col gap-4">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                              {date.toDateString()}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="p-2" align="start">
                            <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                          </PopoverContent>
                        </Popover>
                  <div className="flex gap-2">
                    <Button onClick={addWatch}>
                      <Check className="h-4 w-4 mr-2" />
                      Save date
                    </Button>
                    <Button variant="outline" onClick={addWatchToday}>
                      <CalIcon className="h-4 w-4 mr-2" />
                      Watched today
                    </Button>
                    <Button variant="outline" onClick={addWatchLongAgo}>
                      <CalIcon className="h-4 w-4 mr-2" /> Watched long ago
                    </Button>
                  </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                {onAdd && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (isInLibrary || addedUI) {
                          onRemove?.(item.id);
                          setAddedUI(false);
                          setWatchlistedUI(false);
                        } else {
                          onAdd(item);
                          setAddedUI(true);
                        }
                      }}
                    >
                      <BookmarkPlus className="h-4 w-4 mr-1" />
                      {addedUI || isInLibrary ? "Added" : "Add"}
                    </Button>
                    {!isWatched && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (isInLibrary || addedUI) {
                            const next = !watchlistedUI && !isWatchlisted;
                            onUpdate?.({ ...item, watchlist: next });
                            setWatchlistedUI(next);
                          } else {
                            onAdd({ ...item, watchlist: true });
                            setAddedUI(true);
                            setWatchlistedUI(true);
                          }
                        }}
                        title="Add to watchlist"
                      >
                        <Heart className="h-4 w-4 mr-1" />
                        {watchlistedUI || isWatchlisted ? "Watchlisted" : "Watchlist"}
                      </Button>
                    )}
                  </>
                )}
                {onUpdate && !onAdd && !isWatched && (
                  <Button
                    size="sm"
                    variant={item.watchlist ? "default" : "outline"}
                    onClick={() => onUpdate({ ...item, watchlist: !item.watchlist })}
                    title={item.watchlist ? "In watchlist" : "Add to watchlist"}
                  >
                    <Heart className="h-4 w-4 mr-1" />
                    {item.watchlist ? "Watchlisted" : "Watchlist"}
                  </Button>
                )}
                {onRemove && (
                  <Button size="sm" variant="outline" onClick={() => onRemove(item.id)} title="Remove from library">
                    <Trash2 className="h-4 w-4 mr-1" /> Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl overflow-hidden shadow-sm">
      <CardContent className="p-0">
        <div
          className="grid grid-cols-[120px,1fr] gap-4 outline-none"
          tabIndex={0}
          onKeyDown={(e)=>{
            const tag = String(e.target.tagName||'').toLowerCase();
            if (['input','textarea','select','button'].includes(tag)) return;
            const key = e.key;
            if (key>='1' && key<='5') {
              e.preventDefault();
              const v = Number(key);
              setRating(v);
              onUpdate?.({ ...item, rating: v });
            } else if (key==='w' || key==='W') {
              e.preventDefault();
              onUpdate?.({ ...item, watchlist: !item.watchlist });
            } else if (key==='d' || key==='D') {
              e.preventDefault(); onOpenDetails?.(item);
            } else if (key==='Escape') {
              e.preventDefault(); setOpen(false); setWatchOpen(false);
            }
          }}
        >
          <button
            className="bg-muted min-h-[180px] text-left"
            onClick={() => onOpenDetails?.(item)}
            title="Open details"
          >
            {poster ? (
              <ShimmerImage src={poster} alt={item.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Film className="h-10 w-10" />
              </div>
            )}
          </button>
          <div className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="cursor-pointer" onClick={() => onOpenDetails?.(item)} title="Open details">
                <h3 className="text-lg font-semibold leading-tight hover:underline">
                  {item.title} {item.year ? <span className="opacity-70 font-normal">({item.year})</span> : null}
                  {(isInLibrary || isWatchlisted) && (
                    <span className="ml-2 inline-flex gap-1 align-middle">
                      {isInLibrary && <span className="text-[10px] px-1 rounded bg-emerald-600/80 text-white">Library</span>}
                      {isWatchlisted && <span className="text-[10px] px-1 rounded bg-rose-600/80 text-white">Watchlist</span>}
                    </span>
                  )}
                  {Array.isArray(providers) && providers.length ? (
                    <span className="ml-2 inline-flex gap-0.5 align-middle">
                      {providers.slice(0,3).map((p)=> (
                        <span
                          key={p}
                          title={p==='netflix'?'Netflix': p==='prime'?'Prime Video': p==='hulu'?'Hulu': p==='disney'?'Disney+': p}
                          className={`text-[9px] px-1 rounded text-white ${p==='netflix'?'bg-[#e50914]': p==='prime'?'bg-[#00a8e1]': p==='hulu'?'bg-[#1ce783]': p==='disney'?'bg-[#113ccf]':'bg-zinc-600'}`}
                        >
                          {p==='netflix'?'N': p==='prime'?'P': p==='hulu'?'H': p==='disney'?'D': p.slice(0,1).toUpperCase()}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </h3>
                <div className="text-sm opacity-80 line-clamp-2">{item.overview}</div>
              </div>
              <div className="flex gap-1">
                {onAdd && (
                  <Button size="sm" onClick={() => onAdd(item)}>
                    <BookmarkPlus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                )}
                {onRemove && (
                  <Button size="sm" variant="outline" onClick={() => onRemove(item.id)} title="Remove from library">
                    <Trash2 className="h-4 w-4 mr-1" /> Remove
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <StarRating
                  value={rating}
                  onChange={(v) => {
                    setRating(v);
                    onUpdate?.({ ...item, rating: v });
                  }}
                />
                <div className="flex items-center gap-2 opacity-80 text-sm">
                  <Flame className="h-4 w-4" />
                  Scare: {scares}
                </div>
                {showWatchlist && !(item.watchedDates?.length) && (
                  <Button variant={item.watchlist ? "default" : "outline"} size="sm" onClick={toggleWatchlist} title="Toggle watchlist">
                    <Heart className="h-4 w-4 mr-1" />
                    {item.watchlist ? "In Watchlist" : "Add to Watchlist"}
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
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
                          <Button variant="outline" className="w-full justify-start">
                            {date.toDateString()}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-2" align="start">
                          <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <div className="flex gap-2">
                        <Button onClick={addWatch}>
                          <Check className="h-4 w-4 mr-2" />
                          Save date
                        </Button>
                        <Button variant="outline" onClick={addWatchToday}>
                          <CalIcon className="h-4 w-4 mr-2" /> Watched today
                        </Button>
                        <Button variant="outline" onClick={addWatchLongAgo}>
                          <CalIcon className="h-4 w-4 mr-2" /> Watched long ago
                        </Button>
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
                        <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Quick thoughts, spoilers, vibes..." />
                      </div>
                      <div className="grid gap-2">
                        <Label>Tags</Label>
                        <TagEditor tags={tags} onChange={setTags} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Scare intensity (0–10)</Label>
                        <Slider value={[scares]} min={0} max={10} step={1} onValueChange={(v) => setScares(v[0])} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={saveDetails}>
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {(item.tags || []).slice(0, tagsExpanded ? (item.tags||[]).length : 5).map((t) => (
                <Badge key={t}>#{t}</Badge>
              ))}
              {(item.tags?.length || 0) > 5 ? (
                <Button size="sm" variant="ghost" onClick={() => setTagsExpanded((v) => !v)}>{tagsExpanded ? 'Show less' : 'Show more'}</Button>
              ) : null}
            </div>

            {item.watchedDates?.length ? (
              <div className="text-xs opacity-70">Watched: {item.watchedDates.map((d) => new Date(d).toLocaleDateString()).join(", ")}</div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ----------------- discover -----------------
function Discover({ apiKey, onAdd, onRemove, inLibraryIds, onToggleWatchlist, onOpenDetails, watchlistIds, ratingById }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [sort, setSort] = useState("popularity.desc");
  const [upcoming, setUpcoming] = useState([]);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [hideWatchlisted, setHideWatchlisted] = useState(() => { try{ return !!JSON.parse(localStorage.getItem('horrorhub.discover.hideWatchlisted')||'false'); }catch{return false;} });
  const [hideInLibrary, setHideInLibrary] = useState(() => { try{ return !!JSON.parse(localStorage.getItem('horrorhub.discover.hideInLibrary')||'false'); }catch{return false;} });
  const [providersSel, setProvidersSel] = useState(() => { try{ return JSON.parse(localStorage.getItem('horrorhub.discover.providers')||'[]'); }catch{return [];} });
  const providersRef = useRef(new Map()); // id -> [slugs]

  const authHeader = apiKey ? { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json;charset=utf-8" } : undefined;

  useEffect(()=>{ try{ localStorage.setItem('horrorhub.discover.hideWatchlisted', JSON.stringify(hideWatchlisted)); }catch{} },[hideWatchlisted]);
  useEffect(()=>{ try{ localStorage.setItem('horrorhub.discover.hideInLibrary', JSON.stringify(hideInLibrary)); }catch{} },[hideInLibrary]);
  useEffect(()=>{ try{ localStorage.setItem('horrorhub.discover.providers', JSON.stringify(providersSel||[])); }catch{} },[providersSel]);

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

// ----------------- Library View -----------------
function LibraryView({ items, onUpdate, onRemove, apiKey, onOpenDetails }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState("addedAt.desc");
  const [tagsExpanded, setTagsExpanded] = useState(false);

  // Debounce effect (300 ms)
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const allTags = useMemo(() => {
    const counts = new Map();
    items.forEach((i) => (i.tags || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
      .map(([t]) => t);
  }, [items]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    let arr = items;

    if (q) {
      arr = arr.filter((i) => {
        const title = (i.title || "").toLowerCase();
        const notes = (i.notes || "").toLowerCase();
        const tags = (i.tags || []).map((t) => (t || "").toLowerCase());
        return title.includes(q) || notes.includes(q) || tags.some((t) => t.includes(q));
      });
    }

    if (tagFilter) {
      const tf = tagFilter.toLowerCase();
      arr = arr.filter((i) => (i.tags || []).some((t) => (t || "").toLowerCase() === tf));
    }

    arr = arr.filter((i) => (i.rating || 0) >= minRating);

    switch (sort) {
      case "rating.desc":
        arr = [...arr].sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case "title.asc":
        arr = [...arr].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        break;
      case "title.desc":
        arr = [...arr].sort((a, b) => (b.title || "").localeCompare(a.title || ""));
        break;
      case "year.desc":
        arr = [...arr].sort((a, b) => (b.year || 0) - (a.year || 0));
        break;
      case "year.asc":
        arr = [...arr].sort((a, b) => (a.year || 0) - (b.year || 0));
        break;
      case "release.desc": {
        const toDate = (i) => (i.releaseDate ? new Date(i.releaseDate) : new Date(0));
        arr = [...arr].sort((a, b) => toDate(b) - toDate(a));
        break; }
      case "release.asc": {
        const toDate = (i) => (i.releaseDate ? new Date(i.releaseDate) : new Date(0));
        arr = [...arr].sort((a, b) => toDate(a) - toDate(b));
        break; }
      case "addedAt.asc":
        arr = [...arr].sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));
        break;
      case "addedAt.desc":
      default:
        arr = [...arr].sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    }

    return arr;
  }, [items, debouncedQuery, tagFilter, minRating, sort]);

  const watchlist = items.filter((i) => i.watchlist);
  const { existingTop, similarPicks } = useHybridRecommendations(items, apiKey);

  const tonightPick = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const today = new Date().toISOString().slice(0, 10);
    const isReleased = (i) => (typeof i.year === 'undefined' || Number(i.year) <= currentYear) && (!i.releaseDate || i.releaseDate <= today);
    const base = watchlist.length ? watchlist : items.filter((i) => (i.rating || 0) < 3);
    const pool = base.filter(isReleased);
    if (!pool.length) return null;
    const weights = pool.map((i) => 1 + (i.scares || 0) / 10 + ((i.tags || []).length ? 0.5 : 0));
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let idx = 0; idx < pool.length; idx++) {
      if (r < weights[idx]) return pool[idx];
      r -= weights[idx];
    }
    return pool[0];
  }, [items, watchlist]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-3 sm:px-4 md:px-6">
      {/* Search + filters */}
      <div className="space-y-3">
        <SearchBar
          value={query}
          onChange={setQuery}
          onSearch={() => setDebouncedQuery(query)}
          onClear={() => setQuery("")}
          placeholder="Search your library (title, notes, tags)…"
        />

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tag filter */}
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant={tagFilter === "" ? "default" : "outline"} onClick={() => setTagFilter("")}>
              All tags
            </Button>
            {(allTags.slice(0, tagsExpanded ? allTags.length : 5)).map((t) => (
              <Button key={t} size="sm" variant={tagFilter === t ? "default" : "outline"} onClick={() => setTagFilter(t)}>
                #{t}
              </Button>
            ))}
            {allTags.length > 5 ? (
              <Button size="sm" variant="ghost" onClick={()=> setTagsExpanded(v=>!v)}>{tagsExpanded? 'Show fewer' : 'Show more'}</Button>
            ) : null}
          </div>

          {/* Min rating */}
          <div className="flex items-center gap-3">
            <Label className="text-sm">Min rating</Label>
            <Slider value={[minRating]} min={0} max={5} step={0.5} onValueChange={(v) => setMinRating(v[0])} className="w-[160px]" />
            <span className="text-sm opacity-70 w-6 text-right">{minRating}</span>
          </div>

          {/* Sort */}
          <div className="flex gap-2">
            {[
              ["addedAt.desc", "Recent"],
              ["addedAt.asc", "Oldest"],
              ["rating.desc", "Rating"],
              ["year.desc", "New→Old"],
              ["year.asc", "Old→New"],
              ["title.asc", "A→Z"],
              ["title.desc", "Z→A"],
              ["release.desc", "Release ↓"],
              ["release.asc", "Release ↑"],
            ].map(([val, label]) => (
              <Button key={val} size="sm" variant={sort === val ? "default" : "outline"} onClick={() => setSort(val)}>
                {label}
              </Button>
            ))}
          </div>

          {/* Clear */}
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setTagFilter("");
                setMinRating(0);
                setSort("addedAt.desc");
              }}
            >
              Clear filters
            </Button>
            <Info className="h-4 w-4 opacity-60" />
            <div className="text-xs opacity-70">Right-click a knife for half ratings. Use the heart to manage your watchlist.</div>
          </div>
        </div>
      </div>

      {/* Smart picks section removed from Library */}

      {/* Library Grid */}
      <div className="flex items-center gap-2 text-xs opacity-70 mb-1">
        <span className="inline-block text-[10px] leading-3 px-1.5 py-0.5 rounded bg-emerald-600 text-white">Library</span>
        <span className="inline-block text-[10px] leading-3 px-1.5 py-0.5 rounded bg-rose-600 text-white">Watchlist</span>
        <span>(badges appear on poster)</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] opacity-70 mb-2">
        <span className="inline-block text-[9px] leading-3 px-1 rounded text-white bg-[#e50914]" title="Netflix">N</span>
        <span className="inline-block text-[9px] leading-3 px-1 rounded text-white bg-[#00a8e1]" title="Prime Video">P</span>
        <span className="inline-block text-[9px] leading-3 px-1 rounded text-white bg-[#1ce783]" title="Hulu">H</span>
        <span className="inline-block text-[9px] leading-3 px-1 rounded text-white bg-[#113ccf]" title="Disney+">D</span>
        <span>provider legends</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
        {filtered.map((i) => (
          <MovieCard key={i.id} item={i} onUpdate={onUpdate} onRemove={onRemove} compact onOpenDetails={onOpenDetails} isInLibrary={true} />
        ))}
      </div>

      {/* Watchlist */}
      {watchlist.length ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm uppercase tracking-wide opacity-80">
            <BellRing className="h-4 w-4" /> Your watchlist
          </div>
          <div className="flex items-center gap-2 text-xs opacity-70 mb-1">
            <span className="inline-block text-[10px] leading-3 px-1.5 py-0.5 rounded bg-emerald-600 text-white">Library</span>
            <span className="inline-block text-[10px] leading-3 px-1.5 py-0.5 rounded bg-rose-600 text-white">Watchlist</span>
            <span>(badges appear on poster)</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] opacity-70 mb-2">
            <span className="inline-block text-[9px] leading-3 px-1 rounded text-white bg-[#e50914]" title="Netflix">N</span>
            <span className="inline-block text-[9px] leading-3 px-1 rounded text-white bg-[#00a8e1]" title="Prime Video">P</span>
            <span className="inline-block text-[9px] leading-3 px-1 rounded text-white bg-[#1ce783]" title="Hulu">H</span>
            <span className="inline-block text-[9px] leading-3 px-1 rounded text-white bg-[#113ccf]" title="Disney+">D</span>
            <span>provider legends</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
            {watchlist.map((i) => (
              <MovieCard key={i.id} item={i} onUpdate={onUpdate} onRemove={onRemove} compact onOpenDetails={onOpenDetails} isInLibrary={true} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { LibraryView }; // keep as a named module export too if you prefer
// (You can also remove this line if LibraryView is only used inside this file)

// ----------------- Watchlist View -----------------
function WatchlistView({ items, onUpdate, onRemove, onOpenDetails, planDays = [], planTime = '20:00' }) {
  const currentYear = new Date().getFullYear();
  const today = new Date().toISOString().slice(0,10);
  const isReleased = (i) => (typeof i.year === 'undefined' || Number(i.year) <= currentYear) && (!i.releaseDate || i.releaseDate <= today);
  const tonightPick = React.useMemo(() => {
    const pool = items.filter(isReleased);
    if (!pool.length) return null;
    const weights = pool.map((i) => 1 + (i.scares || 0) / 10 + ((i.tags || []).length ? 0.5 : 0));
    const sum = weights.reduce((a,b)=>a+b,0);
    let r = Math.random()*sum;
    for (let idx=0; idx<pool.length; idx++) { if (r < weights[idx]) return pool[idx]; r -= weights[idx]; }
    return pool[0];
  }, [items]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto px-3 sm:px-4 md:px-6">
      <div className="text-lg font-semibold">Your Watchlist</div>

      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm uppercase tracking-wide opacity-80">
            <AlarmClock className="h-4 w-4" /> Tonight's pick
          </div>
          {tonightPick ? (
            <div className="flex items-center justify-between">
              <button className="truncate pr-2 text-left hover:underline" onClick={()=> onOpenDetails?.(tonightPick)}>{tonightPick.title}</button>
              <Button size="sm" onClick={() => onUpdate({ ...tonightPick, watchlist: true })}>
                <Heart className="h-4 w-4 mr-1" />
                Watchlist
              </Button>
            </div>
          ) : (
            <div className="text-sm opacity-70">Add released items to your watchlist to enable.</div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Watch Plan */}
      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm uppercase tracking-wide opacity-80">Weekly Watch Plan</div>
            <Button size="sm" variant="outline" onClick={()=>{
              const daysSet = new Set(planDays);
              if (!daysSet.size) { alert('Set preferred days in Settings.'); return; }
              const [hh,mm] = (planTime||'20:00').split(':').map(Number);
              const events = []; const start = new Date(); const list = items.slice(); let idx=0;
              for (let d=0; d<28 && idx<list.length; d++){
                const dt = new Date(start); dt.setDate(dt.getDate()+d); if (daysSet.has(dt.getDay())){
                  const m = list[idx++]; if (!m) break; dt.setHours(hh||20, mm||0, 0, 0);
                  events.push({ title:`Watch: ${m.title} (${m.year||''})`, start: dt, description:'Weekly plan' });
                }
              }
              if (!events.length) { alert('No events to schedule.'); return; }
              const ics = createICS({ events });
              const blob = new Blob([ics], { type: 'text/calendar' }); const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href=url; a.download = `horrorhub-weekly-${new Date().toISOString().slice(0,10)}.ics`; a.click(); URL.revokeObjectURL(url);
            }}>Download Plan (4 weeks)</Button>
          </div>
          <div className="text-xs opacity-70">Uses your preferred days/time from Settings. Takes titles in watchlist order.</div>
        </CardContent>
      </Card>

      {items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
          {items.map((i) => (
            <MovieCard key={i.id} item={i} onUpdate={onUpdate} onRemove={onRemove} compact onOpenDetails={onOpenDetails} />
          ))}
        </div>
      ) : (
        <div className="opacity-70">Your watchlist is empty. Add titles from Discover or Library.</div>
      )}
    </div>
  );
}

// ----------------- Recommendations View -----------------
function RecommendationsView({ items, apiKey, onAdd, onUpdate, onRemove, onOpenDetails, inLibraryIds, watchlistIds, mixer, ratingById }) {
  const [mood, setMood] = useState(5); // 0 = spooky, 10 = traumatizing

  const currentYear = new Date().getFullYear();
  const pool = useMemo(() => {
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
      const tagBoost = (ghostScore + occultScore + slasherScore + folkScore) * 0.15; // scaled
      const score = proximity * 0.6 + ratingBoost + wlBoost + tagBoost;
      return { item: i, score };
    });
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((x) => x.item);
  }, [pool, mood]);

  const { similarPicks } = useHybridRecommendations(items, apiKey);
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
              <Button size="sm" variant="outline" onClick={async ()=>{
              if (!apiKey) { alert('Enter your TMDb API key in Settings.'); return; }
              const authHeader = { Authorization: `Bearer ${apiKey}`, 'Content-Type':'application/json;charset=utf-8' };
              const pool = external;
              if (!pool.length) { alert('No TMDb recommendations available yet.'); return; }
              const enriched = await Promise.all(pool.slice(0,50).map(async (r)=>{
                try{ const res = await fetch(`${TMDB_BASE}/movie/${r.id}?language=en-US`, { headers: authHeader }); const d = await res.json(); return { ...r, runtime: d?.runtime||null, year: r.year || (d?.release_date? Number(d.release_date.slice(0,4)) : undefined) }; } catch { return r; }
              }));
              const classics = enriched.filter(x=> (x.year||9999) < 1985);
              const shorties = classics.filter(x=> (x.runtime||999) < 90);
              const pickFrom = shorties.length ? shorties : classics.length ? classics : enriched;
              const pick = pickFrom[Math.floor(Math.random()*pickFrom.length)];
              onOpenDetails?.({ id: pick.id, title: pick.title, year: pick.year? Number(pick.year):undefined, poster: pick.poster, overview: '' });
            }}>Spin</Button>
            </div>
            <div className="text-xs opacity-70">Picks TMDb recommendations (pre‑1985) under 90 minutes.</div>
          </CardContent>
        </Card>
      </div>

      {external.length ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm uppercase tracking-wide opacity-80">
            <Wand2 className="h-4 w-4" /> Similar to your favorites (from TMDb)
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
            {external.map((r) => (
              <MovieCard
                key={r.id}
                item={{ id: r.id, title: r.title, year: r.year ? Number(r.year) : undefined, poster: r.poster, overview: "", voteAvg: r.voteAvg, rating: ratingById?.[r.id] || 0 }}
                onAdd={onAdd}
                onUpdate={(it) => onAdd?.(it)}
                compact
                onOpenDetails={onOpenDetails}
                isInLibrary={inLibraryIds?.has(r.id)}
                isWatchlisted={watchlistIds?.has(r.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm uppercase tracking-wide opacity-80">
          <Wand2 className="h-4 w-4" /> Mood-based picks (your watchlist)
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

// ----------------- Continuity Graph (mapping) -----------------
function ContinuityGraph({ items, apiKey, onOpenDetails }){
  const [seedId, setSeedId] = useState(() => (items.find(i => (i.rating || 0) >= 4)?.id ?? items[0]?.id));
  const [nodes, setNodes] = useState([]); // {id,title,poster}
  const [edges, setEdges] = useState([]); // {from,to}
  const [loading, setLoading] = useState(false);

  const seed = useMemo(() => items.find(i => i.id === seedId) || items[0], [items, seedId]);

  const build = async () => {
    if (!apiKey || !seed) return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json;charset=utf-8' };
    try {
      const center = [{ id: String(seed.id), title: seed.title, poster: seed.poster ? TMDB_IMG(seed.poster, 'w342') : '' }];
      const seen = new Map(center.map(n => [n.id, n]));
      const recRes = await fetch(`${TMDB_BASE}/movie/${seed.id}/recommendations?language=en-US&page=1`, { headers });
      const data = await recRes.json();
      const results = Array.isArray(data?.results) ? data.results.slice(0, 12) : [];
      const outEdges = [];
      for (const r of results) {
        const nid = String(r.id);
        if (!seen.has(nid)) {
          seen.set(nid, { id: nid, title: r.title, poster: TMDB_IMG(r.poster_path, 'w185') });
        }
        outEdges.push({ from: String(seed.id), to: nid });
      }
      setNodes([...seen.values()]);
      setEdges(outEdges);
    } catch (e) {
      console.error('Navigator build failed', e);
      setNodes([]); setEdges([]);
    } finally {
      setLoading(false);
    }
  };

  const layout = useMemo(() => {
    const center = { id: String(seed?.id ?? '0'), x: 320, y: 180 };
    const others = nodes.filter(n => n.id !== center.id);
    const R = 130;
    const placed = others.map((n, i) => ({ id: n.id, x: center.x + R * Math.cos((i/Math.max(1,others.length)) * 2*Math.PI), y: center.y + R * Math.sin((i/Math.max(1,others.length)) * 2*Math.PI) }));
    return { center, placed };
  }, [nodes, seedId]);

  const pos = (id) => {
    if (String(id) === layout.center.id) return layout.center;
    return layout.placed.find(p => p.id === String(id)) || { x: 0, y: 0 };
  };

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm uppercase tracking-wide opacity-80">
            <Wand2 className="h-4 w-4" /> Because You Liked�
          </div>
          <div className="flex items-center gap-2">
            <select className="bg-transparent border rounded px-2 py-1 text-sm" value={seedId} onChange={(e)=> setSeedId(isNaN(Number(e.target.value))? e.target.value : Number(e.target.value))}>
              {items.map(i=> (
                <option key={i.id} value={i.id}>{i.title}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={build} disabled={loading || !apiKey}>{loading? 'Building�':'Build Map'}</Button>
          </div>
        </div>
        <div className="rounded-2xl border bg-black/20">
          <svg viewBox="0 0 640 360" className="w-full h-[360px]">
            <g stroke="rgba(255,255,255,0.25)" strokeWidth="1">
              {edges.map((e,idx)=>{ const a=pos(e.from), b=pos(e.to); return <line key={idx} x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>; })}
            </g>
            {nodes.map(n=>{ const p=pos(n.id); const isCenter=String(n.id)===String(seed?.id);
              return (
                <g key={n.id} transform={`translate(${p.x - 22}, ${p.y - 22})`} style={{cursor:'pointer'}} onClick={()=> onOpenDetails?.({ id: isNaN(Number(n.id))? n.id : Number(n.id), title: n.title, poster: n.poster })}>
                  <circle cx="22" cy="22" r="24" fill={isCenter? 'rgba(250,204,21,0.25)':'rgba(239,68,68,0.2)'} stroke={isCenter? 'rgba(250,204,21,0.7)':'rgba(239,68,68,0.6)'} />
                  <image href={n.poster||''} x={-4} y={-4} width={52} height={52} preserveAspectRatio="xMidYMid slice" clipPath="circle(22px at 22px 22px)" />
                  <title>{n.title}</title>
                </g>
              );
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
// ----------------- Continuity Navigator -----------------
function ContinuityNavigator({ items, apiKey, onOpenDetails }){
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(false);
  const seeds = useMemo(()=> items.filter(i=> (i.rating||0)>=4).slice(0,3), [items]);
  const build = async ()=>{
    if (!apiKey || !seeds.length) return;
    setLoading(true);
    const headers = { Authorization:`Bearer ${apiKey}`, 'Content-Type':'application/json;charset=utf-8' };
    const out = [];
    try{
      for (const s of seeds){
        const kres = await fetch(`${TMDB_BASE}/movie/${s.id}/keywords`, { headers });
        const kdata = await kres.json();
        const kw = (kdata?.keywords||[]).slice(0,2);
        for (const k of kw){
          const dres = await fetch(`${TMDB_BASE}/discover/movie?include_adult=false&language=en-US&with_genres=27&with_keywords=${k.id}&sort_by=popularity.desc`, { headers });
          const ddata = await dres.json();
          const cand = (ddata?.results||[]).find(r=> r.id !== s.id);
          if (cand){ out.push({ from:s, via:k.name, to:{ id:cand.id, title:cand.title, year:cand.release_date? Number(cand.release_date.slice(0,4)): undefined, poster:cand.poster_path } }); }
        }
      }
    }catch{} finally{ setEdges(out.slice(0,10)); setLoading(false); }
  };
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm uppercase tracking-wide opacity-80">
            <Wand2 className="h-4 w-4" /> Because You Liked…
          </div>
          <Button size="sm" variant="outline" onClick={build} disabled={loading}>{loading? 'Building…':'Build Navigator'}</Button>
        </div>
        {edges.length ? (
          <div className="space-y-2 text-sm">
            {edges.map((e,idx)=> (
              <div key={idx} className="flex items-center gap-2">
                <button className="hover:underline" onClick={()=> onOpenDetails?.(e.from)}>{e.from.title}</button>
                <span className="opacity-70">—[{e.via}]→</span>
                <button className="hover:underline" onClick={()=> onOpenDetails?.(e.to)}>{e.to.title}</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs opacity-70">Select a few favorites (4★+) and click Build to see “because you liked X → try Y”.</div>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------- stats -----------------
function monthKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function StatsView({ items, longAgoYear = 1900 }) {
  const [affOpen, setAffOpen] = useState(false);
  const total = items.length;
  const rated = items.filter(i => (i.rating || 0) > 0);
  const avg = (rated.reduce((s, i) => s + (i.rating || 0), 0) / Math.max(1, rated.length)).toFixed(2);
  const avgScare = (items.reduce((s, i) => s + (i.scares || 0), 0) / Math.max(1, total)).toFixed(2);
  const watches = items.reduce((s, i) => s + (i.watchedDates?.length || 0), 0);

  // Streaks + XP
  const allDates = items
    .flatMap(i => (i.watchedDates || []))
    .filter(d => new Date(d).getFullYear() !== longAgoYear)
    .map(d => new Date(d).toDateString());
  const unique = Array.from(new Set(allDates)).map(s=> new Date(s)).sort((a,b)=> a-b);
  let currentStreak = 0; let streak = 0;
  if (unique.length){
    let prev = new Date(unique[unique.length-1]);
    const today = new Date(); today.setHours(0,0,0,0);
    if (prev.toDateString() !== today.toDateString()){ /* allow break */ }
    // Count backwards consecutive days
    let idx = unique.length - 1; let last = unique[idx];
    while(idx>=0){
      const expect = new Date(last); expect.setDate(expect.getDate()-1);
      if (idx-1>=0 && unique[idx-1].toDateString() === expect.toDateString()){ streak++; last = unique[idx-1]; idx--; }
      else break;
    }
    currentStreak = streak+1; // include last day with a watch
  }
  const xp = watches * 10 + Math.max(0, currentStreak-1) * 5;

  // Badges
  const watchedSet = new Set(items.filter(i=> (i.watchedDates||[]).length).map(i=> i.id));
  const isWatched = (i)=> watchedSet.has(i.id);
  const folkBadge = items.filter(i=> isWatched(i) && (i.tags||[]).includes('folk-horror')).length >= 3;
  const slasher80s = items.filter(i=> isWatched(i) && (i.tags||[]).includes('slasher') && (i.year||0) >= 1980 && (i.year||0) <= 1989).length >= 3;
  const marathon3 = currentStreak >= 3;
  const ghosts5 = items.filter(i=> isWatched(i) && ((i.tags||[]).some(t=>['supernatural','haunted','possession'].includes(t)))).length >= 5;
  const occult4 = items.filter(i=> isWatched(i) && (i.tags||[]).includes('occult')).length >= 4;
  const footage3 = items.filter(i=> isWatched(i) && (i.tags||[]).includes('found-footage')).length >= 3;
  const gore5 = items.filter(i=> isWatched(i) && ((i.tags||[]).includes('gore'))).length >= 5;
  const vamp2 = items.filter(i=> isWatched(i) && (i.tags||[]).includes('vampire')).length >= 2;
  const zombie3 = items.filter(i=> isWatched(i) && (i.tags||[]).includes('zombie')).length >= 3;
  const classic5 = items.filter(i=> isWatched(i) && (i.year||9999) <= 1980).length >= 5;
  const newblood5 = items.filter(i=> isWatched(i) && (i.year||0) >= 2015).length >= 5;
  const maxDayCount = (()=>{ const m=new Map(); (items||[]).forEach(i=> (i.watchedDates||[]).forEach(d=> m.set(d,(m.get(d)||0)+1))); return Math.max(0,...m.values()); })();
  const speed2 = maxDayCount >= 2;
  const reviewer10 = items.filter(i=> isWatched(i) && (i.notes||'').trim().length>0).length >= 10;
  const uniqueTags = new Set(items.flatMap(i=> i.tags||[])).size;
  const tagMaster = uniqueTags >= 20;
  const watchlist10 = items.filter(i=> i.watchlist).length >= 10;
  const highRatings = items.filter(i=> isWatched(i) && (i.rating||0) >= 4).length >= 5;

  // Date range (default last 6 months)
  const today = new Date();
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const [rangeStart, setRangeStart] = useState(new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), sixMonthsAgo.getDate()));
  const [rangeEnd, setRangeEnd] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()));

  const byDay = new Map();
  items.forEach((i) =>
    (i.watchedDates || [])
      .filter(d => new Date(d).getFullYear() !== longAgoYear)
      .forEach((d) => {
        const key = new Date(d).toDateString();
        byDay.set(key, (byDay.get(key) || 0) + 1);
      })
  );
  // Build day list for selected range
  const days = [];
  const start = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
  const end = rangeEnd >= rangeStart ? rangeEnd : rangeStart;
  {
    const dt = new Date(start);
    while (dt <= end) {
      days.push(new Date(dt));
      dt.setDate(dt.getDate() + 1);
    }
  }
  const maxCount = Math.max(1, ...Array.from(byDay.values()));

  const scatterData = items.map((i) => ({ title: i.title, rating: i.rating || 0, scares: i.scares || 0 }));

  // Build top-10 tags by frequency for affinity matrix
  const tagCounts = new Map();
  items.forEach((i) => (i.tags || []).forEach((t) => tagCounts.set(t, (tagCounts.get(t) || 0) + 1)));
  const tags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([t]) => t);
  const tagIndex = Object.fromEntries(tags.map((t, idx) => [t, idx]));
  const matrix = Array.from({ length: tags.length }, () => Array(tags.length).fill(0));
  items.forEach((i) => {
    const t = (i.tags || []).filter((tg) => tagIndex[tg] !== undefined);
    for (let a = 0; a < t.length; a++) {
      for (let b = 0; b < t.length; b++) {
        if (a === b) continue;
        const ia = tagIndex[t[a]];
        const ib = tagIndex[t[b]];
        if (ia === undefined || ib === undefined) continue;
        matrix[ia][ib]++;
      }
    }
  });
  const maxAffinity = Math.max(1, ...matrix.flat());

  const recent = [...items]
    .flatMap((i) => (i.watchedDates || []).filter(d => new Date(d).getFullYear() !== longAgoYear).map((d) => ({ title: i.title, date: d })))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-2">
          <div className="text-sm uppercase tracking-wide opacity-70">Overview</div>
          <div className="text-3xl font-bold">Your horror stats</div>
          <div className="grid grid-cols-5 gap-4 pt-4">
            <div className="p-4 rounded-xl bg-muted">
              <div className="text-sm opacity-70">Movies</div>
              <div className="text-2xl font-semibold">{total}</div>
            </div>
            <div className="p-4 rounded-xl bg-muted">
              <div className="text-sm opacity-70">Avg rating</div>
              <div className="text-2xl font-semibold">{avg}</div>
            </div>
            <div className="p-4 rounded-xl bg-muted">
              <div className="text-sm opacity-70">Total watches</div>
              <div className="text-2xl font-semibold">{watches}</div>
            </div>
            <div className="p-4 rounded-xl bg-muted">
              <div className="text-sm opacity-70">Avg scare</div>
              <div className="text-2xl font-semibold">{avgScare}</div>
            </div>
            <div className="p-4 rounded-xl bg-muted">
              <div className="text-sm opacity-70">Streak</div>
              <div className="text-2xl font-semibold">{currentStreak}d</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <div className="text-lg font-semibold">Badges & XP</div>
          <div className="text-sm">XP: <span className="font-semibold">{xp}</span></div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant={folkBadge? 'default':'secondary'}>Folk Horror Initiate {folkBadge?'✓':''}</Badge>
            <Badge variant={slasher80s? 'default':'secondary'}>80s Slasher Fan {slasher80s?'✓':''}</Badge>
            <Badge variant={marathon3? 'default':'secondary'}>Midnight Marathon (3 in a row) {marathon3?'✓':''}</Badge>
            <Badge variant={ghosts5? 'default':'secondary'}>Ghost Hunter {ghosts5?'✓':''}</Badge>
            <Badge variant={occult4? 'default':'secondary'}>Occult Scholar {occult4?'✓':''}</Badge>
            <Badge variant={footage3? 'default':'secondary'}>Found Footage Addict {footage3?'✓':''}</Badge>
            <Badge variant={gore5? 'default':'secondary'}>Gore Hound {gore5?'✓':''}</Badge>
            <Badge variant={vamp2? 'default':'secondary'}>Vamp Acolyte {vamp2?'✓':''}</Badge>
            <Badge variant={zombie3? 'default':'secondary'}>Zombie Survivalist {zombie3?'✓':''}</Badge>
            <Badge variant={classic5? 'default':'secondary'}>Classic Connoisseur {classic5?'✓':''}</Badge>
            <Badge variant={newblood5? 'default':'secondary'}>New Blood {newblood5?'✓':''}</Badge>
            <Badge variant={speed2? 'default':'secondary'}>Speed Watcher {speed2?'✓':''}</Badge>
            <Badge variant={reviewer10? 'default':'secondary'}>Reviewer {reviewer10?'✓':''}</Badge>
            <Badge variant={tagMaster? 'default':'secondary'}>Tag Master {tagMaster?'✓':''}</Badge>
            <Badge variant={watchlist10? 'default':'secondary'}>Curator (10+ Watchlist) {watchlist10?'✓':''}</Badge>
            <Badge variant={highRatings? 'default':'secondary'}>Knife Juggler (5×4★) {highRatings?'✓':''}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Watch heatmap</div>
            <div className="flex items-center gap-2 text-sm">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">From: {rangeStart.toLocaleDateString()}</Button>
                </PopoverTrigger>
                <PopoverContent className="p-2" align="end">
                  <Calendar mode="single" selected={rangeStart} onSelect={setRangeStart} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">To: {rangeEnd.toLocaleDateString()}</Button>
                </PopoverTrigger>
                <PopoverContent className="p-2" align="end">
                  <Calendar mode="single" selected={rangeEnd} onSelect={setRangeEnd} />
                </PopoverContent>
              </Popover>
              <Button size="sm" onClick={() => { const t=new Date(); const s=new Date(t); s.setMonth(s.getMonth()-6); setRangeStart(new Date(s.getFullYear(), s.getMonth(), s.getDate())); setRangeEnd(new Date(t.getFullYear(), t.getMonth(), t.getDate())); }}>Last 6 mo</Button>
              <Button size="sm" onClick={() => { const t=new Date(); const s=new Date(t); s.setMonth(s.getMonth()-3); setRangeStart(new Date(s.getFullYear(), s.getMonth(), s.getDate())); setRangeEnd(new Date(t.getFullYear(), t.getMonth(), t.getDate())); }}>Last 3 mo</Button>
              <Button size="sm" onClick={() => { const t=new Date(); const s=new Date(t.getFullYear(), 0, 1); setRangeStart(new Date(s.getFullYear(), s.getMonth(), s.getDate())); setRangeEnd(new Date(t.getFullYear(), t.getMonth(), t.getDate())); }}>This year</Button>
              <Button size="sm" onClick={() => { const t=new Date(); const s=new Date(t.getFullYear(), t.getMonth(), 1); setRangeStart(new Date(s.getFullYear(), s.getMonth(), s.getDate())); setRangeEnd(new Date(t.getFullYear(), t.getMonth(), t.getDate())); }}>This month</Button>
            </div>
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.ceil(days.length/7))}, minmax(0, 1fr))` }}>
            {days.map((d, idx) => {
              const key = d.toDateString();
              const c = byDay.get(key) || 0;
              const alpha = c ? 0.2 + 0.8 * (c / maxCount) : 0.08;
              const title = `${d.toLocaleDateString()} – ${c} watches`;
              return <div key={idx} title={title} className="w-3 h-3 rounded-sm" style={{ background: `rgba(239,68,68,${alpha})` }} />;
            })}
          </div>
          <div className="text-xs opacity-70 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Color intensity = more watches that day.
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <div className="text-lg font-semibold">Scare vs. Rating</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <CartesianGrid />
                <XAxis type="number" dataKey="scares" name="Scares" domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
                <YAxis type="number" dataKey="rating" name="Rating" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v, n) => [v, n]} labelFormatter={() => ""} />
                <Scatter data={scatterData} fill="#ef4444" fillOpacity={0.9}>
                  {scatterData.map((e, i) => (
                    <Cell key={`cell-${i}`} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Tag affinity matrix</div>
            <Button size="sm" variant="outline" onClick={() => setAffOpen((v) => !v)}>{affOpen ? "Hide" : "Show"}</Button>
          </div>
          {!affOpen ? (
            <div className="text-sm opacity-70">Top 10 tags by frequency. Click Show to view matrix.</div>
          ) : tags.length ? (
            <div className="overflow-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left p-2"></th>
                    {tags.map((t) => (
                      <th key={t} className="text-left p-2 whitespace-nowrap">
                        #{t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tags.map((row, i) => (
                    <tr key={row}>
                      <td className="p-2 font-medium whitespace-nowrap">#{row}</td>
                      {tags.map((col, j) => {
                        const val = matrix[i][j];
                        const alpha = val ? 0.2 + 0.8 * (val / maxAffinity) : 0.04;
                        return (
                          <td key={row + col} className="p-2" title={`${row} × ${col}: ${val}`}>
                            <div className="w-6 h-6 rounded" style={{ background: `rgba(16,185,129,${alpha})` }} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="opacity-70">Add tags to see affinities.</div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl md:col-span-2">
        <CardContent className="p-6 space-y-3">
          <div className="text-lg font-semibold">Recently watched</div>
          <div className="grid md:grid-cols-2 gap-3">
            {recent.length ? (
              recent.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted">
                  <div className="truncate pr-4">{r.title}</div>
                  <div className="text-sm opacity-70">{new Date(r.date).toLocaleDateString()}</div>
                </div>
              ))
            ) : (
              <div className="opacity-70">Nothing logged yet</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ----------------- details page -----------------
function MovieDetails({ item, localItem, onBack, onUpdate, onAdd, apiKey, omdbKey, dddKey, externalOff = false }) {
  const [details, setDetails] = useState(null);
  const [videos, setVideos] = useState([]);
  const [cert, setCert] = useState("");
  const [cast, setCast] = useState([]);
  const [providers, setProviders] = useState([]);
  const [imdbRating, setImdbRating] = useState(null);
  const [imdbVotes, setImdbVotes] = useState(null);
  const [rtScore, setRtScore] = useState(null);
  const [jumpScares, setJumpScares] = useState(localItem?.jumpScares ?? 0);
  const [goreCount, setGoreCount] = useState(localItem?.goreCount ?? 0);
  const [disturbCount, setDisturbCount] = useState(localItem?.disturbCount ?? 0);
  const [date, setDate] = useState(new Date());
  const [watchOpen, setWatchOpen] = useState(false);
  const rating = localItem?.rating || 0;
  const scares = localItem?.scares ?? 5;

  useEffect(() => {
    if (!apiKey || !item?.id) return;
    const controller = new AbortController();
    const signal = controller.signal;
    const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json;charset=utf-8" };
    const providerSlug = (name='')=>{
      const n = String(name).toLowerCase();
      if (n.includes('netflix')) return 'netflix';
      if (n.includes('prime')) return 'prime';
      if (n.includes('hulu')) return 'hulu';
      if (n.includes('disney')) return 'disney';
      return null;
    };
    async function load() {
      try {
        const [dres, vres, rres, cres] = await Promise.all([
          fetch(`${TMDB_BASE}/movie/${item.id}?language=en-US`, { headers, signal }),
          fetch(`${TMDB_BASE}/movie/${item.id}/videos?language=en-US`, { headers, signal }),
          fetch(`${TMDB_BASE}/movie/${item.id}/release_dates`, { headers, signal }),
          fetch(`${TMDB_BASE}/movie/${item.id}/credits?language=en-US`, { headers, signal }),
        ]);
        const d = await dres.json();
        const v = await vres.json();
        const rd = await rres.json();
        const c = await cres.json();
        if (!signal.aborted) {
          setDetails(d);
          setVideos(v?.results || []);
          setCast((c?.cast || []).slice(0, 10));
          // Extract certification (MPAA) — prefer US, else first non-empty
          const rels = rd?.results || [];
          const us = rels.find((r) => r.iso_3166_1 === "US");
          const pick = (us?.release_dates || []).find((x) => x.certification) ||
            rels.flatMap((r) => r.release_dates || []).find((x) => x.certification);
          setCert(pick?.certification || "");
          // Fetch providers for badges
          try {
            const pres = await fetch(`${TMDB_BASE}/movie/${item.id}/watch/providers`, { headers, signal });
            const pdata = await pres.json();
            const us = pdata?.results?.US || {};
            const flatrate = Array.isArray(us.flatrate)? us.flatrate : [];
            const ads = Array.isArray(us.ads)? us.ads : [];
            const arr = [...flatrate, ...ads].map(p=> providerSlug(p.provider_name)).filter(Boolean);
            setProviders(Array.from(new Set(arr)));
          } catch {}
        }

        // Optional: fetch external ratings via OMDb if omdbKey provided
        if (omdbKey && !externalOff) {
          const xres = await fetch(`${TMDB_BASE}/movie/${item.id}/external_ids`, { headers, signal });
          const xdata = await xres.json();
          const imdbId = xdata?.imdb_id;
          if (imdbId && !signal.aborted) {
            const ores = await fetch(`https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(omdbKey)}`);
            const odata = await ores.json();
            if (odata && odata.Response !== "False") {
              setImdbRating(odata.imdbRating && odata.imdbRating !== "N/A" ? odata.imdbRating : null);
              setImdbVotes(odata.imdbVotes && odata.imdbVotes !== "N/A" ? odata.imdbVotes : null);
              const rt = Array.isArray(odata.Ratings) ? odata.Ratings.find((r) => r.Source === "Rotten Tomatoes") : null;
              setRtScore(rt?.Value || null);
            }
          }
        }

        // Optional: DoesTheDogDie counts when key provided
        if (dddKey && !externalOff && (jumpScares === 0 && goreCount === 0 && disturbCount === 0)) {
          try {
            const title = d?.title || item.title;
            const q1 = {
              query: `query($q:String!){ searchTitles(query:$q){ items { id name year } } }`,
              variables: { q: `${title}` },
            };
            const gres = await fetch("https://graphql.dog/api/graphql", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-API-KEY": dddKey },
              body: JSON.stringify(q1),
              signal,
            });
            const gdata = await gres.json().catch(() => ({}));
            const first = gdata?.data?.searchTitles?.items?.[0];
            if (first && !signal.aborted) {
              const q2 = {
                query: `query($id:ID!){ title(id:$id){ topicItemStats{ count topic{ slug } } } }`,
                variables: { id: first.id },
              };
              const sres = await fetch("https://graphql.dog/api/graphql", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-API-KEY": dddKey },
                body: JSON.stringify(q2),
                signal,
              });
              const sdata = await sres.json().catch(() => ({}));
              const stats = sdata?.data?.title?.topicItemStats || [];
              const get = (slug) => stats.find((x) => x?.topic?.slug === slug)?.count || 0;
              const js = get("jump-scares") || get("jump-scare") || 0;
              const gore = get("graphic-violence") || get("gore") || 0;
              const disturb = get("disturbing") || get("body-horror") || 0;
              if (js || gore || disturb) {
                setJumpScares(js);
                setGoreCount(gore);
                setDisturbCount(disturb);
                onUpdate?.({ ...(localItem || item), jumpScares: js, goreCount: gore, disturbCount: disturb });
              }
            }
          } catch {}
        }

        // Auto-pull TMDb keywords into tags
        try {
          const kres = await fetch(`${TMDB_BASE}/movie/${item.id}/keywords`, { headers, signal });
          const kdata = await kres.json();
          const kws = (kdata?.keywords || []).map(k => k.name.toLowerCase().replace(/\s+/g,'-'));
          if (kws.length) {
            const existing = (localItem?.tags || []);
            const next = Array.from(new Set([ ...existing, ...kws ])).slice(0, 32);
            if (JSON.stringify(existing.slice().sort()) !== JSON.stringify(next.slice().sort())) {
              onUpdate?.({ ...(localItem || item), tags: next });
            }
          }
        } catch {}
      } catch {}
    }
    load();
    return () => controller.abort();
  }, [item?.id, apiKey, omdbKey]);

  // keep counts in sync when switching items
  useEffect(() => {
    setJumpScares(localItem?.jumpScares ?? 0);
    setGoreCount(localItem?.goreCount ?? 0);
    setDisturbCount(localItem?.disturbCount ?? 0);
  }, [localItem?.id]);


  const poster = item.poster ? TMDB_IMG(item.poster, "w500") : details?.poster_path ? TMDB_IMG(details.poster_path, "w500") : "";
  const backdrop = details?.backdrop_path ? TMDB_IMG(details.backdrop_path, "w780") : "";
  const trailer = videos.find((v) => v.site === "YouTube" && v.type === "Trailer");

  return (
    <div className="space-y-4">
      {backdrop ? (
        <div className="rounded-2xl overflow-hidden">
          <img src={backdrop} alt="backdrop" className="w-full h-48 object-cover" />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[180px,1fr]">
        <div className="rounded-2xl overflow-hidden bg-muted w-[180px] h-[270px] mx-auto sm:mx-0">
          {poster ? (
            <img src={poster} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Film className="h-8 w-8" /></div>
          )}
        </div>
        <div className="space-y-2">
          <div className="text-2xl font-bold">
            {details?.title || item.title} {item.year ? <span className="opacity-70 font-normal">({item.year})</span> : null}
          </div>
          <div className="text-sm opacity-80 flex flex-wrap gap-2 items-center">
            <span>{details?.genres?.map((g) => g.name).join(", ")}</span>
            {details?.runtime ? <span>• {details.runtime}m</span> : null}
            {details?.release_date ? <span>• {new Date(details.release_date).toLocaleDateString()}</span> : null}
            {cert ? <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-semibold">Rated {cert}</span> : null}
            {imdbRating ? (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-black/20">⭐ IMDb {imdbRating}{imdbVotes ? ` (${imdbVotes})` : ""}</span>
            ) : details?.vote_average ? (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs opacity-80">TMDb {(details.vote_average / 2).toFixed(1)}/5</span>
            ) : null}
            {rtScore ? (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-black/20">🍅 {rtScore}</span>
            ) : null}
          </div>

          <div className="pt-1 text-sm opacity-90">{details?.overview || item.overview}</div>
          <div className="text-sm opacity-80">Runtime: {details?.runtime ? `${details.runtime}m` : '—'}</div>

          {/* Behind the Screams removed as requested */}

          {cast.length ? (
            <div className="pt-2 space-y-2">
              <div className="text-sm font-semibold">Cast</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {cast.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 min-w-0">
                    {p.profile_path ? (
                      <img
                        src={TMDB_IMG(p.profile_path, "w185")}
                        alt={p.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-zinc-700/40" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm leading-tight truncate">{p.name}</div>
                      <div className="text-xs opacity-70 truncate">as {p.character}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <StarRating
              value={rating}
              onChange={(v) => onUpdate?.({ ...(localItem || item), rating: v })}
            />
            <div className="flex items-center gap-2 text-sm">
              <Label className="text-xs opacity-80">Scare</Label>
              <Slider
                value={[scares]}
                min={0}
                max={10}
                step={1}
                onValueChange={(val) => onUpdate?.({ ...(localItem || item), scares: val[0] })}
                className="w-40"
              />
              <span className="tabular-nums">{scares}</span>
            </div>
            <div className="w-full">
              <Label className="text-xs opacity-80">Tags</Label>
              <TagEditor tags={localItem?.tags || []} onChange={(t)=> onUpdate?.({ ...(localItem||item), tags: t })} />
            </div>

            {/* Smart Tagging Assist removed; TMDb keywords auto-pulled */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Label className="text-xs opacity-80">Jump scares</Label>
                <Input type="number" min={0} className="w-16" value={jumpScares}
                  onChange={(e)=>{ const v=Math.max(0, Number(e.target.value)||0); setJumpScares(v); onUpdate?.({ ...(localItem||item), jumpScares: v }); }} />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs opacity-80">Gore</Label>
                <Input type="number" min={0} className="w-16" value={goreCount}
                  onChange={(e)=>{ const v=Math.max(0, Number(e.target.value)||0); setGoreCount(v); onUpdate?.({ ...(localItem||item), goreCount: v }); }} />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs opacity-80">Disturbing</Label>
                <Input type="number" min={0} className="w-16" value={disturbCount}
                  onChange={(e)=>{ const v=Math.max(0, Number(e.target.value)||0); setDisturbCount(v); onUpdate?.({ ...(localItem||item), disturbCount: v }); }} />
              </div>
            </div>
          </div>

          <div className="pt-2 flex gap-2 flex-wrap">
            {localItem ? (
              (localItem.watchedDates?.length ? null : (
                <Button variant={localItem.watchlist ? "default" : "outline"} size="sm" onClick={() => onUpdate?.({ ...localItem, watchlist: !localItem.watchlist })}>
                  <Heart className="h-4 w-4 mr-1" /> {localItem.watchlist ? "In Watchlist" : "Add to Watchlist"}
                </Button>
              ))
            ) : (
              <>
                <Button size="sm" onClick={() => onAdd?.(item)}>
                  <BookmarkPlus className="h-4 w-4 mr-1" /> Add to Library
                </Button>
                <Button size="sm" variant="outline" onClick={() => onAdd?.({ ...item, watchlist: true })}>
                  <Heart className="h-4 w-4 mr-1" /> Add to Watchlist
                </Button>
              </>
            )}

            {/* Watched logging */}
            <Dialog open={watchOpen} onOpenChange={setWatchOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm">
                  <CalIcon className="h-4 w-4 mr-1" /> Watched
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Log a watch date</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        {date.toDateString()}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-2" align="start">
                      <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <div className="flex gap-2">
                    <Button onClick={() => {
                      const iso = isoDateOnly(date);
                      const watchedDates = Array.from(new Set([...(localItem?.watchedDates || []), iso]));
                      onUpdate?.({ ...(localItem || item), watchedDates, watchlist: false });
                      setWatchOpen(false);
                    }}>
                      <Check className="h-4 w-4 mr-2" /> Save date
                    </Button>
                    <Button variant="outline" onClick={() => {
                      const today = new Date();
                      const iso = isoDateOnly(today);
                      const watchedDates = Array.from(new Set([...(localItem?.watchedDates || []), iso]));
                      onUpdate?.({ ...(localItem || item), watchedDates, watchlist: false });
                      setWatchOpen(false);
                    }}>
                      <CalIcon className="h-4 w-4 mr-2" /> Watched today
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Shareable poster card */}
            <Button size="sm" variant="outline" onClick={async ()=>{
              const canvas = document.createElement('canvas');
              canvas.width = 800; canvas.height = 1200;
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#0b0b0b'; ctx.fillRect(0,0,canvas.width,canvas.height);
              const img = new Image(); img.crossOrigin='anonymous';
              const posterUrl = details?.poster_path ? TMDB_IMG(details.poster_path,'w500') : (item.poster? TMDB_IMG(item.poster,'w500'): null);
              if (posterUrl) { await new Promise((res)=>{ img.onload=res; img.onerror=res; img.src=posterUrl; }); ctx.drawImage(img, 50, 80, 300, 450); }
              ctx.fillStyle='#fff'; ctx.font='bold 32px system-ui, sans-serif'; ctx.fillText((details?.title||item.title||'Untitled').slice(0,40), 50, 580);
              const knives = Math.round((localItem?.rating||0));
              for (let k=0;k<5;k++){ ctx.fillStyle = k<knives? '#ef4444' : 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(380+k*70,110); ctx.lineTo(420+k*70,140); ctx.lineTo(380+k*70,170); ctx.closePath(); ctx.fill(); }
              ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.font='14px system-ui, sans-serif'; ctx.fillText('HorrorHub', 50, 1150);
              const url = canvas.toDataURL('image/png'); const a = document.createElement('a'); a.href=url; a.download=`${(details?.title||item.title||'card').replace(/[^a-z0-9]+/gi,'-')}.png`; a.click();
            }}>Share Card</Button>

            {/* Clear watched to allow re-watchlisting */}
            {localItem?.watchedDates?.length ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUpdate?.({ ...localItem, watchedDates: [] })}
                title="Remove logged watch dates"
              >
                Clear watched
              </Button>
            ) : null}

            {trailer ? (
              <a
                href={`https://www.youtube.com/watch?v=${trailer.key}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-xl border px-3 py-2 text-sm hover:bg-white/5"
              >
                Watch Trailer
              </a>
            ) : null}

            <a
              href={`https://www.themoviedb.org/movie/${item.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-xl border px-3 py-2 text-sm hover:bg-white/5"
            >
              TMDb Page
            </a>

            {/* Reddit searches */}
            <a
              href={`https://www.reddit.com/search/?q=${encodeURIComponent((details?.title || item.title) + " movie discussion")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-xl border px-3 py-2 text-sm hover:bg-white/5"
            >
              Reddit Search
            </a>
            <a
              href={`https://www.reddit.com/r/horror/search/?q=${encodeURIComponent(details?.title || item.title)}&restrict_sr=1`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-xl border px-3 py-2 text-sm hover:bg-white/5"
            >
              r/horror Search
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------- settings -----------------
function Settings({ settings, onChange, onImport, watchlist, data }) {
  const [apiKey, setApiKey] = useState(settings.apiKey || "");
  const [omdbKey, setOmdbKey] = useState(settings.omdbKey || "");
  const [dddKey, setDddKey] = useState(settings.dddKey || "");
  const [theme, setTheme] = useState(settings.theme || "dark");
  const [flicker, setFlicker] = useState(settings.flicker ?? true);
  const [fog, setFog] = useState(settings.fog ?? true);
  const [ambientAudio, setAmbientAudio] = useState(settings.ambientAudio ?? false);
  const [lightsOut, setLightsOut] = useState(settings.lightsOut ?? false);
  const [seasonal, setSeasonal] = useState(settings.seasonal ?? (new Date().getMonth()===9));
  const [releaseRadar, setReleaseRadar] = useState(settings.releaseRadar ?? true);
  const [nudgeDays, setNudgeDays] = useState(settings.nudgeDays ?? 7);
  const [mGhosts, setMGhosts] = useState(settings.mixerGhosts ?? 1);
  const [mOccult, setMOccult] = useState(settings.mixerOccult ?? 1);
  const [mSlasher, setMSlasher] = useState(settings.mixerSlasher ?? 1);
  const [mFolk, setMFolk] = useState(settings.mixerFolk ?? 1);
  const [spookyFont, setSpookyFont] = useState(settings.spookyFont ?? true);
  const [highContrast, setHighContrast] = useState(settings.highContrast ?? false);
  const [dyslexic, setDyslexic] = useState(settings.dyslexic ?? false);
  const [externalOff, setExternalOff] = useState(settings.externalOff ?? false);
  const [planDays, setPlanDays] = useState(settings.planDays ?? [5,6]);
  const [planTime, setPlanTime] = useState(settings.planTime ?? '20:00');
  const [longAgoYear, setLongAgoYear] = useState(settings.longAgoYear ?? 1900);
  useEffect(() => {
    onChange?.({ apiKey, omdbKey, dddKey, theme, flicker, fog, ambientAudio, lightsOut, seasonal, releaseRadar, nudgeDays, mixerGhosts: mGhosts, mixerOccult: mOccult, mixerSlasher: mSlasher, mixerFolk: mFolk, highContrast, dyslexic, planDays, planTime, externalOff, spookyFont, longAgoYear });
    try { localStorage.setItem('horrorhub.longAgoYear', String(longAgoYear)); } catch {}
  }, [apiKey, omdbKey, dddKey, theme, flicker, fog, ambientAudio, lightsOut, seasonal, releaseRadar, nudgeDays, mGhosts, mOccult, mSlasher, mFolk, highContrast, dyslexic, planDays, planTime, externalOff, spookyFont, longAgoYear]);

  return (
    <div className="space-y-6">
      {false && (
      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <div className="text-lg font-semibold">Connections</div>
          <Label className="text-sm">TMDb API Access Token (v4)</Label>
          <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your Bearer token here" />
          <div className="text-sm opacity-70">Get a free account at themoviedb.org → Settings → API → v4 auth. Paste the long token here.</div>
          <div className="pt-3" />
          <Label className="text-sm">OMDb API Key (optional, for IMDb/RT ratings)</Label>
          <Input type="text" value={omdbKey} onChange={(e) => setOmdbKey(e.target.value)} placeholder="If set, details pages show IMDb and Rotten Tomatoes" />
          <div className="pt-3" />
          <Label className="text-sm">DoesTheDogDie API Key (optional, for jump scares & content)</Label>
          <Input type="text" value={dddKey} onChange={(e) => setDddKey(e.target.value)} placeholder="If set, details pages auto-fill jump scares/gore/disturbing" />
        </CardContent>
      </Card>
      )}

      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <div className="text-lg font-semibold">Appearance & Data</div>
          <div className="flex gap-2">
            <Button variant={theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")}>
              Dark
            </Button>
            <Button variant={theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")}>
              Light
            </Button>
            <Button variant={theme === "system" ? "default" : "outline"} onClick={() => setTheme("system")}>
              System
            </Button>
          </div>
          <div className="text-sm opacity-70">Theme value is stored locally. Wire it to your app shell if you add a real theme switcher.</div>
          <div className="pt-2 flex items-center gap-2">
            <input id="spookyfont-toggle" type="checkbox" checked={spookyFont} onChange={(e)=>setSpookyFont(e.target.checked)} />
            <Label htmlFor="spookyfont-toggle">Spooky header font</Label>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <input id="flicker-toggle" type="checkbox" checked={flicker} onChange={(e)=>setFlicker(e.target.checked)} />
            <Label htmlFor="flicker-toggle">Ambient edge flicker</Label>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <input id="fog-toggle" type="checkbox" checked={fog} onChange={(e)=>setFog(e.target.checked)} />
            <Label htmlFor="fog-toggle">Fog overlay</Label>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <input id="audio-toggle" type="checkbox" checked={ambientAudio} onChange={(e)=>setAmbientAudio(e.target.checked)} />
            <Label htmlFor="audio-toggle">Ambient whispers/heartbeat</Label>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <input id="externaloff-toggle" type="checkbox" checked={externalOff} onChange={(e)=>setExternalOff(e.target.checked)} />
            <Label htmlFor="externaloff-toggle">Disable external lookups (OMDb / DoesTheDogDie)</Label>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <input id="lightsout-toggle" type="checkbox" checked={lightsOut} onChange={(e)=>setLightsOut(e.target.checked)} />
            <Label htmlFor="lightsout-toggle">Lights‑Out dimmer</Label>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <input id="seasonal-toggle" type="checkbox" checked={seasonal} onChange={(e)=>setSeasonal(e.target.checked)} />
            <Label htmlFor="seasonal-toggle">October theme (blood moon + countdown)</Label>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <input id="radar-toggle" type="checkbox" checked={releaseRadar} onChange={(e)=>setReleaseRadar(e.target.checked)} />
            <Label htmlFor="radar-toggle">Release Radar notifications</Label>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <Label className="text-sm">Nudge cadence (days 3–14)</Label>
            <Input type="number" min={3} max={14} className="w-20" value={nudgeDays} onChange={(e)=> setNudgeDays(Math.min(14, Math.max(3, Number(e.target.value)||7)))} />
          </div>          <div className="pt-2 flex items-center gap-2">
            <Label className="text-sm">“Long ago” year</Label>
            <Input type="number" min="1800" max={new Date().getFullYear()} className="w-24" value={longAgoYear} onChange={(e)=> setLongAgoYear(Math.max(1800, Math.min(new Date().getFullYear(), Number(e.target.value)||1900)))} />
            <div className="text-xs opacity-70">Used when logging “Watched long ago” and to exclude from Stats.</div>
          </div>
          <div className="pt-4 text-sm font-semibold">Subgenre Mixer</div>
          <div className="grid grid-cols-2 gap-3 text-sm items-center">
            <Label>Ghosts</Label>
            <input type="range" min="0" max="2" step="1" value={mGhosts} onChange={e=>setMGhosts(Number(e.target.value))} />
            <Label>Occult</Label>
            <input type="range" min="0" max="2" step="1" value={mOccult} onChange={e=>setMOccult(Number(e.target.value))} />
            <Label>Slasher</Label>
            <input type="range" min="0" max="2" step="1" value={mSlasher} onChange={e=>setMSlasher(Number(e.target.value))} />
            <Label>Folk</Label>
            <input type="range" min="0" max="2" step="1" value={mFolk} onChange={e=>setMFolk(Number(e.target.value))} />
          </div>
          <div className="pt-4 text-sm font-semibold">Accessibility</div>
          <div className="pt-2 flex items-center gap-2">
            <input id="hc-toggle" type="checkbox" checked={highContrast} onChange={(e)=>setHighContrast(e.target.checked)} />
            <Label htmlFor="hc-toggle">High-Contrast mode</Label>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <input id="dys-toggle" type="checkbox" checked={dyslexic} onChange={(e)=>setDyslexic(e.target.checked)} />
            <Label htmlFor="dys-toggle">Dyslexia‑friendly font</Label>
          </div>
          <div className="pt-4 text-sm font-semibold">Weekly Watch Plan</div>
          <div className="text-xs opacity-80">Preferred days</div>
          <div className="flex flex-wrap gap-2 text-sm">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,idx)=> (
              <label key={d} className="inline-flex items-center gap-1"><input type="checkbox" checked={planDays.includes(idx)} onChange={(e)=>{
                setPlanDays(p=> e.target.checked ? Array.from(new Set([...p, idx])) : p.filter(x=>x!==idx));
              }} />{d}</label>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm mt-2">
            <Label>Time</Label>
            <Input type="time" value={planTime} onChange={(e)=> setPlanTime(e.target.value||'20:00')} className="w-28" />
          </div>
          <div className="pt-2" />
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <div className="text-lg font-semibold">Backup & Import</div>
          <div className="text-sm opacity-70">Export your library to JSON, import from JSON/CSV, or export a watchlist calendar.</div>
          <ExportImport data={data || []} onImport={onImport} watchlist={watchlist || []} />
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <div className="text-lg font-semibold">Connections</div>
          <Label className="text-sm">TMDb API Access Token (v4)</Label>
          <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your Bearer token here" />
          <div className="text-sm opacity-70">Get a free account at themoviedb.org → Settings → API → v4 auth. Paste the long token here.</div>
          <div className="pt-3" />
          <Label className="text-sm">OMDb API Key (optional, for IMDb/RT ratings)</Label>
          <Input type="text" value={omdbKey} onChange={(e) => setOmdbKey(e.target.value)} placeholder="If set, details pages show IMDb and Rotten Tomatoes" />
          <div className="pt-3" />
          <Label className="text-sm">DoesTheDogDie API Key (optional, for jump scares & content)</Label>
          <Input type="text" value={dddKey} onChange={(e) => setDddKey(e.target.value)} placeholder="If set, details pages auto-fill jump scares/gore/disturbing" />
        </CardContent>
      </Card>
    </div>
  );
}

// ----------------- root -----------------
export function HorrorHub() {
  const { library, upsert, remove } = useLibrary();
  const [settings, setSettings] = useState(loadSettings());
  const [selected, setSelected] = useState(null); // movie object to show details
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const inLibraryIds = useMemo(() => new Set(library.map((i) => i.id)), [library]);
  const watchlistIds = useMemo(() => new Set(library.filter((i) => i.watchlist).map((i) => i.id)), [library]);
  const ratingById = useMemo(() => Object.fromEntries(library.map(i=> [i.id, i.rating||0])), [library]);

  const addToLibrary = (m) => {
    const item = {
      id: m.id,
      title: m.title,
      year: m.year,
      poster: m.poster,
      overview: m.overview,
      addedAt: new Date().toISOString(),
      watchedDates: [],
      rating: m.rating ?? 0,
      scares: m.scares ?? 5,
      tags: [],
      watchlist: !!m.watchlist,
      releaseDate: m.releaseDate || m.date,
    };
    upsert(item);
  };

  const importLib = (arr) => {
    if (!Array.isArray(arr)) return alert("Bad import file");
    const clean = arr.map((i) => ({
      ...i,
      addedAt: i.addedAt || new Date().toISOString(),
      watchedDates: i.watchedDates || [],
      watchlist: !!i.watchlist,
    }));
    saveLibrary(clean);
    window.location.reload();
  };

  const watchlist = library.filter((i) => i.watchlist);

  // Nudge engine: gentle reminder after N days
  const [showNudge, setShowNudge] = useState(false);
  useEffect(() => {
    const enabled = true; // nudge engine always on; cadence controlled by nudgeDays
    if (!enabled) return;
    const nudgeDays = Number(settings.nudgeDays || 7);
    const lastWatch = localStorage.getItem('horrorhub.lastWatch');
    if (!lastWatch) return;
    const last = new Date(lastWatch);
    const diffDays = Math.floor((Date.now() - last.getTime())/(1000*60*60*24));
    const lastNudge = Number(localStorage.getItem('horrorhub.lastNudge')||0);
    const sinceNudge = Math.floor((Date.now() - lastNudge)/(1000*60*60*24));
    if (diffDays >= nudgeDays && sinceNudge >= nudgeDays) setShowNudge(true);
  }, [settings]);
  // Release Radar notifications effect
  useEffect(() => {
    if (!settings.releaseRadar) return;
    if (!("Notification" in window)) return;
    const key = 'horrorhub.notified.v1';
    const notified = new Set(JSON.parse(localStorage.getItem(key) || '[]'));
    const today = new Date().toISOString().slice(0,10);
    const due = watchlist.filter(i => i.releaseDate && i.releaseDate <= today && !notified.has(i.id));
    if (!due.length) return;
    (async ()=>{
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
      due.slice(0,3).forEach(i=>{ try{ new Notification('Now Released', { body: `${i.title} is out today!` }); }catch{} notified.add(i.id); });
      localStorage.setItem(key, JSON.stringify(Array.from(notified)));
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
          <Button variant={settings.lightsOut ? "default" : "outline"} onClick={()=>setSettings(s=>({...s, lightsOut: !s.lightsOut}))}>
            {settings.lightsOut ? 'Lights on' : 'Lights out'}
          </Button>
          {/* Export/Import moved to Settings */}
        </div>
      </div>
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
                onBack={() => setSelected(null)}
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
              <LibraryView items={library} onUpdate={upsert} onRemove={remove} apiKey={settings.apiKey} onOpenDetails={setSelected} />
            </TabsContent>

        <TabsContent value="watchlist" className="mt-6">
          <WatchlistView items={watchlist} onUpdate={upsert} onRemove={remove} onOpenDetails={setSelected} planDays={settings.planDays || []} planTime={settings.planTime || '20:00'} />
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
    mixer={{ ghosts: settings.mixerGhosts ?? 1, occult: settings.mixerOccult ?? 1, slasher: settings.mixerSlasher ?? 1, folk: settings.mixerFolk ?? 1 }}
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
              <StatsView items={library} longAgoYear={settings.longAgoYear ?? 1900} />
            </TabsContent>

            <TabsContent value="settings" className="mt-6">
              <Settings settings={settings} onChange={(s) => setSettings(s)} onImport={importLib} watchlist={watchlist} data={library} />
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
      {(settings.flicker ?? true) && <FlickerOverlay />}
      {(settings.fog ?? true) && <FogOverlay />}
      {settings.ambientAudio ? <AmbientAudio /> : null}
      {settings.lightsOut ? <LightsOutOverlay /> : null}
      {showNudge ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
          <div className="flex items-center gap-3 rounded-2xl bg-black/70 text-white px-4 py-2 shadow-lg">
            <span className="text-sm">It’s been a while — roll a pick?</span>
            <Button size="sm" onClick={()=>{
              const pool = watchlist.length? watchlist : library;
              if (pool.length){ const pick = pool[Math.floor(Math.random()*pool.length)]; setSelected(pick); }
              setShowNudge(false); localStorage.setItem('horrorhub.lastNudge', String(Date.now()));
            }}>Roll</Button>
            <Button size="sm" variant="outline" onClick={()=>{ setShowNudge(false); localStorage.setItem('horrorhub.lastNudge', String(Date.now())); }}>Dismiss</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Default export expected by Vite entry (main.jsx)
export default function App() {
  return <HorrorHub />;
}

// Ambient edge flicker overlay
function FlickerOverlay() {
  const [spots, setSpots] = React.useState(() => makeSpots());

  function makeSpot(i) {
    const edge = Math.random() < 0.5 ? 0 : 1; // left or right edge
    const x = edge === 0 ? Math.random() * 8 : 92 + Math.random() * 8; // vw
    const y = Math.random() * 100; // vh
    const size = 10 + Math.random() * 18; // vw
    const delay = Math.random() * 6;
    const duration = 4 + Math.random() * 10;
    const red = 'rgba(239,68,68,0.10)';
    const pale = 'rgba(255,255,255,0.06)';
    const color = Math.random() < 0.6 ? red : pale;
    return { id: i, x, y, size, delay, duration, color };
  }

  function makeSpots() {
    return Array.from({ length: 4 }).map((_, i) => makeSpot(i));
  }

  React.useEffect(() => {
    const iv = setInterval(() => {
      setSpots((prev) => {
        const next = [...prev];
        const idx = Math.floor(Math.random() * next.length);
        next[idx] = makeSpot(idx);
        return next;
      });
    }, 3000 + Math.random() * 2000);

    const onScroll = () => {
      setSpots((prev) => prev.map((s) => ({ ...s, y: (s.y + 5) % 100 })));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { clearInterval(iv); window.removeEventListener('scroll', onScroll); };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {spots.map((s) => (
        <span
          key={s.id}
          className="flicker-spot"
          style={{
            left: `${s.x}vw`,
            top: `${s.y}vh`,
            width: `${s.size}vw`,
            height: `${s.size}vw`,
            background: `radial-gradient(circle at center, ${s.color}, transparent 60%)`,
            animation: `flickerPulse ${s.duration}s infinite`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// Fog overlay
function FogOverlay(){
  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      <div className="fog-layer fog-left" />
      <div className="fog-layer fog-right" />
    </div>
  );
}

// Ambient audio — subtle whispers + heartbeat using WebAudio
function AmbientAudio(){
  const startedRef = React.useRef(false);
  React.useEffect(() => {
    let ctx; let noiseNode; let gain; let kickGain; let interval;
    const start = async () => {
      if (startedRef.current) return; startedRef.current = true;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Whisper: filtered noise
      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i=0;i<bufferSize;i++){ data[i] = Math.random()*2-1; }
      noiseNode = ctx.createBufferSource(); noiseNode.buffer = noiseBuffer; noiseNode.loop = true;
      const filter = ctx.createBiquadFilter(); filter.type = "bandpass"; filter.frequency.value = 600; filter.Q.value = 0.7;
      gain = ctx.createGain(); gain.gain.value = 0.02; // very subtle
      noiseNode.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      noiseNode.start();
      // Heartbeat: short low thump periodically
      const kick = () => {
        const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(60, ctx.currentTime);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
        o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.35);
      };
      kick(); interval = setInterval(kick, 1600);
    };
    const resume = () => { start(); window.removeEventListener('pointerdown', resume); };
    window.addEventListener('pointerdown', resume, { once: true });
    return () => { try{ noiseNode && noiseNode.stop(); }catch{} clearInterval(interval); if (ctx && ctx.close) ctx.close(); window.removeEventListener('pointerdown', resume); };
  }, []);
  return null;
}

// Lights-out overlay
function LightsOutOverlay(){
  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      <div className="lightsout-dim" />
      <div className="candle-spot" />
    </div>
  );
}
// ----------------- Rating Roulette -----------------
function RatingRoulette({ apiKey, onAdd, onOpenDetails, ratingMap={}, inLibraryIds = new Set(), watchlistIds = new Set() }){
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageSize, setPageSize] = useState(() => {
    try { return Number(JSON.parse(localStorage.getItem('horrorhub.roulette.pageSize')||'12')) || 12; } catch { return 12; }
  });
  const [hideRated, setHideRated] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem('horrorhub.roulette.hideRated')||'true'); return !!v; } catch { return true; }
  });
  const [hideInLibrary, setHideInLibrary] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem('horrorhub.roulette.hideInLibrary')||'false'); return !!v; } catch { return false; }
  });
  const [hideWatchlisted, setHideWatchlisted] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem('horrorhub.roulette.hideWatchlisted')||'false'); return !!v; } catch { return false; }
  });
  const [providersSel, setProvidersSel] = useState(() => {
    try { return JSON.parse(localStorage.getItem('horrorhub.roulette.providers')||'[]'); } catch { return []; }
  });
  const [totalPages, setTotalPages] = useState(null);
  const [jumpVal, setJumpVal] = useState(1);
  const cacheRef = useRef(new Map()); // page -> rows
  const providersRef = useRef(new Map()); // id -> [slugs]
  const headers = apiKey ? { Authorization:`Bearer ${apiKey}`, 'Content-Type':'application/json;charset=utf-8' } : undefined;

  useEffect(()=>{ try { localStorage.setItem('horrorhub.roulette.pageSize', JSON.stringify(pageSize)); } catch {} },[pageSize]);
  useEffect(()=>{ try { localStorage.setItem('horrorhub.roulette.hideRated', JSON.stringify(hideRated)); } catch {} },[hideRated]);
  useEffect(()=>{ try { localStorage.setItem('horrorhub.roulette.hideInLibrary', JSON.stringify(hideInLibrary)); } catch {} },[hideInLibrary]);
  useEffect(()=>{ try { localStorage.setItem('horrorhub.roulette.hideWatchlisted', JSON.stringify(hideWatchlisted)); } catch {} },[hideWatchlisted]);
  useEffect(()=>{ try { localStorage.setItem('horrorhub.roulette.providers', JSON.stringify(providersSel||[])); } catch {} },[providersSel]);

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
// Simple shimmer image with fallback
function ShimmerImage({ src, alt, className }){
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="relative">
      {!loaded && !error && <div className="absolute inset-0 animate-pulse bg-muted" />}
      {src && !error ? (
        <img src={src} alt={alt} className={className} onLoad={()=> setLoaded(true)} onError={()=> setError(true)} />
      ) : (
        <div className={`flex items-center justify-center ${className}`}>
          <Film className="h-6 w-6 opacity-60" />
        </div>
      )}
    </div>
  );
}
















