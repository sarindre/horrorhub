import { useEffect, useMemo, useState } from "react";
import { BellRing, Info } from "lucide-react";
import SearchBar from "../../components/SearchBar.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Label } from "../../components/ui/label.jsx";
import { Slider } from "../../components/ui/slider.jsx";
import { MOOD_PRESETS, matchesMood } from "../../lib/moods.js";
import { MovieCard } from "../../components/MovieCard.jsx";

export function LibraryView({ items, onUpdate, onRemove, onOpenDetails }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [moodFilter, setMoodFilter] = useState("all");
  const [minRating, setMinRating] = useState(0);
  const [maxScares, setMaxScares] = useState(10);
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

    if (moodFilter !== "all") {
      arr = arr.filter((i) => matchesMood(i.tags || [], moodFilter));
    }

    arr = arr.filter((i) => (i.rating || 0) >= minRating);

    // Titles without a scare score are kept; only known-too-intense ones are hidden
    if (maxScares < 10) {
      arr = arr.filter((i) => typeof i.scares !== "number" || i.scares <= maxScares);
    }

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
  }, [items, debouncedQuery, tagFilter, moodFilter, minRating, maxScares, sort]);

  const watchlist = items.filter((i) => i.watchlist);

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
          <div className="flex gap-2 flex-wrap">
            {MOOD_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                size="sm"
                variant={moodFilter === preset.id ? "default" : "outline"}
                onClick={() => setMoodFilter(preset.id)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

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

          {/* Max intensity */}
          <div className="flex items-center gap-3">
            <Label className="text-sm">Max scares</Label>
            <Slider value={[maxScares]} min={0} max={10} step={1} onValueChange={(v) => setMaxScares(v[0])} className="w-[160px]" />
            <span className="text-sm opacity-70 w-6 text-right">{maxScares}</span>
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
                setMoodFilter("all");
                setMinRating(0);
                setMaxScares(10);
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
