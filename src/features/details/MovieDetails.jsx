import { useEffect, useState } from "react";
import { Film, Calendar as CalIcon, BookmarkPlus, Check, Heart } from "lucide-react";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog.jsx";
import { Calendar } from "../../components/ui/calendar.jsx";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover.jsx";
import { Label } from "../../components/ui/label.jsx";
import { Slider } from "../../components/ui/slider.jsx";
import { StarRating } from "../../components/StarRating.jsx";
import { TagEditor } from "../../components/TagEditor.jsx";
import { TMDB_IMG, describeError, isAbort, tmdbGet } from "../../lib/tmdb.js";
import { isoDateOnly } from "../../lib/dates.js";

const DETAILS_CACHE_MS = 5 * 60 * 1000;

export function MovieDetails({ item, localItem, onUpdate, onAdd, apiKey, omdbKey, dddKey, externalOff = false }) {
  const [details, setDetails] = useState(null);
  const [videos, setVideos] = useState([]);
  const [cert, setCert] = useState("");
  const [cast, setCast] = useState([]);
  const [loadError, setLoadError] = useState(null);
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
    const opts = { apiKey, signal, cacheMs: DETAILS_CACHE_MS };
    async function load() {
      // The four core lookups are independent: one failing shouldn't blank the page.
      const [dres, vres, rres, cres] = await Promise.allSettled([
        tmdbGet(`/movie/${item.id}?language=en-US`, opts),
        tmdbGet(`/movie/${item.id}/videos?language=en-US`, opts),
        tmdbGet(`/movie/${item.id}/release_dates`, opts),
        tmdbGet(`/movie/${item.id}/credits?language=en-US`, opts),
      ]);
      if (signal.aborted) return;
      const value = (r) => (r.status === "fulfilled" ? r.value : null);
      setLoadError(dres.status === "rejected" && !isAbort(dres.reason) ? dres.reason : null);
      const d = value(dres);
      const v = value(vres);
      const rd = value(rres);
      const c = value(cres);
      if (d) setDetails(d);
      setVideos(v?.results || []);
      setCast((c?.cast || []).slice(0, 10));
      // Extract certification (MPAA) — prefer US, else first non-empty
      const rels = rd?.results || [];
      const us = rels.find((r) => r.iso_3166_1 === "US");
      const pick = (us?.release_dates || []).find((x) => x.certification) ||
        rels.flatMap((r) => r.release_dates || []).find((x) => x.certification);
      setCert(pick?.certification || "");

      // Optional: fetch external ratings via OMDb if omdbKey provided
      if (omdbKey && !externalOff) {
        try {
          const xdata = await tmdbGet(`/movie/${item.id}/external_ids`, opts);
          const imdbId = xdata?.imdb_id;
          if (imdbId && !signal.aborted) {
            const ores = await fetch(`https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(omdbKey)}`, { signal });
            const odata = await ores.json();
            if (odata && odata.Response !== "False") {
              setImdbRating(odata.imdbRating && odata.imdbRating !== "N/A" ? odata.imdbRating : null);
              setImdbVotes(odata.imdbVotes && odata.imdbVotes !== "N/A" ? odata.imdbVotes : null);
              const rt = Array.isArray(odata.Ratings) ? odata.Ratings.find((r) => r.Source === "Rotten Tomatoes") : null;
              setRtScore(rt?.Value || null);
            }
          }
        } catch { /* optional enrichment; ignore failures */ }
      }

      // Optional: DoesTheDogDie counts when key provided (only saved for films you own)
      if (dddKey && !externalOff && localItem && (jumpScares === 0 && goreCount === 0 && disturbCount === 0)) {
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
              onUpdate?.({ ...localItem, jumpScares: js, goreCount: gore, disturbCount: disturb });
            }
          }
        } catch { /* optional enrichment; ignore failures */ }
      }

      // Auto-pull TMDb keywords into tags. Only for films already in your library:
      // upserting here would otherwise add a film just because you looked at it.
      if (localItem) {
        try {
          const kdata = await tmdbGet(`/movie/${item.id}/keywords`, opts);
          const kws = (kdata?.keywords || []).map(k => k.name.toLowerCase().replace(/\s+/g,'-'));
          if (kws.length && !signal.aborted) {
            const existing = (localItem.tags || []);
            const next = Array.from(new Set([ ...existing, ...kws ])).slice(0, 32);
            if (JSON.stringify(existing.slice().sort()) !== JSON.stringify(next.slice().sort())) {
              onUpdate?.({ ...localItem, tags: next });
            }
          }
        } catch { /* optional enrichment; ignore failures */ }
      }
    }
    load();
    return () => controller.abort();
    // Deliberately keyed on the title/keys only: onUpdate/localItem change on every save and would refetch in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, apiKey, omdbKey]);

  // keep counts in sync when switching items
  useEffect(() => {
    setJumpScares(localItem?.jumpScares ?? 0);
    setGoreCount(localItem?.goreCount ?? 0);
    setDisturbCount(localItem?.disturbCount ?? 0);
    // Only resync when switching titles, not on every edit to the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localItem?.id]);


  const poster = item.poster ? TMDB_IMG(item.poster, "w500") : details?.poster_path ? TMDB_IMG(details.poster_path, "w500") : "";
  const backdrop = details?.backdrop_path ? TMDB_IMG(details.backdrop_path, "w780") : "";
  const trailer = videos.find((v) => v.site === "YouTube" && v.type === "Trailer");

  return (
    <div className="space-y-4">
      {loadError ? (
        <div role="alert" className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm">
          {describeError(loadError)} Showing what's saved locally.
        </div>
      ) : null}
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
