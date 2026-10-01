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
Status: Done (v1: file and text sharing; see follow-ups)
Priority: P2

Implementation notes (`lib/shelves.js`, `hooks/useShelves.js`, `features/shelves/`, `components/AddToShelfDialog.jsx`):
- **Shelves:** a new Shelves view under My Library. Make named, described, ordered lists of films ("Halloween marathon", "Comfort horror", "Films to show a friend"); reorder them, rename them, add films from your library or by searching TMDb (so a shelf can hold films you don't own yet, with one-click "Add to library" / "Watchlist" for those), add a whole shelf to your watchlist, and see each film's rating, watched status and content warnings. A "Shelves" button on every film's page files it on one or more shelves and shows how many it's on
- **Curated for you:** collections HorrorHub builds from your taste profile and library, never stored, and always within your content limits: "Top picks for your <mood> mood" (unwatched films that fit the mood you love most, with reasons), "Your best <subgenre>" for up to three subgenres you clearly love, and "Time for a rewatch" (favorites you haven't seen in over a year). Each can be saved as an editable shelf or sent to the watchlist in one click
- **Sharing without accounts or servers:** export a shelf as a small JSON file or copy it as a plain-text list; import a friend's shelf file (imports never replace an existing shelf). Shelves are included in your full JSON backup and restored with it, and a shelf-only file also imports through Settings
- Each shelf entry keeps a snapshot (id, title, year, poster), so a shelf still reads correctly if a film later leaves your library and an exported shelf makes sense on another machine. When an imported Letterboxd/IMDb film is matched to TMDb (its id changes), shelves follow it
- Saved locally (`horrorhub.shelves.v1`), versioned like everything else; shelves are lazy-loaded so the first page load didn't grow

Acceptance criteria:
- ✅ Users can organize films into personal collections or shelves
- ✅ The app surfaces curated collections in a clean UI
- ✅ No heavy backend or account system is required

Follow-ups:
- "Shared watchlist themes" is covered by file and text sharing only. A link that carries a shelf in its URL (no upload) would be a natural next step, and importing from a pasted text list, by matching titles against TMDb
- Shelves are lists of films only; there's no cover image choice, drag-to-reorder or per-film notes yet (reordering is up/down buttons, which are also keyboard-friendly)
- Curated collections are library-based and don't fetch anything; "recommended by subgenre" from TMDb (films you don't own) still lives in For You
- Deleting a film from your library leaves it on its shelves on purpose; there's no cleanup for shelf entries you no longer want

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
- ⬜ No file over ~400 lines: `MovieCard.jsx` is now ~403 after #15 removed its duplicated watch dialogs (was ~485) (it holds both the compact and full card layouts). Split it into `CompactCard` / `FullCard` plus shared actions. `MovieDetails.jsx` (~395) and `StatsView.jsx` (~305) are fine but next in line.

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
Status: Done
Priority: P2

Nine tabs in a fixed grid didn't fit on a phone, several overlapped in purpose, the browser's Back button left the app instead of moving between views, and the tab buttons weren't keyboard-friendly (the Recommendations tab also passed a `className` that the component silently ignored).

Implementation notes (`lib/nav.js`, `components/MainNav.jsx`, `hooks/useHashTab.js`):
- The nine views are regrouped into six sections: Discover (Browse, Rate films), My Library, For You (Picks for tonight, Because you liked…), Plan (Watchlist & plans, Challenges), Stats and Settings. A second row of pills appears only in sections that hold more than one view, and choosing a section returns you to the view you last used in it
- Responsive: the section bar scrolls sideways on a phone and becomes an even six-column row from small screens up
- The current view lives in the URL hash (`#library`, `#challenges`...), so Back and Forward move between views, a view can be bookmarked, and an unknown hash falls back to Discover. Clicking the view you're already on doesn't add history entries, and any view change (including Back) closes an open film's details
- Accessibility: proper `tablist`/`tab`/`tabpanel` roles, `aria-selected`, a roving tab index, and Arrow/Home/End keys (wrapping) in both rows
- Every view id is unchanged, so saved state and the first-run checklist keep working

Follow-ups:
- The layout hasn't been checked on a real phone or with a screen reader, only through DOM tests
- Views inside a section aren't remembered across visits (only within a session)
- `TabsList`/`TabsTrigger` in `components/ui/tabs.jsx` are no longer used by the app (see #15)

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
Status: Done
Priority: P2

`components/ui/*` were hand-rolled stubs: a `Popover` that just rendered its content inline, a `Select` nobody used, a `Calendar` that was really a date input, a `Dialog` with no accessibility behaviour, and six declared dependencies (four Radix packages, `class-variance-authority`, `tailwind-merge`) that nothing imported. I chose to drop the unused packages rather than adopt Radix, to keep the app light (the runtime dependencies are now just React, React DOM, Recharts and lucide-react).

What changed:
- **Dialog** now uses the browser's native `<dialog>` element: a real modal with an inert background, Escape to close, focus returned to what opened it, `aria-labelledby` from its title, and backdrop-click to close. No library, and it's controlled the same way as before
- **Date bug fixed:** the old `Calendar` read the picked date with `new Date("YYYY-MM-DD")`, which is UTC midnight. West of UTC (the whole of the Americas) a watch logged for the 15th was saved as the 14th, and the picker showed tomorrow's date in the evening. Watch dates feed streaks and challenges. The new `DateField` works in local days, and the day helpers live in `lib/dates.js`
- The watch dialog was copy-pasted three times (two card layouts and the details page); it is now one `WatchDialog`, so all three behave the same (the details page now also offers the same "watched today" bookkeeping, and future dates can't be picked)
- Stats date-range pickers use the same `DateField` (they had the same bug, and used to show two calendars permanently open)
- Removed `Select`, `Popover` and `Calendar`; `Tabs` is now just the panel container (its buttons live in `MainNav`); `Button` defaults to `type="button"` and looks disabled when it is; `Slider` passes accessibility props through and every slider has a label
- Removed six unused dependencies. A test now fails if an unused runtime dependency creeps back in, or if the app imports something undeclared
- `MovieCard` dropped from 485 to 403 lines as a side effect (see #8)
- The test suite now runs in `America/Los_Angeles` by default (override with `TZ=...`) so date bugs that only show up west of UTC are caught. Two tests are checked to fail against the old date logic

Follow-ups:
- Native `<dialog>` doesn't lock page scroll behind it; add if it turns out to be annoying on long pages
- `Card`, `Badge`, `Input`, `Label` and `Textarea` are still small hand-written components; that's fine at this size, but a shared `cn()` class helper would tidy conditional classes if the primitives grow
- Dialog focus handling relies on the browser; it hasn't been tried in every browser, and jsdom needed a small polyfill for the tests

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

## Innovation backlog
Source: the product review of 2026-09-29. The roadmap above is built; these are the ideas that would make HorrorHub *different* from Letterboxd/Trakt-style trackers, plus a few must-fix items the review turned up. Ordered by value for the effort.

### 19. Must-fix: TMDb attribution and privacy leaks
Status: Done (text notice; see leftovers)
Priority: P0

- TMDb's API terms require an attribution notice and logo ("This product uses the TMDB API but is not endorsed or certified by TMDB"). There is none anywhere in the app. Add it to the footer and Settings → Connections (also credit OMDb / DoesTheDogDie where their data is shown)
- The Creepster header font is loaded from Google Fonts on every visit, which sends your IP to Google, at odds with a local-first, private app. Self-host it (the font file ships with the build)
- Discover and streaming badges are hard-coded to the US (`region=US`, `results.US`, `en-US`). Add a region/language setting so non-US users get their own availability and titles

Done: footer notice on every screen; Creepster bundled in `src/assets/fonts` (no request to Google); a "Where you watch" region setting (Settings → Connections) drives streaming badges, Discover release dates and the age rating on details. Left for later: the TMDb logo image (the text notice is in place), OMDb/DoesTheDogDie credit lines, and translated titles (text stays English because tag and warning matching reads English TMDb keywords).

### 20. "Tonight" home screen (make the core promise the front door)
Status: Done (see leftovers)
Priority: P1

The app opens on generic Discover browsing (a commodity), and the For You screen puts four control cards above the actual answer. The differentiator is "what should I watch tonight, and will I be okay with it?". Make a Tonight screen the default landing: one big pick with reasons, warnings and runtime, an accept / reroll (never that one again) / different vibe control, the scare and vibe dials collapsed into a single line, plus what's in progress (streak, active challenge, saved plan for tonight).

Acceptance criteria: a first-time-with-data user reaches a pick with one tap; the pick always shows why and any content flags; rerolling never repeats.

Done: Tonight is the landing screen (`src/features/tonight`, logic in `lib/tonight.js`). One pick with reasons, scare level, runtime and content warnings; "Another" (never repeats in a session), "Not for me" (remembered), up to three alternatives; the scare and vibe dials sit behind one summary line; streak and running challenges show as "In progress". For You is now labelled "Tune your picks". Left for later: a TMDb-based pick when the library has nothing unwatched (the empty state links to For You instead), and a saved plan for tonight in the progress strip.

### 21. Taste calibration quiz and estimated scare levels (fix the cold start)
Status: Done (see leftovers)
Priority: P1

The taste engine needs rated films and scare scores, and unscored films default to 5/10, so a new user gets weak picks for a long time. Add a 60-second calibration: about a dozen iconic films across subgenres ("seen it and loved it / it was fine / too much / haven't seen it"), seeding the taste profile and scare tolerance immediately. Estimate a scare level for unscored films from TMDb (certification, keywords, genres, vote data) and label it "est.", replacing the flat 5.

Done: a 13-film quiz (loved / fine / too intense / not seen) seeds the taste profile at 70% weight and sets a scare ceiling ("too intense" on a film rated N means nothing above N-1 is suggested first). Unrated films get an estimated scare level from their tags, content flags and keywords, labelled "est." on cards, details, Tonight and the marathon planner, and shifted by how your own scare ratings compare with the estimates. A scare level counts as yours once you move the slider (`scaresRated`); older libraries treat a bare 5 as unrated. Left for later: using TMDb age ratings in the estimate (not stored on films yet), and using estimates in your content limits (limits still read the stored number, which defaults to 5).

### 22. Group Night (find what everyone will actually watch)
Status: Done (see leftovers)
Priority: P1

Nothing else does this. Add 2-4 people, each with a quick profile (vibe dials, content limits to avoid, seen-it list), and find films that sit inside everyone's limits and overlap on taste, ranking by the least-happy person's score (min-max, not average) and explaining the compromise ("Sam avoids animal harm, Alex wants slow-burn: this fits both"). Local only; profiles saved as named presets. Pairs with the marathon planner for a whole night.

Done: Tonight → Group night (`features/tonight/GroupNight.jsx`, logic in `lib/group.js`). 2-4 people; each has a scare limit, content to avoid and vibes they enjoy (yours come from Settings). Limits are hard rules, then films are ranked by the least-happy person with the average only breaking ties, and each pick says why it works and whose call the compromise is. A "Ruled out by limits" panel shows what each person's limits removed. Films someone has seen are left out (tick "has seen it" per guest, or include them, listed last). Guests can be saved and re-added; the current group is remembered. Left for later: feeding the group's pick into the marathon planner as a whole night, a Group Night pick that reaches beyond your library (TMDb), and guests with a taste quiz of their own (guests only have vibes and limits, not learned taste).

### 23. Mystery Reel (blind pick)
Status: Planned
Priority: P2

Spoiler-free picking: choose a vibe and intensity, then reveal a film from your watchlist showing only its runtime, subgenre tags and a mood line, with the title and poster hidden until you commit. Content limits still apply. Cheap (all data exists) and very on-brand.

### 24. Horror Wrapped and insights that say something
Status: Done (see leftovers)
Priority: P1

Stats today are counters, and XP has no levels or meaning. Replace them with narrative insights computed locally ("you rate slow-burn films 1.2★ higher than slashers", "your Friday-night watches average 7.1 scares", "your scare tolerance is up 1.5 since March") and a yearly "Horror Wrapped" card (top subgenres, scariest film, longest streak, marathon count) that exports as a shareable image. Give XP levels or retire it.

Done (Stats screen, `features/stats`, logic in `lib/insights.js`, `lib/wrapped.js`, `lib/progress.js`):
- **Insights** ("What your habits say"): plain sentences about your own taste and habits, each showing how many films it rests on, and only appearing when there's enough behind it: your best and worst subgenre by rating, whether you rate scarier films higher, whether your recent watches run scarier than earlier ones (and from which month), the night you mostly watch on and which night is your scary one, your favorite decade, and how long your watchlist would take at your pace. Below five films it says how many more to log.
- **Horror Wrapped**: your year in horror (pick any year with watches): films, hours, new vs rewatched, a personality from your favorite vibe ("The Slasher Devotee", "The Dread Connoisseur"... or "The Horror Omnivore"), most watched tags, scariest and top-rated films, busiest month, favorite night, longest streak, biggest night. Save it as a 1080x1350 image (drawn on your device, nothing uploaded) or copy it as text.
- **Rank and badges**: XP now has eight named levels from Fresh Meat to Elder God with a progress bar and "N XP to the next rank"; badges show how close you are ("2/3"). The XP formula is unchanged.
- **Fixes while rebuilding it**: average scare used a flat 5 for unscored films (it now uses estimates, labelled "(est.)" unless you've set most scare levels), the streak could count one that ended long ago (it is now the live streak, matching Tonight and Challenges), the scatter chart plotted unrated films at zero (it now shows rated films only), and the overview no longer overflows on a phone.

Left for later: a December prompt to open Wrapped; insights are descriptive, not predictions (no recommendations come from them yet); the heatmap, tag matrix and recent list are unchanged; and "Midnight Marathon" now uses your longest streak (so it stays earned) instead of the current one.

### 25. Scare diary and fear calibration
Status: Done (see leftovers)
Priority: P2

After a watch, optionally log how scared you actually were, who you watched with, and when. Compare with the predicted scare level to calibrate you personally ("horror hits you harder than average: predictions adjusted +1"), and surface context insights (alone at night vs with friends). Feeds the taste engine and Group Night.

Done: logging a watch now has an optional "How was it?" section (how scared you were 0-10, who with, and daytime / evening / late night), and each film page lists its Viewing diary with a remove button for each entry (`lib/diary.js`, `features/details/ViewingDiary.jsx`). Notes are kept per film and day, survive imports (merged, never overwritten) and are in backups. A film with a diary score no longer shows an estimated scare level: your own word replaces it everywhere (Tonight, Group Night, marathons, Wrapped). Your diary scores and slider ratings are compared with the predictions to calibrate you personally: if you run higher or lower than the formula, estimates for films you haven't scored shift with you. Stats insights gain "Horror hits you harder than average", "You feel N points more scared watching alone than with other people" and "Late at night the same films scare you N points more".

Left for later: adding a diary note to a watch you logged earlier (today only new watches take one); a diary timeline view across films; and using company in Group Night (e.g. "nobody here has seen it, and it's a group watch").

### 26. Double-feature pairing
Status: Done (see leftovers)
Priority: P2

A "Pair with…" suggestion on any film that picks a companion by contrast or complement: a palate cleanser after something heavy, a same-subgenre deep cut, or a shorter film to fit the night, using the marathon pacing rules and your limits. One tap opens the planner with both films.

Done: a **Pair with…** button on a film's page and on Tonight's pick (`features/pairing/PairWith.jsx`, logic in `lib/pairing.js`) suggests companions from your unwatched library, never films you've seen, unreleased ones, or anything over your content limits. Three kinds: *Same wavelength* (shares a tag, scare level within 2), *Palate cleanser* (at least 3 points lighter; skipped with a reason after an already-gentle film) and *Quick one* (90 minutes or less and shorter than the base film). Each pick shows its scare level (est. when estimated), runtime, the length of the whole night, and why. **Plan this double feature** opens Plan → Watchlist & plans with exactly those two films in order, a start time, Save plan, calendar export and add-to-watchlist; "Plan automatically instead" returns to the normal planner. Marathons now also use diary-derived scare levels.

Left for later: pairing from a film that isn't in your library using TMDb to suggest companions (today companions come from your library only); a "warm-up" companion to watch before a heavy film; and three-film pairings.

### 27. Ask HorrorHub (natural-language search)
Status: Planned
Priority: P2

"Slow-burn folk horror under 100 minutes, no animal harm" typed into one box. Start with a deterministic parser (runtime, decade, moods and tags, exclusions mapped to content flags) over your library and TMDb; optionally use an LLM key for freer phrasing, off by default to keep the app local-first.

### 28. Installable and safe: PWA plus automatic backups
Status: Done (see leftovers)
Priority: P1

All data lives in one browser's localStorage, so clearing site data or losing the device loses everything and backups are manual. Make the app an installable PWA (offline library, home-screen icon) and add optional automatic backups to a folder you pick (File System Access API where available, with a "last backed up" reminder elsewhere). Consider an encrypted single-file sync for moving between devices.

Done:
- **Installable and offline.** Web manifest, icons, and a service worker (`public/sw.js`) that stores every built file (the build writes the list into it, see `vite.config.js`), so the app opens and all screens work with no internet, even ones never opened online. Opening the app tries the network first so updates arrive. TMDb posters are stored as you view them (up to 300). The TMDb API is never intercepted. `npm run audit:offline` builds the app, lets a real browser install it, stops the server, and checks it still works; it also asks the browser whether the app is installable. It caught a real bug (servers that send `Vary: Origin` made every stored-file lookup miss).
- **Automatic backup to a folder** (Settings → Backup & Import): choose a folder (Chrome, Edge and other Chromium browsers), and a backup is written a few seconds after every change: `horrorhub-backup.json` plus the newest 7 daily copies. If the browser forgets folder access after a restart, a banner and a Reconnect button resume it. A manual export counts as a backup too.
- **Reminder** for browsers that can't write to a folder, or before you set it up: a banner when a library has never been backed up or the last backup is 14 days old, with Export now, Set up, and Remind me later (snoozes 7 days).
- **Protect storage**: a button asks the browser not to clear the site's data when space is low, and Settings says whether it agreed.

Left for later: the backup holds your library, shelves, challenges and plans, but not settings (comfort limits, region, taste-quiz answers); an "update available" prompt when a new version is installed; and the folder-picker and permission flow has been tested with simulated folders but not clicked through in a real browser (the browser's own dialogs can't be automated).

### 29. Round-trip with Letterboxd
Status: Planned
Priority: P2

Imports work, but you can't get your ratings and watches back out. Add a Letterboxd-compatible CSV export (and IMDb-style ratings), so leaving is as easy as arriving. That's what makes moving in trustworthy.

### 30. Out of scope for now (need a backend)
Status: Parked

Community "look away" timestamps, shared live watch parties, and crowd-sourced scare ratings. They'd be the biggest differentiator of all but require accounts and moderation, which the product direction rules out for now.

### 31. Feature sprawl: tell people where to start
Status: Planned (first step done: Tonight is the landing screen)
Priority: P1

There are 10 views in 6 sections and nothing says which to use first. Scope:
- Tonight (#20) becomes the landing screen, so most sessions start and end there
- A "next step" card driven by the user's state, replacing the static getting-started list: no key → add a key; empty library → calibrate (#21) or import; few ratings → rate 5 more; ready → Tonight
- Progressive disclosure: hide or collapse Stats, Challenges and Shelves behind a "More" group until the library has enough films to make them useful (setting to show everything)
- Every empty state points to the one next action, not a menu
- Measure by running the audit script from a fresh profile: from a blank start, a pick on screen in three taps

### Weakness coverage (from the review)
Each weakness the review raised is covered by an item above. Scope decisions so none is dropped:

| Weakness | Item | Scope decision |
| --- | --- | --- |
| Generic front door | #20 | Tonight is the default landing; For You's four control cards collapse into one summary line above the pick |
| Cold start | #21 | Calibration quiz seeds taste + scare tolerance; unscored films get an estimated scare level labelled "est." instead of a flat 5 |
| Stats are counters | #24 | Promoted to P1: insights first, counters second; XP gets levels with named ranks or is removed |
| Fragile data | #28 | Promoted: PWA, automatic folder backup, "last backed up" reminder in the header when overdue |
| Feature sprawl | #31 | Above |

### 32. Challenge build-out: start today and a daily plan
Status: Done (see leftovers)
Priority: P1

Raised while using the app: an added challenge like 31 Nights of Halloween sat on "Not started" with no way to begin, and nothing showed what to watch on which night.

Done: an upcoming challenge has a "Start today" button that moves its window to begin now (same length). Each running or upcoming challenge has a Daily plan (`features/challenges/ChallengePlan.jsx`, logic in `lib/challengePlan.js`): one film per night from your library, building from gentle to intense around your usual scare level, skipping watched films and anything over your limits, and only films that count for a themed challenge. Swap any night, fill open slots, log the watch from the row, replan, clear, or download the plan as a calendar file. The plan is saved on the challenge (so it is in exports) and Tonight shows "tonight is ..." for your running challenges. Left for later: filling open slots straight from TMDb ideas (today: add ideas to your library, then Replan), and plans for finished challenges.

## Notes
The product should feel like a personal horror curator, not just a database. The strongest differentiator is a recommendation system that understands horror taste, mood, and watch planning.
