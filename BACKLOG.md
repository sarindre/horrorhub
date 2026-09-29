# HorrorHub Refresh Backlog

## Goal
Transform HorrorHub from a solid horror movie tracker into a more compelling, personalized horror discovery and planning app.

## Priority overview
- P0: Retain the current value of library management and import/export
- P1: Improve recommendation quality and horror-specific personalization
- P1: Add watch planning and themed marathon experiences
- P1: Add catalog intelligence for tags and filtering
- P2: Add retention features like seasonal challenges and streaks
- P2: Explore social-like curation without building a full social network

## Backlog items

### 1. Mood-based horror matching
Status: Done
Priority: P1

Create a feature that lets users discover horror based on emotional vibe and intensity rather than just title or genre.

Examples:
- atmospheric and slow-burn
- slasher energy
- shambling creature terror
- found-footage dread
- high-gore body horror
- bleak cosmic horror

Acceptance criteria:
- Users can filter by horror mood or intensity
- Recommendations align to watch vibe, not just metadata
- Mood choices are reflected in the library and suggestions UI

Implementation notes:
- Added a visible mood preset selector in the library and recommendations UI
- Library filtering now supports matching a selected horror vibe against tags
- Recommendation scoring boosts titles that match the chosen preset
- Added a Creature Feature preset and narrowed Body Horror to gore/body-horror/disturbing/sci-horror tags
- Added a "Max scares" intensity slider to the library filters (titles with no scare score stay visible)
- Mood-based picks heading now shows the active vibe and scare level
- The TMDb suggestions are now mood-aware too (keyword boost on the film's title/overview, see #9), and moods are learned from your library and explained (see #2). With #4 the tags the presets match against are now filled in automatically

### 2. Smart recommendation engine
Status: Done (v1: local and heuristic; see follow-ups)
Priority: P1

Expand the current hybrid recommendation approach into a more robust taste engine that learns from the user's horror preferences.

Implementation notes (`lib/taste.js`, `lib/recommend.js`, `RecommendationsView`):
- A taste profile is built from your library: per-tag and per-mood affinity from ratings (a 5★ is +1, 3★ neutral, 1★ −1; an unrated watch is a mild positive; a saved-only film counts for nothing), weighted a little toward recent watches, shrunk toward zero until there's enough evidence, plus the scare level of the films you enjoy
- Your own library is ranked for tonight from that profile plus the scare slider, night vibe, subgenre mixer and watchlist. Watched and unreleased films are suppressed and duplicates dropped
- The TMDb list picks seeds by rating, recency and tag match, spread across subgenres, then leans toward the moods your favorites share. A film you logged via Letterboxd/IMDb import now counts as seen (matched by title + year), where before only an id match did
- Every pick shows why ("You tend to enjoy #folk-horror", "Because you liked X and 2 other favorites", "Leans Occult, like your favorites", "Matches your Slasher vibe", "On your watchlist"), and a "Your taste" card shows what was learned, how many films it's based on, and a "still learning" hint until there are about 8 (with a button to match your usual scare level)

Acceptance criteria:
- ✅ Similar titles are generated using the user's watched + rated library
- ✅ Recommendations improve over time as more data is added (confidence grows with evidence; covered by tests that add data and compare)
- ✅ The app explains why a suggestion is being made

Follow-ups:
- Taste is learned from your tags only. Auto-tags come from TMDb keywords, so they're a bit noisy (e.g. "based-on-novel"); a curated tag vocabulary (see #4) would sharpen it
- No negative signal from "not interested"/dismissed picks yet; add a dismiss action and feed it into the profile
- The TMDb side matches taste through overview keywords, not real tags. Fetching TMDb keywords per candidate would be more accurate but costs extra requests
- Scoring weights are hand-tuned constants. Once there's real usage data, revisit them (they're all in `taste.js` / `recommend.js` and tested)

### 3. Horror-specific watch planning
Status: Done (v1; see follow-ups)
Priority: P1

Add planning tools that help users build watch sessions and movie marathons.

Ideas:
- “Tonight’s watch” lane
- themed marathons by subgenre
- scare-level progression across a lineup
- runtime balancing
- seasonal watch recommendations

