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
Status: Planned
Priority: P1

Expand the current hybrid recommendation approach into a more robust taste engine that learns from the user's horror preferences.

Ideas:
- weighted recommendations from ratings and watch history
- score based on tags, scares, mood, and subgenre
- suppress already-seen titles and avoid duplicates
- show “because you liked X” explanations

Acceptance criteria:
- Similar titles are generated using the user's watched + rated library
- Recommendations improve over time as more data is added
- The app explains why a suggestion is being made

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
Status: Planned
Priority: P1

`useHybridRecommendations` calls TMDb `/similar`, which is not horror-filtered, and it refetches whenever any library field changes (each rating click). It only seeds from the first 3 titles rated 4+ and ignores tags, moods and scares. The TMDb "Similar to your favorites" list is also not mood-aware (open from item 1).

Acceptance criteria:
- Only horror titles are suggested (genre 27)
- Fetches depend on the seed titles, not the whole library; results are cached
- Seeds are weighted by rating, recency and tags; the active mood preset applies to TMDb picks too
- Loading and error states are shown; requests abort on unmount

### 10. Shared TMDb client and error handling
Status: Planned
Priority: P1

Fetch calls are scattered through the file with no `res.ok` check, no error state and no request cancellation, so a bad API key or a rate limit just shows nothing and slow responses can land out of order.

Acceptance criteria:
- One `lib/tmdb.js` client (auth header, `res.ok`, typed errors, abort support, small response cache)
- Visible "invalid key / rate limited / offline" states
- Replace `alert()` with non-blocking toasts
- Clear the 7 remaining `react-hooks/exhaustive-deps` lint warnings (fetch effects in Discover, Rating Roulette, Continuity, MovieCard sync)

### 11. Settings cleanup
Status: Planned
Priority: P1

Settings mirrors ~20 pieces of state into local state and pushes them up with one large effect. The `theme` choice is saved but never applied. API keys are stored in plain text and the OMDb/DoesTheDogDie fields aren't masked. Other UI preferences (discover/roulette filters) still use ad hoc `horrorhub.*` keys with no schema version.

Acceptance criteria:
- Single source of truth for settings (no mirrored state), with a versioned schema and migration
- `theme` actually switches the app theme (dark / light / system)
- Key fields masked, with a short note in the README that keys live in this browser only
- UI preference keys consolidated under one versioned preferences object

### 12. Subgenre Mixer sliders don't update picks live
Status: Planned
Priority: P1

The Mixer on the Recommendations tab mutates the `mixer` object directly (`mixer.ghosts = ...`), which doesn't trigger a re-render. Make the sliders controlled and persist them in settings.

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
