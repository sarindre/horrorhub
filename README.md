# HorrorHub

A dark, local-first horror movie library and discovery app. Search films, rate them, tag them by mood and subgenre, log watches, plan what to watch next, and bring your history over from Letterboxd or IMDb.

Built with React 19, Vite, Tailwind CSS and Recharts. Movie data and posters come from [The Movie Database (TMDb)](https://www.themoviedb.org/). This product uses the TMDB API but is not endorsed or certified by TMDB.

## Getting started

```bash
npm install
npm run dev
```

Then open **Settings**, paste your TMDb v4 *Read Access Token* (free at themoviedb.org → Settings → API) and start exploring in **Discover**. Optional OMDb and DoesTheDogDie keys add IMDb/Rotten Tomatoes scores and content counts to the details page.

## What it does

- **Tonight:** the home screen. One pick for tonight with the reasons, scare level and content warnings, a reroll that never repeats, and your streak and challenges underneath. A 60-second taste quiz teaches it your taste and how scary is too scary; scare levels you haven't set are estimated and labelled "est.".
- **Group night:** add everyone watching with their scare limits, content to avoid and favorite vibes; it finds the films from your library that suit the whole room, ranked by how the least-happy person feels, and explains the compromise.
- **Library:** rate, review, tag and log watches; import from Letterboxd/IMDb; filter by mood, several tags at once, or "untagged".
- **Recommendations:** learns your taste from your ratings, watches and tags, and explains every suggestion ("You tend to enjoy #folk-horror", "Because you liked Hereditary").
- **Auto-tagging:** reads TMDb keywords, genres and descriptions and tags films for you (marked ✦). Your own edits always win.
- **Content warnings:** category warnings (gore, animal harm, and so on) on cards and details, plus limits you set: warn or hide films over them. Warnings are inferred from TMDb keywords, so an absent warning is not a guarantee.
- **Installable and offline:** install it as an app on your desktop or phone; it opens and works without internet (TMDb searches still need a connection).
- **Insights and Wrapped:** Stats tells you things about your own habits ("you rate slow-burn films higher than slashers"), gives you a rank, and builds a Horror Wrapped year-in-review you can save as an image.
- **Planning:** a marathon planner that fits a themed lineup to your time budget and shapes the scare level across the night, a weekly watch plan with warnings shown up front, tonight's pick, saved plans, and calendar export.
- **Shelves:** your own named lists of films, plus collections curated from your taste ("Top picks for your Occult mood", "Your best Slashers", "Time for a rewatch"). Share a shelf as a file or a text list, no account needed.
- **Challenges:** 30 Days of Horror, Halloween, Found-Footage Week and more, tracked from your watch dates. Start one today or wait for its date, and get a day-by-day plan (a film per night, building from gentle to intense) you can swap, log and export to your calendar.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Unit, render and interaction tests (Vitest) |
| `npm run audit:offline` | Builds the app, installs it in a real browser, stops the server and checks it still opens and works offline; also checks that the browser considers it installable. Needs Edge or Chrome |
| `npm run audit:responsive` | Opens every screen in Edge/Chrome at phone, tablet and desktop widths and fails if anything makes the page wider than the screen. Needs Edge or Chrome installed (set `CHROME_PATH` if it isn't found); add `-- --shots=./shots` to save screenshots |

## Your data

HorrorHub has no backend. Your library, settings and API keys are stored in this browser's `localStorage`, so they are not synced anywhere and are lost if you clear site data.

- **Automatic backup:** in Chrome, Edge and other Chromium browsers, Settings → Backup & Import → *Choose backup folder* keeps a backup there (latest plus 7 daily copies), updated a few seconds after every change. Pick a folder inside OneDrive, Dropbox or iCloud to also protect against losing the computer. It saves your library, shelves, challenges and plans, not settings or API keys.
- **Other browsers:** Settings → Backup & Import → *Export* downloads a JSON file, and HorrorHub reminds you when it has been a while.
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
