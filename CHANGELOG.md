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

### Fixed
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
