# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Created project guidance in [CLAUDE.md](CLAUDE.md) to document the app’s purpose, stack, product direction, and development workflow.
- Added the refresh roadmap in [BACKLOG.md](BACKLOG.md), outlining the next major horror-focused product improvements.
- Captured the first product refresh priorities for HorrorHub, centered on discovery intelligence, watch planning, and horror-specific personalization.
- Implemented the first real refresh feature: a horror-vibe mood selection system that lets users filter their library and sharpen recommendations by style such as atmospheric, slasher, occult, found footage, body horror, and cosmic.
- Added a Creature Feature mood preset and a library "Max scares" intensity filter; the mood-based picks heading now shows the active vibe and scare level.

### Changed (code review, steps 1 and 2: safety net + data layer)
- Added Vitest with unit tests for the library schema/merge, CSV parsers, ICS export and mood matching, plus a render smoke test for the app (`npm test`).
- Extracted the pure logic into `src/lib/` (`storage`, `library`, `csv`, `ics`, `moods`, `usePersistentState`).
- Library storage is now versioned (`horrorhub.library.v3`). Existing v2 libraries migrate automatically on first load and the old key is left in place as a backup. An unreadable value is copied to `horrorhub.library.corrupt` instead of being dropped.
- Every item is normalized on save and import (rating 0-5, scares 0-10, clean lowercase tags, valid watch dates).
- Imports are validated and merged with a preview and confirmation instead of overwriting the library and reloading the page. CSV rows match existing titles by title + year, empty values never overwrite curated data, and tags and watch dates are combined.
- Exports are now a versioned envelope (`{ app, version, exportedAt, items }`); older bare-array exports still import.
- Storage writes are failure-tolerant and a warning banner appears if the browser refuses to save.
- Lint is clean of errors (0 errors, 7 warnings, down from 36 errors and 11 warnings); intentional empty `catch` blocks are allowed, and dead code was removed (unused Library recommendation fetch, a hidden duplicate Connections card, an unused provider lookup on the details page).
- Removed the stray `tmp.ps1` / `tmp_segment.txt` files and rewrote the README.

### Changed (code review, step 3: split App.jsx)
- Split the ~3,000-line `App.jsx` into `features/` (discover, library, watchlist, recs, stats, details, settings), `components/`, `hooks/useLibrary.js` and `lib/` (tmdb, dates, settings). `App.jsx` is now ~250 lines. No behavior change.
- Added render tests for every extracted view (`src/features/views.test.jsx`).
- Removed the unused `ContinuityNavigator` component and unused imports.

### Changed (code review, step 4: recommendations)
- TMDb suggestions now use `/recommendations`, keep only released horror films you don't own, and rank them from up to 5 of your top-rated titles (rating + recency, with multi-seed agreement). Results are cached for 24 hours and only refetch when the seed titles change, not on every rating click.
- The selected night vibe now shapes the "Similar to your favorites" list, not just your own library picks.
- The list shows loading, error (bad token, rate limit, offline), empty and no-token states, and a "Because you liked X" line under each pick.
- Added `tmdbGet` with typed errors and `lib/recommend.js` (seed picking, ranking, caching) with 21 new tests.

### Changed (code review, step 5: shared TMDb client and error handling)
- All TMDb calls (Discover, Rating Roulette, Because You Liked…, Movie Details, Cold Night Roulette) now go through one client with typed errors, cancellation and an optional short-lived cache. Flipping between Discover sorts, or coming back from a details page, no longer refetches.
- Bad token, rate limit and offline states are now shown instead of silently rendering nothing. Discover and Rating Roulette have a Retry button, and tabs tell you when no TMDb token is set (Rating Roulette used to pop an alert every time you opened it without one).
- `alert()` popups are replaced by non-blocking toasts, including a confirmation toast after an import.
- Streaming-service badges and the "Available on" filter live in a `useProviders` hook. The filter now updates as soon as lookups finish (it used to wait for an unrelated re-render).
- Movie Details loads its four core lookups independently, so one failing request no longer blanks the page, and it shows an error banner if the main lookup fails.
- Discover results show your current rating live instead of the rating at the time of the search.

### Fixed
- Opening the details page of a film that wasn't in your library silently added it (through the automatic keyword tagging). Auto-tagging and DoesTheDogDie counts now only apply to films you already own.
- Toggling the watchlist on a Discover / Rating Roulette card for a film you already own could wipe its watch dates, because those cards carried an empty `watchedDates` list. Result cards no longer carry library-owned fields.
- An OMDb failure no longer stops the DoesTheDogDie and keyword steps from running.
- Posters in "Similar to your favorites" never loaded because the URL was built twice.
- Broken "…" characters in the Because You Liked… tab title and Build Map button label.
- Adding or watchlisting a title that was already in your library from Discover could reset its tags, watch dates, scares and rating to defaults. Only the fields actually provided are updated now.
- IMDb CSV ratings (out of 10) are converted to the app's 5-star scale instead of being stored as up to 10 stars.
- Letterboxd/IMDb CSV imports no longer overwrite existing tags and scare levels with defaults, and one bad date in a row no longer fails the entire import.
- ICS export escapes commas, semicolons and newlines in titles, and no longer prints empty "()" when a year is missing.
- Tailwind config no longer uses `require` in an ES module.

### Planned roadmap items
- Mood-based horror matching
- Smart recommendation engine upgrades
- Horror-specific watch planning and marathon generation
- Auto-tagging and catalog intelligence
- Content warnings and trigger filters
- Seasonal and challenge-based discovery
- Light curation features without full social networking

## [2026-09-28]

### Added
- Initial project refresh planning documentation for the HorrorHub revamp.
- Established a clear backlog structure to guide future feature work and keep the project aligned with its niche horror identity.

---

This changelog will be updated as implementation work begins on the backlog items above.
