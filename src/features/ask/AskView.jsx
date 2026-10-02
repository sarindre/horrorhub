import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircleQuestion, Search } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { MovieCard } from "../../components/MovieCard.jsx";
import { ContentWarnings } from "../../components/ContentWarnings.jsx";
import { WatchlistButton } from "../../components/WatchlistButton.jsx";
import { NeedsToken } from "../../components/NeedsToken.jsx";
import { HiddenNotice } from "../../components/HiddenNotice.jsx";
import { useTasteProfile } from "../../lib/calibrationContext.js";
import { useContentPrefs } from "../../lib/contentContext.js";
import { evaluateContent, filterByContent, hasContentLimits } from "../../lib/contentFlags.js";
import { applyQuery, hasFilters, parseQuery } from "../../lib/query.js";
import { fetchAskIdeas } from "../../lib/askTmdb.js";
import { fetchFilmMeta } from "../../lib/filmMeta.js";
import { inferFlags } from "../../lib/contentFlags.js";
import { describeError, isAbort, TMDB_IMG } from "../../lib/tmdb.js";
import { plural } from "../../lib/text.js";

const EXAMPLES = [
  "Slow-burn folk horror under 100 minutes, no animal harm",
  "Gentle slashers from the 80s I haven't seen",
  "Short and scary, no jump scares",
  "Something atmospheric from my watchlist",
  "Top rated zombie movies",
];
const FIRST = 12;

