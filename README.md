# HorrorHub

A dark, local-first horror movie library and discovery app. Search films, rate them, tag them by mood and subgenre, log watches, plan what to watch next, and bring your history over from Letterboxd or IMDb.

Built with React 19, Vite, Tailwind CSS and Recharts. Movie data and posters come from [The Movie Database (TMDb)](https://www.themoviedb.org/). This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.

## Getting started

```bash
npm install
npm run dev
```

Then open **Settings**, paste your TMDb v4 *Read Access Token* (free at themoviedb.org → Settings → API) and start exploring in **Discover**. Optional OMDb and DoesTheDogDie keys add IMDb/Rotten Tomatoes scores and content counts to the details page.

## What it does

- **Tonight:** the home screen. One pick for tonight with the reasons, scare level and content warnings, a reroll that never repeats, and your streak and challenges underneath. A 60-second taste quiz teaches it your taste and how scary is too scary; scare levels you haven't set are estimated and labelled "est.".
- **Mystery reel:** a blind pick. See how long and how intense a film is, what kind of horror it is and its content warnings, and reveal the title only when you commit.
- **Group night:** add everyone watching with their scare limits, content to avoid and favorite vibes; it finds the films from your library that suit the whole room, ranked by how the least-happy person feels, and explains the compromise.
- **Letterboxd both ways:** import your history, and export ratings, watch dates, tags and reviews back out in the CSV format Letterboxd imports.
- **Ask HorrorHub:** describe what you want in plain words ("gentle 80s slashers I haven't seen, no gore") and it searches your library, shows how it understood you, and can look on TMDb too. Rule-based and local.
- **Help built in:** every screen has a short "How this screen works" panel, and a Help screen has a glossary, FAQ and search.
- **Library:** rate, review, tag and log watches; import from Letterboxd/IMDb; filter by mood, several tags at once, or "untagged".
- **Recommendations:** learns your taste from your ratings, watches and tags, and explains every suggestion ("You tend to enjoy #folk-horror", "Because you liked Hereditary").
- **Auto-tagging:** reads TMDb keywords, genres and descriptions and tags films for you (marked ✦). Your own edits always win.
- **Content warnings:** category warnings (gore, animal harm, and so on) on cards and details, plus limits you set: warn or hide films over them. Warnings are inferred from TMDb keywords, so an absent warning is not a guarantee.
- **Installable and offline:** install it as an app on your desktop or phone; it opens and works without internet (TMDb searches still need a connection).
- **Double features:** "Pair with…" suggests a companion for any film (same wavelength, a palate cleanser, or a quick one) and drops the pair into the marathon planner.
- **Scare diary:** note how scared you actually were, who you watched with and when. HorrorHub learns how scary things are *for you* and adjusts its estimates.
- **Insights and Wrapped:** Stats tells you things about your own habits ("you rate slow-burn films higher than slashers"), gives you a rank, and builds a Horror Wrapped year-in-review you can save as an image.
- **Planning:** a marathon planner that fits a themed lineup to your time budget and shapes the scare level across the night, a weekly watch plan with warnings shown up front, tonight's pick, saved plans, and calendar export.
- **Shelves:** your own named lists of films, plus collections curated from your taste ("Top picks for your Occult mood", "Your best Slashers", "Time for a rewatch"). Share a shelf as a file or a text list, no account needed.
- **Challenges:** 30 Days of Horror, Halloween, Found-Footage Week and more, tracked from your watch dates. Start one today or wait for its date, and get a day-by-day plan (a film per night, building from gentle to intense) you can swap, log and export to your calendar.

## Using it on your phone (GitHub Pages)

Every push to `main` is checked (lint and tests) and published to **https://sarindre.github.io/horrorhub/** by `.github/workflows/deploy.yml`. Open that on your phone, then use your browser's menu: "Install app" in Chrome, or Share → Add to Home Screen on iPhone. It works offline once loaded.

- Only the app's code is hosted. Your films, settings and TMDb token stay in the browser they were entered in, so a new device starts empty: Export on one and Import on the other (API keys aren't included, so paste your token in again).
- Browser storage belongs to the web address. Keep using the same address; moving to another host later means exporting and importing.
- One-time setup for a fork: repo Settings → Pages → Source: "GitHub Actions".
- To preview the sub-path build locally: `BASE_PATH=/horrorhub/ npm run build`, or run `BASE_PATH=/horrorhub/ npm run audit:offline` (on Windows Git Bash prefix `MSYS_NO_PATHCONV=1`).