Acceptance criteria:
- Users can generate a curated watch sequence from library or recommendations
- Suggestions maintain pacing, mood, and intensity flow
- A watch plan can be exported or saved locally

Implementation notes (`lib/marathon.js`, `features/watchlist/MarathonPlanner.jsx`):
- A Marathon planner on the Watchlist tab builds a lineup for one night from your watchlist or whole library: pick a theme (any mood preset, plus seasonal ones like "Halloween night" and "Holiday horror" when in season), how many films (2-5) and how much time you have (3-8 hours). It picks the best taste fits that fit the time budget (with a 15-minute break between films), prefers unwatched films, skips unreleased ones and anything over your content limits, and stops one very long film from crowding out the rest
- Pacing: choose Build up, Peak then wind down (the scariest film lands about 70% of the way through, then it eases off) or Ebb and flow. Each lineup gets a plain-English read on how it flows, and each film shows its start/end time, runtime, scare level, why it was picked and any content warnings
- Shuffle for a different lineup; save plans locally (named, with a snapshot of each film); download any plan as a calendar file with a real start and end time per film; "Add all to watchlist" when planning from the library. Saved plans are included in JSON export and import
- Earlier steps (from #5 and #6): the weekly plan is built by a tested `buildWeeklyPlan` and previews its schedule with warnings; challenges generate short watch lists

Follow-ups:
- Runtime and scare level come from your own data. Films without a stored runtime are assumed to be 100 minutes (marked "est."), and unscored films count as 5/10, so pacing is only as good as your scare ratings (the planner says so when a lineup is flat)
- Planning from TMDb suggestions (films you don't own yet) isn't supported: they have no runtime or scare rating. Add them to your library or watchlist first
- Saved plans can't be edited or reordered by hand yet; rebuild and save again
- Scheduling is one night at a time; a multi-night "marathon week" would build on the weekly plan

### 4. Auto-tagging and catalog intelligence
Status: Done (v1: rule-based; see follow-ups)
Priority: P1

Use movie metadata, user notes, and behavior to automatically infer tags instead of requiring manual entry for every movie.

Implementation notes (`lib/tagging.js`, `lib/filmMeta.js`, `hooks/useAutoTagger.js`):
- One TMDb request per film (`append_to_response=keywords`) gives genres, runtime, overview and keywords. A rule table maps them onto the curated vocabulary (slasher, found-footage, folk-horror, body-horror, haunted, occult, creature, cosmic, sci-horror, gore, campy, classic, ...). Matching is whole-word so "cult" never fires on "cultural"; results are capped at 6 tags per film, strongest evidence first
- New films get starter tags from what's known when they're added (overview + year); a background tagger then enriches every untagged library film from TMDb, one at a time, pausing with a message on a bad token, rate limit or no connection. It also backfills existing libraries. It can be switched off in Settings, and "Re-tag my whole library" reruns it
- Your edits always win: inferred tags are marked ✦, a tag you remove is remembered and never re-added, tags you typed are never touched, and the same tag has one spelling ("Folk Horror" and "#folk_horror" become `folk-horror`)
- The raw TMDb keywords are kept on the film for search only, instead of flooding your tags (the old behaviour copied up to 32 of them into tags). An opt-in "Clean up old keyword tags" moves the leftovers from that era out of your tags
- Library filtering: pick several tags at once (films must have all of them), see a count on each tag, filter to "Untagged", and search matches TMDb keywords too

Acceptance criteria:
- ✅ New titles are automatically assigned useful tags when metadata supports it
- ✅ Users can still refine or remove tags manually
- ✅ The tag system supports better searches and filtering

Follow-ups:
- The rules are hand-written for English TMDb metadata. Expect misses and the odd wrong tag; the rule table in `tagging.js` is the place to tune (it's covered by tests)
- Only what TMDb knows about a film is used. User notes aren't mined for tags yet
- `aliases` such as ghost → haunted are deliberately few. Grow them as real tag collisions show up
- Background tagging makes one request per untagged film, about 5 a second. A 500-film library takes a couple of minutes on first run. Consider batching or a manual "tag now" mode

### 5. Content warnings and trigger filters
Status: Done (v1: warnings are inferred and best-effort; see follow-ups)
Priority: P1

Add safer discovery controls for horror content to make the app feel thoughtful and user-friendly.

Implementation notes (`lib/contentFlags.js`, `hooks/useContentGate.js`, `components/ContentWarnings.jsx`):
- Eight categories inferred from TMDb keywords and a few unambiguous overview phrases (graphic gore, body horror, torture, animal harm, sexual violence, harm to children, suicide/self-harm, extreme violence), plus disturbing content and frequent jump scares from DoesTheDogDie counts when you use that key. Flags name a category, never a plot point, so they warn without spoiling
- Warnings appear on every film card (Discover, Rating Roulette, suggestions, library, watchlist), on the details page (editable for films you own, with a "Refresh from TMDb" action), and next to each film in the weekly plan
- Settings → Catalog & Content: show warnings on/off, pick the categories you want to avoid (shown in red), set a scare-level limit against your own ratings, and choose "Warn me" or "Hide them" for films over your limits. In hide mode a notice says how many are hidden, with a "Show anyway" button
- Planning: the weekly plan now previews its schedule with each film's warnings before you download it. If planned films trip your limits you're asked whether to keep or drop them (hide mode drops them). "Tonight's pick" respects the same limits
- Generated challenge lists always leave out films over your limits

Acceptance criteria:
- ✅ Users can filter out titles that exceed preferred intensity limits
- ✅ Content warnings are visible before a title is added to a plan
- ✅ Filters reduce surprise and improve trust

Follow-ups:
- Inference is keyword-based, so an absent warning means "nothing found in TMDb's data", not "safe". The UI says so, but community sources (DoesTheDogDie topics per film) would be far more reliable. The `dddKey` integration only supplies counts today
- The scare limit uses your own scare ratings; unscored library films default to 5, so a low limit can catch them. Discover results have no scare rating, so only the category flags apply there
- Looking up warnings for a page of Discover results costs one request per film (cached for the session)
- No per-film "I'm okay with this one" override yet

### 6. Seasonal and challenge-based discovery
Status: Done (v1; see follow-ups)
Priority: P2

Introduce challenge loops and themed discovery streaks that keep the app engaging over time.

Implementation notes (`lib/challenges.js`, `hooks/useChallenges.js`, `features/challenges/`):
- A new Challenges tab with eight templates: 30 Days of Horror, 31 Nights of Halloween, Cult Classic Month, Found-Footage Week, Late-Night Creature Feature, Summer Slashers, Holiday Horror and a Friday the 13th Marathon. Seasonal ones are surfaced "in season" (Halloween from September, Friday the 13th within two weeks, and so on) and use their calendar window
- Progress is derived from your watch dates, never stored separately, so logging a watch anywhere moves every challenge. Daily challenges track distinct days with a day-by-day strip and current/best streak; count challenges track distinct matching films (by tag, year, keyword and runtime). Each shows pace ("about 1 every 3 days") and days left, and completing one fires a toast once
- "Build my watch list" picks unwatched films from your library that count toward the challenge, ranked by your taste profile, sized to what's left, respecting your content limits, with one-click "Add all to watchlist". "Find ideas on TMDb" suggests well-known films that fit and that you don't own yet
- A running watch streak is shown at the top. Challenges are saved locally (`horrorhub.challenges.v1`) and included in JSON export/import

Acceptance criteria:
- ✅ Challenges are tied to user library or discovered titles
- ✅ Users can track completion and streak progress
- ✅ A challenge can generate a short watch list automatically

Follow-ups:
- Days are local calendar days. A Letterboxd/IMDb import stores dates at UTC midnight, which can land on the previous day in timezones west of UTC
- Count challenges match on your tags and stored keywords, so films that haven't been auto-tagged yet don't count until they are
- No custom challenges (pick your own rules and dates) yet, and challenges aren't shared or synced anywhere
- The tab bar now has nine tabs; see #13

### 7. Curation layer without full social networking
Status: Planned
Priority: P2

Add lightweight social-style curation features without turning the app into a full social network.

Ideas:
- “Top picks for your horror mood”
- user-curated shelves
- recommended by subgenre
- shared watchlist themes

Acceptance criteria:
- Users can organize films into personal collections or shelves
- The app surfaces curated collections in a clean UI
- No heavy backend or account system is required for the first version

## Technical refresh backlog
Source: the full code review of 2026-09-28. Steps 1 and 2 of the review (safety net + data layer) are done; see the CHANGELOG. The items below are what remains, in suggested order.

### 8. Split App.jsx into feature folders
Status: Done (one follow-up left)
Priority: P0 (unblocks everything else)

`src/App.jsx` was ~3,000 lines holding about 20 components, the TMDb calls, audio and overlays. It is now ~250 lines (root component, tabs, settings wiring) with the rest in `features/` (discover, library, watchlist, recs, stats, details, settings), `components/` (MovieCard, StarRating, TagEditor, ShimmerImage, KnifeIcon, overlays), `hooks/useLibrary.js` and `lib/` (tmdb, dates, settings). Moves only, no behavior change. The unused `ContinuityNavigator` component was dropped.

Acceptance criteria:
- ✅ `App.jsx` only wires tabs, settings and the library
- ✅ Every extracted view is smoke-rendered in `features/views.test.jsx`, plus the app render in `App.test.jsx`
- ⬜ No file over ~400 lines: `MovieCard.jsx` is still ~485 (it holds both the compact and full card layouts). Split it into `CompactCard` / `FullCard` plus shared actions. `MovieDetails.jsx` (~395) and `StatsView.jsx` (~305) are fine but next in line.

### 9. Fix the recommendation hook (pairs with #2)
Status: Done (tag-based seeding left for #2)
Priority: P1

The hook used TMDb `/similar` (not horror-filtered), refetched on every library edit, seeded from the first 3 titles rated 4+, and ignored moods. It also returned full poster URLs that `MovieCard` prefixed again, so those posters never loaded. Rewritten around `lib/recommend.js`.

Acceptance criteria:
- ✅ Only released horror titles (genre 27) that aren't already in your library
- ✅ Fetches depend on the seed titles, not the whole library; per-seed results are cached for 24h (survives reloads)
- ✅ Seeds are up to 5 titles rated 4+ (falling back to 3+), weighted by rating plus a recency bonus; a film suggested by several seeds ranks higher
- ✅ The active mood preset applies to TMDb picks: films whose title/overview hit the preset's keywords are boosted (a heuristic, nothing is hidden)
- ✅ Loading, error (bad token / rate limit / offline), empty and no-token states; requests abort on unmount; one failing seed doesn't hide the rest
- ✅ "Because you liked X" shown under each pick
- ✅ Tags now influence which titles seed the list (taste profile from #2, with seeds spread across subgenres)
- ⬜ Mood matching for unowned films is keyword-based on TMDb overviews; a TMDb-keywords lookup per candidate would be more accurate (extra requests, so weigh it against rate limits).

### 10. Shared TMDb client and error handling
Status: Done (one lint warning moved to #11)
Priority: P1

Fetch calls were scattered through the code with no `res.ok` check, no error state and no request cancellation, so a bad API key or a rate limit just showed nothing and slow responses could land out of order.

Acceptance criteria:
- ✅ One `lib/tmdb.js` client: auth header, `res.ok`, typed errors (`auth` / `rate-limit` / `network` / `http`), abort support, opt-in in-memory response cache, shared `mapMovie` / `parseProviders`. Discover, Rating Roulette, Continuity, Movie Details and Cold Night Roulette all use it. OMDb and DoesTheDogDie stay as direct calls (different APIs, best-effort enrichment)
- ✅ Visible error states with Retry (Discover, Rating Roulette), inline messages (Recommendations, Continuity, Details) and "add your TMDb token" prompts when no key is set
- ✅ `alert()` replaced by non-blocking toasts (`ToastProvider` / `useToast`). The import preview still uses a confirm dialog on purpose
- ✅ Superseded requests are cancelled (no more stale results overwriting newer ones); provider lookups moved to a `useProviders` hook
- ✅ Fetch-related `exhaustive-deps` warnings cleared; two intentional ones are annotated with the reason
- ⬜ 1 lint warning left: `Settings` calls `onChange` from an effect. It goes away with the Settings rewrite in #11

### 11. Settings cleanup
Status: Done (light theme needs a visual pass)
Priority: P1

Settings mirrored ~20 pieces of state into local state and pushed them up with one large effect. The `theme` choice was saved but never applied, the "Spooky header font" setting never worked (the Tailwind v4 build never loaded `tailwind.config.js`), the "October theme" toggle did nothing, and other UI preferences used ad hoc `horrorhub.*` keys with no schema version.

Acceptance criteria:
- ✅ Single source of truth: `useSettings()` holds one validated settings object, `Settings` is a controlled view, no mirrored state or sync effect. Schema is versioned (`horrorhub.settings.v2`, defaults in one place, values clamped/trimmed) with automatic migration from v1 (the v1 key is kept as a backup)
- ✅ `theme` really switches dark / light / system (`useTheme` + an inline script in `index.html` so there's no flash). Default stays dark. `Button` outline/ghost variants are now theme-aware; other primitives already had `dark:` variants
- ✅ API key fields are masked with a Show/Hide toggle; the Connections card and README state that keys live only in this browser
- ✅ Discover/Roulette filter preferences consolidated into one versioned object (`horrorhub.prefs.v1`), adopting the old per-key values on first read
- ✅ `npm run lint` is fully clean (the last `exhaustive-deps` warning went with the sync effect)
- ✅ Fixed along the way: spooky font now builds (font defined in CSS; dead `tailwind.config.js` and unused `tailwindcss-animate` removed), number fields no longer snap to the minimum while typing, planDays default is the same everywhere
- ✅ Removed the dead "October theme" toggle (nothing consumed it). A real seasonal theme belongs with #6
- ⬜ Visually QA the Light theme across every screen. Only the primitives were made theme-aware, and I haven't been able to look at it in a browser. Other one-off spots with hard-coded white/black text may still need `dark:` variants (see #15)

### 12. Subgenre Mixer sliders don't update picks live
Status: Done
Priority: P1

The Mixer on the Recommendations tab mutated the `mixer` object directly, which doesn't trigger a re-render. The sliders are now controlled from settings (`onMixerChange` → `updateSettings`), so they update the picks live and stay in sync with the Settings page.

### 13. Tab consolidation and responsive layout
Status: Planned
Priority: P2

There are now nine tabs (Challenges was added). The tab bar wraps to 3/5/9 columns by screen width as a stopgap, but Rating Roulette, Because You Liked… and Recommendations still overlap in purpose. Merge or regroup them (Challenges could sit with planning) and make the tab bar scroll or collapse on small screens.

### 14. Performance and motion
Status: Done
Priority: P2

The build was a single 790 kB bundle (250 kB gzipped) and the ambient effects ignored `prefers-reduced-motion`.

Results and implementation notes:
- Initial JavaScript is now 337 kB (104 kB gzipped), down 58%. Stats (which carries the Recharts charting library, 316 kB) plus Movie Details, Challenges, Because You Liked… and Rating Roulette load on demand behind a loading state; everything except Stats is prefetched while the browser is idle, so switching tabs stays instant. Only the lazy content suspends, so the Back button on a film's details never disappears while it loads
- Dropped the `framer-motion` dependency: it was only used for a 6px fade-in on Discover results, now a CSS animation
- Reduced motion: when the device asks for it, the flicker and fog overlays aren't mounted at all (not just hidden, so no timers or scroll listeners run), the candle and result fade animations stop, and Settings says why the switches aren't doing anything. It follows the setting live
- The flicker overlay now updates at most once per frame while scrolling instead of on every scroll event
- Poster images are lazy-loaded and decoded off the main thread
- The library renders 48 cards at a time with "Show more" (resetting when a filter changes), so a library of hundreds no longer mounts hundreds of cards at once

Follow-ups:
- The library grid pages rather than virtualizes; a windowing library would keep memory flat for very large libraries but adds a dependency
- Watchlist, Discover and Recommendations grids are small enough not to need paging; revisit if that changes
- Images have no fixed width/height yet, so the page can still shift slightly as posters load
- The heavy work in the taste engine and auto-tagger runs on the main thread; a Web Worker would help for very large libraries
- Ambient audio isn't tied to reduced motion (it's an explicit opt-in)

### 15. UI primitives cleanup
Status: Planned
Priority: P2

`components/ui/*` are hand-rolled stubs (a native date input as "Calendar", a Dialog that ignores `asChild`), while the Radix packages in `package.json` go largely unused. Either adopt the real shadcn/Radix components or drop the unused dependencies.

### 16. Enrich imported titles with TMDb metadata
Status: Done (see follow-ups)
Priority: P1

CSV imports created films with text ids like `letterboxd:Title:Year` and no poster, overview or TMDb id, so they couldn't be tagged, warned about, or used to seed recommendations.

Implementation notes (`lib/tmdbMatch.js`, `hooks/useImportMatcher.js`, `features/settings/ImportedFilms.jsx`):
- After an import, a background matcher links each film to TMDb, one at a time (about 4 a second, only with a TMDb token, switchable in Settings). IMDb ids resolve exactly through TMDb's `/find`. Letterboxd rows are searched by title and year, relaxing the year filter step by step
- Matching is deliberately strict, since a wrong match would attach someone else's poster and tags: the title must match exactly (ignoring case and punctuation) and the release year must be within one; with no year, only a single unambiguous title match is accepted
- A match swaps in the real TMDb id, poster, overview and release date while keeping everything you entered (rating, watch dates, tags, notes). If you already have that TMDb film (say from Discover), the two are merged: tags and watch dates combined, the imported rating filling a blank, and it stays on your watchlist. Nothing is lost
- Newly linked films are then picked up by auto-tagging, content warnings, taste profile and recommendation seeding like any other film
- Films that couldn't be placed are marked as tried (so they aren't retried every session) and listed in Settings → Imported films, where you can search TMDb by hand and link the right one, or retry automatic matching. A completion toast reports "Matched N of M"

Acceptance criteria:
- ✅ Imported films get TMDb ids, posters and details
- ✅ They then get tags and warnings and feed recommendations
- ✅ They dedupe against films you already have from Discover

Follow-ups:
- Imports still create the text-id film first and match afterwards. Matching during the import (with a progress bar) would avoid the interim state, but blocks on many network calls
- Foreign-language titles rely on TMDb's original-title field; an obscure or mistitled film needs the manual match
- A manual match doesn't check the year, so you can link any film; it's your call by design

### 17. Copy and onboarding cleanup
Status: Done
Priority: P2

Removed the leftover scaffolding text ("MVP • Local first", the static "How to use" block and its "later you can sync to Supabase" aside) and replaced it with a real first-run experience.

Implementation notes (`lib/onboarding.js`, `components/GettingStarted.jsx`):
- A "Welcome to HorrorHub" checklist: add your TMDb token (with plain instructions for where to find it), add some films (Discover, or import from Letterboxd/IMDb), rate 3 films so it can learn your taste, and optionally set comfort limits. Each unfinished step has a button that jumps to the right tab, the next step is highlighted, steps tick off as they're completed, and the card disappears once everything is done or you hide it (remembered)
- To make that possible `Tabs` can now be controlled (uncontrolled use still works) and has proper `tab`/`tablist`/`tabpanel` roles. Clicking any tab now also leaves a film's details page; before, the details stayed on screen
- Empty states: an empty library says how to fill it; filters that match nothing say so
- Header copy tightened, a short footer about backups replaces the how-to block, and the browser tab gets a proper title and icon instead of the Vite default

Follow-ups:
- No sample library to explore without a token, by design (local-first, no fake data); a demo mode could be considered
- The checklist doesn't yet detect whether the DoesTheDogDie/OMDb keys (optional) are set

### 18. Test coverage for scoring and UI logic
Status: Planned
Priority: P2

Progress: 231 tests. The pure logic in `lib/*` (recommendation scoring, taste, tagging, content flags, challenges, planning, matching, storage, settings) is covered, every view is smoke-rendered, and the background hooks (`useAutoTagger`, `useImportMatcher`) are tested running for real in jsdom against a stubbed TMDb, which caught restart-on-every-render and dropped-completion bugs. The whole app now also has real click-through tests in jsdom (`App.interaction.test.jsx`: first-run checklist, tab switching, library tag filters, settings persistence). Still open: interaction tests for Discover/Details/Challenges/Planner flows, tests for `useChallenges`/`useMarathons`/`useContentGate`/`useProviders`, and a coverage report in CI.

## Notes
The product should feel like a personal horror curator, not just a database. The strongest differentiator is a recommendation system that understands horror taste, mood, and watch planning.