// Warnings for TMDb films, looked up one by one (remembered for the session), so
// exclusions like "no animal harm" can be checked before a film is shown.
const flagCache = new Map();
function useAskFlags(films, apiKey) {
  const [flags, setFlags] = useState({});
  const [checking, setChecking] = useState(false);
  const key = films.map((f) => f.id).join(",");
  useEffect(() => {
    if (!key || !apiKey) {
      setChecking(false);
      return;
    }
    const controller = new AbortController();
    const todo = films.filter((f) => !flagCache.has(f.id));
    const build = () => Object.fromEntries(films.map((f) => [f.id, flagCache.get(f.id)]));
    setFlags(build());
    if (!todo.length) {
      setChecking(false);
      return;
    }
    setChecking(true);
    Promise.all(
      todo.map((f) =>
        fetchFilmMeta(f.id, { apiKey, signal: controller.signal })
          .then((meta) => flagCache.set(f.id, inferFlags(meta)))
          .catch((err) => {
            if (!isAbort(err)) flagCache.set(f.id, null); // couldn't check: treated as unknown
          })
      )
    ).then(() => {
      if (controller.signal.aborted) return;
      setFlags(build());
      setChecking(false);
    });
    return () => controller.abort();
    // `films` is represented by its id list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, apiKey]);
  return { flags, checking };
}

// Films from TMDb, with the question's exclusions and your own limits applied once
// their warnings are known. A film whose warnings couldn't be checked is not shown
// when you asked to avoid something, rather than risk it.
function TmdbResults({ films, apiKey, filters, library, onOpenDetails, onAdd, hasMore, onMore, loadingMore, moreError }) {
  const prefs = useContentPrefs();
  const { flags, checking } = useAskFlags(films, apiKey);
  const [revealed, setRevealed] = useState(false);
  const mustCheck = filters.excludeFlags.length > 0;

  const shown = [];
  let hidden = 0;
  let excluded = 0;
  for (const m of films) {
    const f = flags[m.id];
    if (mustCheck && (f === undefined || f === null)) { if (!checking) excluded++; continue; } // not known yet, or couldn't be checked
    if (f && f.some((id) => filters.excludeFlags.includes(id))) { excluded++; continue; }
    if (prefs.contentMode === "hide" && !revealed && hasContentLimits(prefs) && f && evaluateContent({ flags: f }, prefs).blocked) {
      hidden++;
      continue;
    }
    shown.push(m);
  }

  return (
    <div className="space-y-2">
      {checking && mustCheck ? <div role="status" className="text-sm opacity-70">Checking content warnings…</div> : null}
      <HiddenNotice count={hidden} onReveal={() => setRevealed(true)} />
      <ul className="space-y-2">
        {shown.map((m) => (
          <li key={m.id} className="flex items-center gap-3">
            {m.poster ? <img src={TMDB_IMG(m.poster, "w92")} alt="" className="h-14 w-10 shrink-0 rounded object-cover" /> : <div aria-hidden="true" className="h-14 w-10 shrink-0 rounded bg-white/5" />}
            <div className="min-w-0 flex-1">
              <button type="button" className="block max-w-full truncate text-left text-sm font-medium hover:underline" onClick={() => onOpenDetails?.(m)}>{m.title}</button>
              <div className="text-xs opacity-60">{[m.year, m.voteAvg ? `TMDb ${m.voteAvg.toFixed(1)}` : ""].filter(Boolean).join(" · ")}</div>
              <ContentWarnings flags={flags[m.id] || []} avoid={prefs.avoidFlags} showFlags={prefs.showWarnings} />
            </div>
            <WatchlistButton film={m} owned={library.find((i) => String(i.id) === String(m.id))} onAdd={onAdd} />
          </li>
        ))}
      </ul>
      {shown.length || hasMore ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="opacity-70">
            Showing {shown.length} of {films.length} found
            {excluded ? ` (${excluded} left out: they have something you asked to avoid, or their warnings couldn't be checked)` : ""}.
            {!hasMore ? " That's everything TMDb has for this." : ""}
          </span>
          {hasMore ? <Button variant="outline" onClick={onMore} disabled={loadingMore}>{loadingMore ? "Loading…" : "Show more films"}</Button> : null}
        </div>
      ) : null}
      {moreError ? <div role="alert" className="text-sm text-red-300">{moreError}</div> : null}
      {!checking && !shown.length ? <div className="text-sm opacity-70">{mustCheck ? "Nothing on TMDb passed your exclusions (films whose warnings couldn't be checked are left out)." : "Nothing to show."}</div> : null}
    </div>
  );
}

// Ask in your own words: "slow-burn folk horror under 100 minutes, no animal harm".
// It understands a fixed set of words, shows what it understood and what it ignored,
// searches your library, and can look on TMDb too. Nothing leaves your device until you
// press the TMDb button, and then only the length, years and subgenre keywords go.
export function AskView({ library, apiKey, region = "US", onOpenDetails, onAdd, onUpdate }) {
  const prefs = useContentPrefs();
  const profile = useTasteProfile(library);
  const [text, setText] = useState("");
  const [asked, setAsked] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [tmdb, setTmdb] = useState({ status: "idle", films: [], note: "", error: "", page: 1, totalPages: 1, loadingMore: false, moreError: "" });
  const abortRef = useRef(null);

  const parsed = useMemo(() => parseQuery(asked), [asked]);
  const understood = hasFilters(parsed.filters);
  const found = useMemo(() => (asked ? applyQuery(library, parsed.filters, { profile }) : null), [asked, library, parsed, profile]);

  const limited = found && prefs.contentMode === "hide" && !revealed ? filterByContent(found.results.map((r) => r.item), prefs) : null;
  const results = found ? (limited ? found.results.filter((r) => !limited.hidden.includes(r.item)) : found.results) : [];
  const hiddenByLimits = found ? found.results.length - results.length : 0;
  const shown = showAll ? results : results.slice(0, FIRST);
  const leftOut = found ? Object.entries(found.leftOut) : [];
  // filters that only make sense for films you own, so TMDb results can't honour them
  const f = parsed.filters;
  const unappliedOnTmdb = [
    f.scareMin !== undefined || f.scareMax !== undefined ? "how scary" : "",
    f.ratingMin !== undefined || f.ratingMax !== undefined ? "your ratings" : "",
    f.watched !== undefined || f.watchlist ? "what you've watched" : "",
  ].filter(Boolean);

  const ask = (question) => {
    const q = (question ?? text).trim();
    if (!q) return;
    abortRef.current?.abort();
    setText(q);
    setAsked(q);
    setShowAll(false);
    setRevealed(false);
    setTmdb({ status: "idle", films: [], note: "", error: "", page: 1, totalPages: 1, loadingMore: false, moreError: "" });
  };

  const searchTmdb = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setTmdb({ status: "loading", films: [], note: "", error: "", page: 1, totalPages: 1, loadingMore: false, moreError: "" });
    try {
      const r = await fetchAskIdeas(parsed.filters, { apiKey, signal: controller.signal, library, region });
      setTmdb({ status: "done", films: r.films, note: r.note, error: "", page: r.page, totalPages: r.totalPages, loadingMore: false, moreError: "" });
    } catch (err) {
      if (!isAbort(err)) setTmdb({ status: "error", films: [], note: "", error: describeError(err), page: 1, totalPages: 1, loadingMore: false, moreError: "" });
    }
  };

  // The next page of the same question, added below. Films already shown aren't repeated.
  const loadMoreTmdb = async () => {
    if (tmdb.loadingMore || tmdb.page >= tmdb.totalPages) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setTmdb((t) => ({ ...t, loadingMore: true, moreError: "" }));
    try {
      const r = await fetchAskIdeas(parsed.filters, { apiKey, signal: controller.signal, library, region, page: tmdb.page + 1 });
      setTmdb((t) => {
        const seen = new Set(t.films.map((m) => m.id));
        return { ...t, films: [...t.films, ...r.films.filter((m) => !seen.has(m.id))], page: r.page, totalPages: r.totalPages, loadingMore: false };
      });
    } catch (err) {
      if (!isAbort(err)) setTmdb((t) => ({ ...t, loadingMore: false, moreError: describeError(err) }));
    }
  };
  useEffect(() => () => abortRef.current?.abort(), []);

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-3 sm:px-4 md:px-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold"><MessageCircleQuestion className="h-5 w-5" /> Ask HorrorHub</h2>
        <p className="text-sm opacity-70">Say what you're in the mood for: a subgenre, a length, a decade, how scary, or what to avoid.</p>
      </div>

      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <Input className="min-w-[14rem] flex-1" aria-label="Ask HorrorHub" placeholder="e.g. slow-burn folk horror under 100 minutes, no animal harm" value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="submit"><Search className="mr-1 h-4 w-4" /> Ask</Button>
      </form>

      {!asked ? (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide opacity-70">Try</div>
          <ul className="flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <li key={e}><Button size="sm" variant="outline" className="h-auto whitespace-normal text-left" onClick={() => ask(e)}>{e}</Button></li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <Card className="rounded-2xl">
            <CardContent className="space-y-2 p-4">
              {understood ? (
                <>
                  <div className="text-xs uppercase tracking-wide opacity-70">I understood</div>
                  <ul aria-label="What I understood" className="flex flex-wrap gap-2">
                    {parsed.understood.map((c) => (
                      <li key={c.id} className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-sm">{c.label}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="text-sm">I couldn't pick out anything to filter by. Try a subgenre (slasher, folk horror), a length (under 90 minutes), a decade (from the 80s), how scary (gentle, terrifying) or something to avoid (no gore).</div>
              )}
              {parsed.ignored.length ? <div className="text-xs opacity-70">I didn't use: {parsed.ignored.join(", ")}</div> : null}
            </CardContent>
          </Card>

          <section aria-label="From your library" className="space-y-3">
            <div className="text-sm uppercase tracking-wide opacity-80">
              From your library · {plural(results.length, "film")}
            </div>
            <HiddenNotice count={hiddenByLimits} onReveal={() => setRevealed(true)} />
            {shown.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {shown.map(({ item, reasons, notes }) => (
                  <div key={item.id} className="min-w-0 space-y-1">
                    <MovieCard item={item} onUpdate={onUpdate} compact onOpenDetails={onOpenDetails} />
                    <div className="px-1 text-xs opacity-60">{[...reasons, ...notes].join(" · ")}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm opacity-70">{library.length ? "Nothing in your library fits that." : "Your library is empty. Add some films, or look on TMDb below."}</div>
            )}
            {results.length > FIRST ? <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer" : `Show all ${results.length}`}</Button> : null}
            {leftOut.length ? (
              <div className="text-xs opacity-60">Left out: {leftOut.map(([why, n]) => `${plural(n, "film")} that ${why}`).join("; ")}.</div>
            ) : null}
            {understood && (parsed.filters.excludeFlags.length || parsed.filters.excludeTags.length) ? (
              <div className="text-xs opacity-60">Warnings come from TMDb keywords, so a film that isn't flagged isn't guaranteed to be free of it.</div>
            ) : null}
          </section>

          <section aria-label="From TMDb" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm uppercase tracking-wide opacity-80">Films you don't have yet</div>
              <Button size="sm" variant="outline" onClick={searchTmdb} disabled={!apiKey || tmdb.status === "loading" || !understood}>
                {tmdb.status === "loading" ? "Searching…" : "Also look on TMDb"}
              </Button>
            </div>
            {!apiKey ? <NeedsToken>Looking beyond your library needs a free TMDb token.</NeedsToken> : null}
            {apiKey && tmdb.status === "idle" ? (
              <div className="text-xs opacity-60">Sends only the length, years and subgenre keywords to TMDb. Scare level, rating and watched-or-not filters apply to your library only.</div>
            ) : null}
            {tmdb.status === "error" ? <div role="alert" className="text-sm text-red-300">{tmdb.error}</div> : null}
            {tmdb.status === "done" && unappliedOnTmdb.length ? (
              <div role="note" className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
                These weren't filtered by {unappliedOnTmdb.join(", ")}: TMDb doesn't have that information, so it only applies to your own library. Check a film's page before you pick.
              </div>
            ) : null}
            {tmdb.status === "done" && tmdb.films.length ? <TmdbResults films={tmdb.films} apiKey={apiKey} filters={parsed.filters} library={library} onOpenDetails={onOpenDetails} onAdd={onAdd} hasMore={tmdb.page < tmdb.totalPages} onMore={loadMoreTmdb} loadingMore={tmdb.loadingMore} moreError={tmdb.moreError} /> : null}
            {tmdb.status === "done" && !tmdb.films.length ? (
              <div className="flex flex-wrap items-center gap-3 text-sm opacity-90">
                <span className="opacity-70">{tmdb.note}</span>
                {tmdb.page < tmdb.totalPages ? <Button variant="outline" onClick={loadMoreTmdb} disabled={tmdb.loadingMore}>{tmdb.loadingMore ? "Loading…" : "Try the next page"}</Button> : null}
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
