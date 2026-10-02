# itch.io page

Free listing for the desktop installers. Decided so far: the project type is **Downloadable**, the classification is **Tools**, and pricing is **No payments** until TMDb answers the tips question (see [TIP-JAR.md](TIP-JAR.md)).

## Page settings
| Field | Value |
| --- | --- |
| Title | HorrorHub |
| Project URL | `horrorhub` (or what's free) |
| Short description / tagline | Your personal horror library. Local, dark, and entirely yours. |
| Kind of project | Downloadable |
| Classification | Tools |
| Pricing | No payments |
| Genre | whatever fits best, or none |
| Tags | horror, movies, tracker, utility, offline, local-first |
| Platforms | Windows, macOS, Linux (set automatically from the channel names below) |
| Community | comments on, no ads |

## Description (paste in)

**HorrorHub is a personal horror movie library for people who take horror seriously.**

Search any film, add it to your library, and keep your own record: ratings, notes, when you watched it, and how scared you actually were. Tag films by mood and subgenre. The app learns your taste from your ratings and tells you why it suggests each film. Bring your history from Letterboxd or IMDb.

- **Ask HorrorHub:** describe what you want ("a short, creepy ghost story I haven't seen") and it searches your library. It's a plain rule-based search; nothing leaves your device.
- **Scare levels and content warnings:** gore, animal harm and more shown on every film, with limits you set to warn or hide them.
- **Plan:** watchlists, marathons, themed challenges, a calendar, Group night and a Mystery reel for when you can't choose.
- **Insights and Wrapped:** your taste, streaks and badges over time.
- **Yours:** no account, no analytics, no ads. Your library stays on your computer, with export, import and an automatic backup folder.

**Before you start:** movie details and posters come from TMDB, so you need a free TMDB token. The app walks you through it in about 3 minutes (Settings → Connections).

**About the install warning:** the installers aren't code-signed yet, so Windows SmartScreen or macOS Gatekeeper may warn the first time.
- Windows: choose "More info", then "Run anyway".
- macOS: right-click the app, choose Open, then confirm. (Or System Settings → Privacy & Security → "Open Anyway".)
- Linux: make the AppImage executable (`chmod +x HorrorHub-*.AppImage`) and run it.

Prefer a browser? The same app runs at https://sarindre.github.io/horrorhub/ and can be installed on a phone.

It's free and open source: https://github.com/sarindre/horrorhub

*This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.* Privacy: https://github.com/sarindre/horrorhub/blob/main/PRIVACY.md

## Images
- **Cover image:** itch.io recommends about 630x500 (minimum 315x250). Needs original art.
- **Screenshots:** 3 to 5, from the real app (Library, Discover, Insights, a film's detail). Take them with real, fully horror-themed data, and check the posters for anything very graphic first.
- **Banner/background:** optional.

## Setting up automatic uploads
Uploading by hand works too: itch.io's Edit game page lets you upload the three installers directly. To have a version tag push them for you:

1. Create the project on itch.io (draft is fine) and note its address: `username/project-slug`.
2. Make an API key at https://itch.io/user/settings/api-keys (needed by `butler`, itch.io's upload tool).
3. In the GitHub repo, go to Settings → Secrets and variables → Actions:
   - **Secrets:** add `BUTLER_API_KEY` with the key.
   - **Variables:** add `ITCH_TARGET` with `username/project-slug`.
4. Push a version tag (`git tag v0.1.0 && git push origin v0.1.0`). The workflow builds the three installers, publishes the GitHub Release, and pushes each platform to the channels `windows`, `mac` and `linux`.

The first push to a channel creates it. Until the secret and variable exist the step just skips, so tagging never fails because of itch.io.

## Before going public
- [ ] The TMDB question is answered, or the page stays free with no payment option (it is today).
- [ ] Try each installer on the page from a fresh download.
- [ ] Original icon and cover art in place.
- [ ] Set the page to Public (it's Draft or Restricted until you do).
