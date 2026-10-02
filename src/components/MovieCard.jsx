import { useEffect, useState } from "react";
import { Film, Trash2, Flame, BookmarkPlus, Tags, Save, Heart } from "lucide-react";
import { Card, CardContent } from "./ui/card.jsx";
import { Button } from "./ui/button.jsx";
import { Textarea } from "./ui/textarea.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog.jsx";
import { Badge } from "./ui/badge.jsx";
import { Label } from "./ui/label.jsx";
import { Slider } from "./ui/slider.jsx";
import { StarRating } from "./StarRating.jsx";
import { TagEditor } from "./TagEditor.jsx";
import { ShimmerImage } from "./ShimmerImage.jsx";
import { TMDB_IMG } from "../lib/tmdb.js";
import { WatchDialog } from "./WatchDialog.jsx";
import { watchPatch } from "../lib/watch.js";
import { ContentWarnings } from "./ContentWarnings.jsx";
import { useContentPrefs } from "../lib/contentContext.js";
import { evaluateContent, itemFlags } from "../lib/contentFlags.js";
import { editTags } from "../lib/tagging.js";
import { scareOf } from "../lib/scare.js";

export function MovieCard({ item, onAdd, onUpdate, onRemove, showWatchlist = true, compact = false, onOpenDetails, isInLibrary = false, isWatchlisted = false, warnings }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(item.notes || "");
  const [tags, setTags] = useState(item.tags || []);
  const [rating, setRating] = useState(item.rating || 0);
  const scareInfo = scareOf(item);
  const [scares, setScares] = useState(scareInfo.value);
  const [addedUI, setAddedUI] = useState(false);
  const [watchlistedUI, setWatchlistedUI] = useState(!!item.watchlist || isWatchlisted);
  const isWatched = isInLibrary || (item.watchedDates?.length || 0) > 0;
  const [tagsExpanded, setTagsExpanded] = useState(false);

  // Content warnings: stored/inferred flags (or a caller-supplied list for TMDb
  // results), checked against your limits. Your own scare rating only counts
  // for films you own.
  const prefs = useContentPrefs();
  const flags = warnings ?? itemFlags(item);
  const verdict = evaluateContent({ flags, scares: isInLibrary ? item.scares : undefined }, prefs);
  const warningsEl = (
    <ContentWarnings flags={flags} avoid={prefs.avoidFlags} reasons={verdict.blocked ? verdict.reasons : []} showFlags={prefs.showWarnings} />
  );

  useEffect(() => {
    setNotes(item.notes || "");
    setTags(item.tags || []);
    setRating(item.rating || 0);
    setScares(scareOf(item).value);
    setAddedUI(false);
    setWatchlistedUI(!!item.watchlist || isWatchlisted);
    // Resets the editable fields when the card shows a different film (or its
    // watchlist state flips); resyncing on every field change would clobber
    // in-progress edits to notes/tags/rating.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, isWatchlisted]);

  const poster = item.poster ? TMDB_IMG(item.poster, "w342") : "";

  const saveDetails = () => {
    const scareChanged = scares !== scareOf(item).value;
    onUpdate?.({ ...item, notes, ...editTags(item, tags), rating, ...(scareChanged ? { scares, scaresRated: true } : {}) });
    setOpen(false);
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
                e.preventDefault(); setOpen(false);
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
              </div>
              <div className="text-sm opacity-80 line-clamp-2">{item.overview}</div>
              {warningsEl}
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
                      const updated = { ...item, scares: v, scaresRated: true };
                      if (onUpdate) onUpdate(updated);
                      else onAdd?.(updated);
                    }}
                    className="w-28"
                  />
                  <span role="img" aria-label="screaming" className="text-lg">😱</span>
                  <span className="tabular-nums">{scares}{scareInfo.estimated ? <span className="ml-1 text-[10px] opacity-70">est.</span> : null}</span>
                </div>
                {onUpdate && (
                  <WatchDialog label="Watched" longAgo rating={item.rating} onLog={(iso, diary, rating) => onUpdate?.({ ...item, ...watchPatch(item, iso, diary, rating) })} />
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
              e.preventDefault(); setOpen(false);
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
                </h3>
                <div className="text-sm opacity-80 line-clamp-2">{item.overview}</div>
              {warningsEl}
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
                  Scare: {scares}{scareInfo.estimated ? " (est.)" : ""}
                </div>
                {showWatchlist && !(item.watchedDates?.length) && (
                  <Button variant={item.watchlist ? "default" : "outline"} size="sm" onClick={toggleWatchlist} title="Toggle watchlist">
                    <Heart className="h-4 w-4 mr-1" />
                    {item.watchlist ? "In Watchlist" : "Add to Watchlist"}
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                <WatchDialog label="Log watch" longAgo rating={item.rating} onLog={(iso, diary, rating) => onUpdate?.({ ...item, ...watchPatch(item, iso, diary, rating) })} />

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
                        <TagEditor tags={tags} autoTags={item.autoTags} onChange={setTags} />
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
