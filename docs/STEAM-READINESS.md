# Steam readiness

A working checklist for releasing HorrorHub on Steam. It records what was checked against Steam's and TMDb's own pages (October 2026), what is still unknown, and what has to be decided before paying anything. Rules change, so re-check a source before relying on it.

## The short version
Technically HorrorHub is close: it runs as a desktop app on Windows, macOS and Linux (see the README). What stands between it and Steam is mostly **not code**:

1. **TMDb's terms.** Selling an app that uses TMDb needs a written agreement with them (see [TMDB-EMAIL.md](TMDB-EMAIL.md)). A free app may be fine; ask.
2. **Whether Steam accepts this kind of app.** See "Unknown: category" below.
3. **A way for strangers to get movie data** without making their own TMDb account.
4. A little over a month of waiting that can't be skipped.

## What was verified

| Fact | Source |
| --- | --- |
| **$100 fee per app**, non-refundable, recouped once the app earns $1,000 | Steam Direct page |
| Bank details and a **tax questionnaire** are needed; the account holder's name must match legal ID. Tax details are verified by a third party, **10 to 15 business days** | Steam Direct + onboarding pages |
| A **1 to 5 day review** of the store page and build | both pages |
| A **public "coming soon" page for at least two weeks** before release | both pages |
| A minimum wait between paying the fee and releasing: **21 days** on the onboarding page, **30 days** on the Steam Direct page (the pages disagree; plan for 30) | both pages |
| **Prohibited:** hate speech, "nude or sexually explicit images of real people", unlabeled adult content, malware, cryptocurrency applications, **advertising-based business models** | onboarding page |
| TMDb: "Selling an Application that uses TMDB or the TMDB APIs..." and "Charging users a fee for Your Application" are not allowed without a separate written agreement | TMDb API terms |
| TMDb commercial plan is reported to be about **$149/month** (under $1M revenue, under 2M users). This came from forum posts, not TMDb's own site: **confirm it** | TMDb forum threads |
| TMDb requires its **logo** and the wording "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB." (done) | TMDb terms and logo page |

Not found: Steam's revenue share (commonly said to be 30%; check Steamworks before pricing).

## Unknown: category
Steam's onboarding page describes accepted non-game software as "animation, audio/video production, educational tools, and SteamVR utilities". A personal movie library and planner is not clearly any of these. **Before paying the $100, find out whether Steam accepts this kind of app** (look at comparable media-tracking or utility apps on Steam, read Steam's current software rules, and ask Valve through the support channel Steamworks provides). If it isn't accepted, the fee is lost, so this is the first gate.

## Decisions to make
- **Free or paid?** Paid needs the TMDb agreement (and probably the paid plan plus a small server to hold the key). Free may not. A free Steam listing still costs the $100.
- **Where does movie data come from for a stranger?** Today each user pastes their own TMDb token (fine for a free hobby app; a hurdle for retail). Options: keep that with the guided setup (done), license TMDb and run a small proxy, or build a dataset (large; see the conversation notes: Wikidata is the main open source, with no keywords, summaries or posters).
- **Repository license.** The code is public on GitHub with no license file, which means all rights are reserved by default. If you plan to sell, decide deliberately between keeping it closed and an open license (an open license lets anyone else sell it too).
- **Name.** Search for existing uses of "HorrorHub" (apps, sites, trademarks) before investing in branding.
- **Art.** The current icon is a system emoji on a gradient. A release needs original art and a proper logo (and all the store assets below).

## Store assets (Steam's required sizes)
| Asset | Size |
| --- | --- |
| Header capsule | 920 x 430 |
| Small capsule | 462 x 174 |
| Main capsule | 1232 x 706 |
| Vertical capsule | 748 x 896 |
| Screenshots | at least 1920 x 1080 (16:9), several |
| Page background (optional) | 1438 x 810 |
| Shortcut icon | 256 x 256 (.ico or .png) |
| App icon | 184 x 184 (.jpg) |
| Library capsule | 600 x 900 |
| Library hero | 3840 x 1240 (.png) |
| Library logo | 1280 px wide and/or 720 px tall (.png) |
| Library header capsule | 920 x 430 |
| Event cover | 800 x 450 |

Also needed: short and long descriptions, a trailer (strongly advised), tags, a privacy policy link (see [PRIVACY.md](../PRIVACY.md)), and the content survey.

## Content risk: posters
HorrorHub shows posters supplied by TMDb. The app already asks TMDb to leave out adult titles, but horror posters can be graphic. Steam prohibits "nude or sexually explicit images of real people" and expects honest content labels. Mitigations to build or check: a setting to hide posters, the content survey answered conservatively, and spot-checking the screenshots used on the store page.

## Engineering still to do for Steam
- **Steamworks integration** (the usual route with Electron is a library such as `steamworks.js`): initialize Steam, and run only when launched from Steam.
- **Achievements:** the 16 badges map naturally (Folk Horror Initiate, 80s Slasher Fan, Midnight Marathon, Ghost Hunter, Occult Scholar, Found Footage Addict, Gore Hound, Vamp Acolyte, Zombie Survivalist, Classic Connoisseur, New Blood, Speed Watcher, Reviewer, Tag Master, Curator, Knife Juggler), plus rank-ups.
- **Steam Cloud:** HorrorHub's data lives in the browser engine's storage, which is not a file Steam can sync. The desktop app needs to write a plain JSON save file (the existing export format) to its data folder, and Steam Auto-Cloud can then sync that one file. This also gives a desktop-native backup. It needs a small native bridge, which doesn't exist yet.
- **No tip links or ads in the Steam build** until Steam's rules on external payment links are checked (see [TIP-JAR.md](TIP-JAR.md)).
- **Build and depot setup** in Steamworks, and a build per platform (the GitHub workflow already makes them).
- **Optional:** controller navigation and Steam Deck support (the app is built for mouse, keyboard and touch today), code signing, and the overlay.

## A sensible order
1. Ask TMDb (draft in [TMDB-EMAIL.md](TMDB-EMAIL.md)) and find out whether Steam accepts the category. **Do not pay anything yet.**
2. Get real users on the web and desktop versions; fix what they hit.
3. Decide free or paid; settle name, art and license.
4. Only then: pay the $100, finish the tax paperwork (allow 2 to 3 weeks), publish the "coming soon" page, and build the Steam features while the waiting periods run.
5. Release, ideally outside the busy October window unless the wishlist campaign started months earlier.
