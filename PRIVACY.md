# Privacy

*Draft. Not legal advice. Review and update it before any store release, and whenever the app changes what it sends.*

HorrorHub is built to keep your information on your own device.

## What stays on your device
Your library, ratings, notes, tags, watch dates and scare diary, shelves, challenges, plans, settings and API keys are stored **only on the device you use** (in the browser's storage, or in the desktop app's data folder). There are no accounts and no HorrorHub servers, so nothing about you is sent to the developer.

If you choose an automatic backup folder or press Export, the files are written where you choose. They are never uploaded anywhere by HorrorHub. Exports and backups contain your library and settings but **never your API keys**.

## What HorrorHub sends over the internet
HorrorHub contacts these services, only when a feature needs them, using your own key where one is needed:

| Service | What is sent | Why |
| --- | --- | --- |
| **TMDB** (api.themoviedb.org, image.tmdb.org) | Film titles or ids you search or open, and your TMDB token. Poster images are requested from their image servers | Film details, posters, keywords, suggestions |
| **OMDb** (optional) | A film's IMDb id and your OMDb key | Only if you add an OMDb key: IMDb and Rotten Tomatoes ratings |
| **DoesTheDogDie** (optional) | A film's id and your key | Only if you add a key: content details |
| **GitHub Pages** (web version only) | Your browser asks GitHub to send the app's files | GitHub may keep ordinary server logs (such as IP address). See GitHub's privacy statement |

Those services have their own privacy policies and see your network address when your device contacts them. HorrorHub adds no analytics, advertising or tracking of its own, and loads no third-party fonts or scripts.

## Things kept to make the app work offline
To work without internet, HorrorHub keeps some TMDB responses and posters you have viewed on your device (for example a day's recommendation lists and a few hundred posters). The "Reset app" button in Settings erases all of it, along with everything else the app stores.

## Your control
- **Export** gives you your data in a file at any time. **Import** brings it back.
- **Reset app** (Settings → Preferences) erases everything HorrorHub stores on the device.
- Removing your API keys (or never adding them) stops all requests that use them.
- Nothing is ever shared with other people unless you export a file or shelf and send it yourself.

## Children
HorrorHub is a horror-themed app. It has no accounts and collects no personal information, but the films it lists are often not suitable for children.

## Changes
If this changes, the new version will be in this file in the repository, with the date.

## Contact
Questions: open an issue at https://github.com/sarindre/horrorhub/issues
