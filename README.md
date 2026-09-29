# HorrorHub

A dark, local-first horror movie library and discovery app. Search films, rate them, tag them by mood and subgenre, log watches, plan what to watch next, and bring your history over from Letterboxd or IMDb.

Built with React 19, Vite, Tailwind CSS and Framer Motion. Movie data and posters come from [The Movie Database (TMDb)](https://www.themoviedb.org/).

## Getting started

```bash
npm install
npm run dev
```

Then open **Settings**, paste your TMDb v4 *Read Access Token* (free at themoviedb.org → Settings → API) and start exploring in **Discover**. Optional OMDb and DoesTheDogDie keys add IMDb/Rotten Tomatoes scores and content counts to the details page.

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
- If the browser refuses to save (for example, storage is full), a banner tells you so and suggests exporting a backup.

## Project layout

```
src/
  App.jsx                 app shell and most UI (being split up, see BACKLOG.md)
  lib/                    storage, library schema/merge, CSV parsers, ICS export, mood presets
  hooks/                  data hooks (TMDb recommendations)
  components/             SearchBar and UI primitives
```

See [CLAUDE.md](CLAUDE.md) for product direction, [BACKLOG.md](BACKLOG.md) for the roadmap and [CHANGELOG.md](CHANGELOG.md) for what changed.