## Desktop app (Windows, macOS, Linux)

The same app in its own window, for people who would rather not use a browser. It works offline (searching TMDb still needs a connection) and keeps your data on your computer. It's built with Electron: `electron/` is a small shell around the built web app, served from its own `app://horrorhub/` address, with links opened in your normal browser and nothing else allowed to load.

- **Get it:** installers for each system are attached to a [GitHub Release](https://github.com/sarindre/horrorhub/releases) when a version tag (such as `v0.1.0`) is pushed, built by `.github/workflows/desktop.yml`.
- **Unsigned for now,** so your system will warn on first run. Windows: "More info" → "Run anyway". macOS: right-click the app → Open (or System Settings → Privacy & Security → Open Anyway). Linux: `chmod +x HorrorHub-*.AppImage`, then run it.
- **Its data is separate** from the browser and phone versions (each keeps its own library). Move between them with Export and Import.
- **Run it from source:** `npm run desktop`. **Build an installer:** `npm run desktop:dist` (installers appear in `release/`). If the project sits inside OneDrive, building can fail while OneDrive syncs the output; build elsewhere with `npm run desktop:dist -- -c.directories.output=C:/temp/hh-release`.
- **Check it:** `npm run audit:desktop` launches the real app and checks that it loads, can't reach Node, can't be navigated away from the app, keeps your data across a restart, and can reach TMDb. Add `-- --packed=<path to HorrorHub.exe>` to check a built package.
- **Gotcha:** if Electron starts as plain Node, `ELECTRON_RUN_AS_NODE` is set in your environment (some editors set it); unset it.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Unit, render and interaction tests (Vitest) |
| `npm run audit:offline` | Builds the app, installs it in a real browser, stops the server and checks it still opens and works offline; also checks that the browser considers it installable. Needs Edge or Chrome |
| `npm run licenses` | Rewrites `THIRD_PARTY_NOTICES.md` from the installed production dependencies and warns about copyleft or unknown licenses |
| `npm run audit:desktop` | Launches the real desktop app and checks it from the outside (see Desktop app). Needs `npm install` to have fetched Electron |
| `npm run audit:responsive` | Opens every screen in Edge/Chrome at phone, tablet and desktop widths and fails if anything makes the page wider than the screen. Needs Edge or Chrome installed (set `CHROME_PATH` if it isn't found); add `-- --shots=./shots` to save screenshots |

## Your data

HorrorHub has no backend. Your library, settings and API keys are stored in this browser's `localStorage`, so they are not synced anywhere and are lost if you clear site data.

- **Automatic backup:** in Chrome, Edge and other Chromium browsers, Settings → Backup & Import → *Choose backup folder* keeps a backup there (latest plus 7 daily copies), updated a few seconds after every change. Pick a folder inside OneDrive, Dropbox or iCloud to also protect against losing the computer. It saves your library, shelves, challenges, plans and settings (comfort limits, region, taste quiz), never your API keys.
- **Other browsers:** Settings → Backup & Import → *Export* downloads a JSON file, and HorrorHub reminds you when it has been a while.
- **Importing** (JSON, Letterboxd CSV, IMDb CSV) merges into your library after a preview. Nothing is deleted, empty fields never overwrite what you've curated, and tags and watch dates are combined.
- **API keys** (TMDb, OMDb, DoesTheDogDie) are stored here too, in plain text, and only ever sent to the service they belong to. Don't paste them on a shared computer, and export your library (not your settings) when sharing a backup.
- If the browser refuses to save (for example, storage is full), a banner tells you so and suggests exporting a backup.

## Credits
- **PumpBoy**, the mascot, was drawn by **totalnightmare**, who is happy for him to be used in HorrorHub. You can find TotalNightmar3 on [ArtFight](https://artfight.net/~TotalNightmar3). The artwork is hers; the code's license doesn't cover it.
- Movie data and images come from [TMDb](https://www.themoviedb.org/). This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.

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
