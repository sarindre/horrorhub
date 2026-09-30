# CLAUDE.md

## Project overview
HorrorHub is a personal horror movie library and discovery app built with React + Vite. The product is designed as a dark, curated tracker for horror fans to:

- search and add films to a personal library
- rate and review movies
- track watch dates and watchlists
- tag films by mood, subgenre, and themes
- export/import data from JSON and CSV sources
- get recommendations based on ratings and watched titles

## Stack and architecture
- Frontend: React 19, Vite
- Styling: Tailwind CSS
- UI primitives: shadcn-style component patterns in `src/components/ui`
- Animation: small CSS animations in `src/index.css` (no animation library). Anything that moves must respect `prefers-reduced-motion`
- Heavier screens are lazy-loaded from `src/lazyViews.js`; add new heavy screens there and keep the initial bundle small
- Charts: Recharts
- Data source: The Movie Database (TMDb) for metadata and poster images
- Persistence: browser `localStorage`

## Key files
- `src/App.jsx`: app shell only (tabs, settings and library wiring); features live in `src/features/<tab>/`, shared UI in `src/components/`, data hooks in `src/hooks/`. Don't grow `App.jsx`; add new UI as a feature or component file
- `src/hooks/useHybridRecommendations.js`: recommendation logic using TMDb similarity data
- `src/lib/*`: pure, tested logic (storage, library schema/merge/import validation, CSV parsers, ICS, mood presets). New logic should go here, not into `App.jsx`
- `src/components/SearchBar.jsx`: search input component
- `src/components/ui/*`: small reusable primitives (Button, Card, Dialog on native `<dialog>`, DateField, Slider...). Keep runtime dependencies minimal; a test fails if a declared runtime dependency isn't imported

## Product direction
This project should stay local-first, lightweight, and highly personalized. It is not meant to become a generic streaming app or a large social platform. The strongest product identity is a horror-specific personal library with strong curation, mood discovery, and planning tools.

## Working conventions
- Prefer small, focused UI additions over broad rewrites.
- Keep the app aesthetic dark, polished, and horror-themed.
- Preserve local-first behavior; avoid requiring a backend unless absolutely necessary.
- Feature work should enhance discovery, personalization, and watch planning.
- Keep imports/exports working smoothly for users moving data from Letterboxd or IMDb.

## Suggested roadmap themes
1. Discovery intelligence: recommendation quality, mood matching, and smart filtering
2. Personal planning: themed watchlists, marathons, seasonality, and progress tracking
3. Catalog intelligence: auto-tagging, content warnings, and better filtering
4. Retention features: streaks, challenges, and themed collections

## Commands
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm test`
- `npm run audit:responsive` (real browser; run it after any layout or CSS change, and before releasing)
- `npm run audit:offline` (real browser; run it after changing `public/sw.js`, the manifest, `vite.config.js` or how files are loaded)

## Layout rules
- No element selectors (`button`, `h1`, `body`...) in `src/index.css` outside `@layer base`. Unlayered CSS beats Tailwind's utility classes (a test enforces this).
- Rows of buttons or controls need `flex-wrap`; a card wrapped in another element inside a grid needs `min-w-0` on the wrapper, or a long non-wrapping title sets the column width. `npm run audit:responsive` catches both.
- Bare `<button>` text is centered by default; use `text-left` for title-style buttons.

## Data rules
- Never write to `localStorage` directly; use `src/lib/storage.js` (`readJSON`/`writeJSON`), `usePersistentState` (UI preferences, stored in one object by `src/lib/prefs.js`) or `useSettings` (app settings).
- Settings live in `src/lib/settings.js` (`DEFAULT_SETTINGS` + `normalizeSettings`). To add a setting: add a default, validate it in `normalizeSettings`, then read it from `settings` and change it with `update({ key: value })`. Don't keep a local copy in component state.
- Library items are shaped by `normalizeItem` in `src/lib/library.js`. Imports go through `validateImport` + `mergeLibraries`, which never delete data.
- When changing the stored library shape, bump `LIBRARY_VERSION`/key and add a migration in `loadLibrary`.
- Scare levels: `item.scares` is 0-10 and defaults to 5, but it only counts as your rating once `scaresRated` is set (the slider handlers do this). Read scare levels through `scareOf` in `src/lib/scare.js`, which returns an estimate (`estimated: true`) for unrated films; label estimates "est." wherever they are shown. Taste profiles come from `buildTasteProfile(items, { calibration })`; in components use `useTasteProfile` so the taste-quiz answers (stored in settings) are included.
- Dates: a "day" is a local `YYYY-MM-DD` (see `src/lib/dates.js`). Never pass a `YYYY-MM-DD` string to `new Date(...)` (it's read as UTC, the previous evening west of UTC); use `parseDay`/`dayKey` and `DateField`. Tests run in `America/Los_Angeles` by default (`vite.config.js`) to catch this.
- Run `npm test`, `npm run lint` and `npm run build` before committing.
- Tests: pure logic gets plain Vitest tests next to the code; views are smoke-rendered on the server (`renderToString`, so text nodes can be split by `<!-- -->` markers when matching); hooks with effects or async loops are tested in jsdom with `// @vitest-environment jsdom` at the top of the file and a stubbed `fetch`. Background work (auto-tagging, import matching) must depend only on stable callbacks so it doesn't restart on every render.

## Offline and backup
- `public/sw.js` is the service worker. The build fills in its file list (`offlineManifest` in `vite.config.js`), so new files are included automatically; don't hard-code file names in it. It never touches the TMDb API. Stored lookups use `ignoreVary` on purpose (servers send `Vary: Origin`; without it every lookup misses).
- Automatic folder backup is `src/lib/folderBackup.js` + `src/hooks/useAutoBackup.js`; the rules (file names, reminders) are pure in `src/lib/backup.js`. What a backup contains is `buildExport` plus the `extras` built in `App.jsx`: if you add a new kind of stored data worth keeping, add it to `backupData` there and to the export/import path.
- Tests use the fake folder and IndexedDB in `src/test/fakeFolder.js`.

## Notes for future work
The app already has a strong foundation of library management. The next refresh should emphasize:
- horror-specific personalization
- better recs based on taste rather than title search alone
- themed watch planning and challenge experiences
- clearer content flags and filtering for horror content

This is a product with personality and a niche audience; success should feel like a premium personal horror curation tool, not a generic media app.
