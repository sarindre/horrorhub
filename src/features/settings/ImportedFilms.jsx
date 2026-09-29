import { useState } from "react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { useToast } from "../../lib/toastContext.js";
import { describeError, isAbort, mapMovie, TMDB_IMG } from "../../lib/tmdb.js";
import { isImported, isUnmatched, needsMatching, searchTmdb } from "../../lib/tmdbMatch.js";

// Search TMDb by hand for a film the automatic match couldn't place.
function ManualMatch({ film, apiKey, onPick }) {
  const toast = useToast();
  const [query, setQuery] = useState(film.title);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    setBusy(true);
    try {
      setResults((await searchTmdb(query, { apiKey })).map((r) => ({ ...mapMovie(r), raw: r })));
    } catch (err) {
      if (!isAbort(err)) toast(describeError(err), { kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-2 rounded-xl border p-3">
      <div className="flex gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }} aria-label={`Search TMDb for ${film.title}`} />
        <Button size="sm" onClick={search} disabled={busy || !apiKey}>{busy ? "Searching…" : "Search"}</Button>
      </div>
      {results && !results.length ? <div className="text-xs opacity-70">No results. Try fewer words or the original title.</div> : null}
      <ul className="space-y-2">
        {(results || []).map((r) => (
          <li key={r.id} className="flex items-center gap-3">
            {r.poster ? <img src={TMDB_IMG(r.poster, "w92")} alt="" className="h-14 w-10 rounded object-cover" /> : <div className="h-14 w-10 rounded bg-white/10" />}
            <div className="min-w-0 flex-1">
              <div className="text-sm">{r.title} {r.year ? <span className="opacity-60">({r.year})</span> : null}</div>
              <div className="line-clamp-2 text-xs opacity-60">{r.overview}</div>
            </div>
            <Button size="sm" onClick={() => onPick(film, r.raw)}>Use this</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Films imported from Letterboxd/IMDb start without a TMDb id, poster or
// metadata. They're matched automatically in the background; this shows where
// that stands and lets you fix the ones it couldn't place.
export function ImportedFilms({ library, apiKey, autoMatch, onRelink, onRetryAll }) {
  const toast = useToast();
  const [openId, setOpenId] = useState(null);
  const imported = library.filter(isImported);
  const waiting = imported.filter(needsMatching);
  const unmatched = imported.filter(isUnmatched);
  const matched = library.filter((i) => i.tmdbMatchedAt).length;
  if (!imported.length && !matched) return null;

  const pick = (film, movie) => {
    onRelink(film.id, movie);
    setOpenId(null);
    toast(`Linked "${film.title}" to ${movie.title}${movie.release_date ? ` (${movie.release_date.slice(0, 4)})` : ""}.`, { kind: "success" });
  };

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-6 space-y-3">
        <div className="text-lg font-semibold">Imported films</div>
        <div className="text-sm opacity-70">
          Films from Letterboxd or IMDb are matched to TMDb so they get posters, tags, warnings and can seed recommendations. Your ratings, watch dates and notes are kept.
        </div>
        <div className="text-sm">
          {matched} matched · {waiting.length} waiting · {unmatched.length} need a manual match
        </div>
        {!apiKey && waiting.length ? <div className="text-xs opacity-70">Add your TMDb API token above to start matching.</div> : null}
        {apiKey && !autoMatch && waiting.length ? <div className="text-xs opacity-70">Automatic matching is turned off (see Catalog & Content).</div> : null}

        {unmatched.length ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Couldn't match automatically</div>
              <Button size="sm" variant="outline" onClick={onRetryAll}>Retry automatic matching</Button>
            </div>
            <ul className="space-y-2 text-sm">
              {unmatched.map((f) => (
                <li key={f.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span>{f.title}{f.year ? <span className="opacity-60"> ({f.year})</span> : null}</span>
                    <Button size="sm" variant="outline" onClick={() => setOpenId(openId === f.id ? null : f.id)}>
                      {openId === f.id ? "Close" : "Find match"}
                    </Button>
                  </div>
                  {openId === f.id ? <ManualMatch film={f} apiKey={apiKey} onPick={pick} /> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
