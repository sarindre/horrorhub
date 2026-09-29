# HorrorHub

A dark, local-first horror movie library and discovery app. Search films, rate them, tag them by mood and subgenre, log watches, plan what to watch next, and bring your history over from Letterboxd or IMDb.

Built with React 19, Vite, Tailwind CSS and Recharts. Movie data and posters come from [The Movie Database (TMDb)](https://www.themoviedb.org/).

## Getting started

```bash
npm install
npm run dev
```

Then open **Settings**, paste your TMDb v4 *Read Access Token* (free at themoviedb.org → Settings → API) and start exploring in **Discover**. Optional OMDb and DoesTheDogDie keys add IMDb/Rotten Tomatoes scores and content counts to the details page.

## What it does

- **Library:** rate, review, tag and log watches; import from Letterboxd/IMDb; filter by mood, several tags at once, or "untagged".
- **Recommendations:** learns your taste from your ratings, watches and tags, and explains every suggestion ("You tend to enjoy #folk-horror", "Because you liked Hereditary").
- **Auto-tagging:** reads TMDb keywords, genres and descriptions and tags films for you (marked ✦). Your own edits always win.
- **Content warnings:** category warnings (gore, animal harm, and so on) on cards and details, plus limits you set: warn or hide films over them. Warnings are inferred from TMDb keywords, so an absent warning is not a guarantee.
- **Planning:** a marathon planner that fits a themed lineup to your time budget and shapes the scare level across the night, a weekly watch plan with warnings shown up front, tonight's pick, saved plans, and calendar export.
- **Challenges:** 30 Days of Horror, Halloween, Found-Footage Week and more, tracked from your watch dates, with generated watch lists.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Unit tests and a render smoke test (Vitest) |

## Your data

HorrorHub has no backend. Your library, settings and API keys are stored in this browser's `localStorage`, so they are not synced anywhere and are lost if you clear site data.

- **Back up regularly:** Settings → Backup & Import → *Export* downloads a JSON file.
- **Importing** (JSON, Letterboxd CSV, IMDb CSV) merges into your library after a preview. Nothing is deleted, empty fields never overwrite what you've curated, and tags and watch dates are combined.
- **API keys** (TMDb, OMDb, DoesTheDogDie) are stored here too, in plain text, and only ever sent to the service they belong to. Don't paste them on a shared computer, and export your library (not your settings) when sharing a backup.
- If the browser refuses to save (for example, storage is full), a banner tells you so and suggests exporting a backup.

## Project layout

```
src/
  App.jsx                 app shell: tabs, settings and library wiring
  features/               one folder per tab: discover, library, watchlist, recs, stats, details, settings
  components/             shared UI: MovieCard, StarRating, TagEditor, overlays, ui/ primitives
  hooks/                  useLibrary, useHybridRecommendations
  lib/                    storage, library schema/merge, CSV parsers, ICS export, mood presets, settings, TMDb constants
```

See [CLAUDE.md](CLAUDE.md) for product direction, [BACKLOG.md](BACKLOG.md) for the roadmap and [CHANGELOG.md](CHANGELOG.md) for what changed.
