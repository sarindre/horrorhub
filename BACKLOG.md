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
Status: In Progress
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
- Remaining: TMDb "similar" picks are not yet mood-aware; add a found-footage-style dread/cosmic tuning pass once tag data is richer

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
Status: Planned
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

### 4. Auto-tagging and catalog intelligence
Status: Planned
Priority: P1

Use movie metadata, user notes, and behavior to automatically infer tags instead of requiring manual entry for every movie.

Examples:
- folk horror
- body horror
- possession
- home invasion
- found footage
- occult
- slow-burn

Acceptance criteria:
- New titles are automatically assigned useful tags when metadata supports it
- Users can still refine or remove tags manually
- The tag system supports better searches and filtering

### 5. Content warnings and trigger filters
Status: Planned
Priority: P1

Add safer discovery controls for horror content to make the app feel thoughtful and user-friendly.

Examples:
- gore intensity
- body horror risk
- violence level
- animal harm warnings
- content advisories and spoiler flags

Acceptance criteria:
- Users can filter out titles that exceed preferred intensity limits
- Content warnings are visible before a title is added to a plan
- Filters reduce surprise and improve trust

### 6. Seasonal and challenge-based discovery
Status: Planned
Priority: P2

Introduce challenge loops and themed discovery streaks that keep the app engaging over time.

Ideas:
- 30 days of horror challenge
- cult classic month
- found-footage week
- late-night creature feature challenge

Acceptance criteria:
- Challenges are tied to user library or discovered titles
- Users can track completion and streak progress
- A challenge can generate a short watch list automatically

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

Eight tabs in a fixed `grid-cols-8` won't fit on a phone, and Rating Roulette, Because You Liked… and Recommendations overlap in purpose. Merge or regroup them and make the tab bar scroll or collapse on small screens.

### 14. Performance and motion
Status: Planned
Priority: P2

The build is a single ~733 kB bundle: lazy-load Stats (Recharts) and the Details view. The flicker overlay re-renders on scroll and the fog/flicker/audio effects ignore `prefers-reduced-motion`.

### 15. UI primitives cleanup
Status: Planned
Priority: P2

`components/ui/*` are hand-rolled stubs (a native date input as "Calendar", a Dialog that ignores `asChild`), while the Radix packages in `package.json` go largely unused. Either adopt the real shadcn/Radix components or drop the unused dependencies.

### 16. Enrich imported titles with TMDb metadata
Status: Planned
Priority: P1

CSV imports create ids like `letterboxd:Title:Year` (title + year matching now merges them into existing titles, but new ones have no poster, overview or TMDb id). Add a background "match to TMDb" step so imported films get posters, tags and details, and dedupe against Discover.

### 17. Copy and onboarding cleanup
Status: Planned
Priority: P2

Remove leftover scaffolding text ("MVP • Local first", the static "How to use" block), replace it with a proper first-run empty state that walks through adding the TMDb key and importing a library.

### 18. Test coverage for scoring and UI logic
Status: Planned
Priority: P2

The pure helpers (`lib/*`) and a render smoke test are covered. Add tests for recommendation scoring, the mood/intensity filters and tag inference once they move out of the components.

## Notes
The product should feel like a personal horror curator, not just a database. The strongest differentiator is a recommendation system that understands horror taste, mood, and watch planning.
