// Help text for the whole app, as plain data so it can be tested and searched.
// Keep it in step with the screens: a test makes sure every screen has an entry.
// Write for someone who has never seen the app: say what a thing is for, then what to press.

// One entry per screen (the ids are the view ids in lib/nav.js).
export const HELP = {
  tonight: {
    title: "Tonight",
    what: "One film from your own library for tonight, with the reasons it was picked, its scare level and any content warnings.",
    points: [
      "\"Another\" moves to a different film. \"Not for me\" stops that film being suggested here at all.",
      "\"Change\" sets how scared you want to be and the night's vibe. It starts at your usual level, and never above a limit you've set.",
      "The taste quiz (shown until HorrorHub has learned enough about you) takes about a minute and teaches it your taste and how scary is too scary.",
      "\"Pair with…\" suggests a second film for a double feature and loads both into the planner.",
      "Your streak and running challenges show under \"In progress\".",
    ],
    tips: ["Picks come from films you've added to your library, so add some in Discover first. Import from Letterboxd or IMDb in Settings if you already have a history."],
  },
  group: {
    title: "Group night",
    what: "Finds films from your library that everyone watching will be okay with.",
    points: [
      "Add 2 to 4 people. Each has a scare limit, content they want to avoid, and vibes they enjoy. Your own limits come from Settings.",
      "Limits are hard rules. Among the films that pass, the one that keeps the least-happy person happiest comes first, and the top pick says whose call the compromise is.",
      "\"Ruled out by limits\" shows what each person's limits removed, so nothing disappears silently.",
      "Tick \"has seen it\" on a film and it drops off the list. Save a guest to add them again next time.",
    ],
    tips: ["Warnings come from TMDb keywords, so check anything that really matters before pressing play."],
  },
  ask: {
    title: "Ask",
    what: "Describe what you want in your own words and HorrorHub searches your library, then can look on TMDb too.",
    points: [
      "It understands subgenres (folk horror, slasher), lengths (under 100 minutes), decades (from the 80s), how scary (gentle, terrifying), things to avoid (no animal harm, without gore) and your own lists (on my watchlist, haven't seen).",
      "The chips under the box show what it understood. \"I didn't use\" lists words it didn't recognise.",
      "\"Also look on TMDb\" finds films you don't own. It checks their warnings and drops any that break your exclusions, and says how many it left out. \"Show more films\" loads the next page.",
    ],
    tips: ["Scare level, rating and watched-or-not only apply to your library, because TMDb doesn't have that information.", "Nothing is sent to TMDb until you press its button, and then only length, years and subgenre keywords."],
  },
  discover: {
    title: "Browse",
    what: "Search TMDb for horror films and add them to your library or watchlist.",
    points: [
      "Type a title and press Enter, or use the buttons for popular, critically rated, newest, oldest, classics under 90 minutes, and upcoming releases.",
      "\"Add\" puts a film in your library (a message says where it went, and the card stays until the list changes). \"Watchlist\" marks it as something you want to see. \"Watched\" logs when you saw it.",
      "It loads 20 films at a time. \"Show more films\" at the bottom adds the next page below, and a line tells you how many your filters are hiding.",
      "\"Available on\" keeps only films streaming on the services you tick, for the country chosen in Settings.",
      "Click a title for its full page: cast, trailer, ratings and content warnings.",
    ],
    tips: ["This screen needs your free TMDb token (Settings → Connections)."],
  },
  rate: {
    title: "Rate films",
    what: "A quick way to teach HorrorHub your taste: rate popular horror films you've already seen.",
    points: [
      "Click the knives on a film to rate it. Rating a film adds it to your library, and a message tells you where it went. The card stays on screen so you can change your mind, and clears when you change page.",
      "Skip films you haven't seen. Use the page controls to move through the list.",
      "\"Hide already rated\", \"Skip titles in library\" and \"Skip watchlisted\" keep the list fresh.",
    ],
    tips: ["Right-click a knife for a half rating."],
  },
  library: {
    title: "All films",
    what: "Everything you track: rate, tag, review and log watches.",
    points: [
      "Search by title, pick a mood, or click tags to narrow down (click several to require all of them). \"Untagged\" finds films with no tags yet.",
      "\"Min rating\" and \"Max scares\" filter by your own ratings. \"Clear filters\" starts over.",
      "Tags marked ✦ were added automatically from TMDb data. Anything you add or remove yourself is kept.",
      "Use the heart to manage your watchlist, and click a title for its full page.",
    ],
    tips: ["Right-click a knife for a half rating.", "If your content limits are set to hide films, a notice says how many are hidden and lets you show them."],
  },
  shelves: {
    title: "Shelves",
    what: "Your own named lists of films, plus collections HorrorHub curates from your taste.",
    points: [
      "Create a shelf, then add films to it from a film's page (\"Add to shelf\").",
      "\"Curated for you\" builds collections like \"Top picks for your Occult mood\", \"Your best Slashers\" and \"Time for a rewatch\".",
      "Share a shelf as a file or as a text list. No account is needed. Import a shelf file someone sent you.",
    ],
    tips: [],
  },
  recs: {
    title: "Tune your picks",
    what: "The workshop behind Tonight: adjust how scared, which vibe and which subgenres you want, and see two lists of suggestions.",
    points: [
      "The slider sets how scared you want to be. \"Match my usual\" jumps to the level of films you tend to love.",
      "\"Your taste\" shows what HorrorHub has learned from your ratings, watches and quiz answers.",
      "\"Night vibe\" and the Subgenre Mixer (Ghosts, Occult, Slasher, Folk) lean the picks towards what you're in the mood for.",
      "\"Similar to your favorites\" comes from TMDb. \"From your library, for tonight\" ranks films you already own. Every suggestion says why.",
      "\"Cold Night Roulette\" picks a short classic (before 1985, under 90 minutes) at random.",
    ],
    tips: ["For a quick answer without any of this, use Tonight."],
  },
  continuity: {
    title: "Because you liked…",
    what: "Pick a film you love and see a map of films like it, and films like those.",
    points: ["Choose a film from your library and press \"Build Map\". Click a film on the map to open it."],
    tips: ["This screen needs your free TMDb token (Settings → Connections)."],
  },
  watchlist: {
    title: "Watchlist & plans",
    what: "Plan what to watch and when: a marathon for one night, a weekly schedule, and calendar files.",
    points: [
      "The marathon planner picks a lineup for one night: choose where from, a theme, how many films, how much time and how the scare level should flow (build up, peak then wind down, or ebb and flow).",
      "\"Shuffle\" gives a different lineup. \"Save plan\" keeps it. \"Download .ics\" adds it to your calendar app.",
      "The weekly watch plan spreads your watchlist over the days and time you set in Settings.",
      "Films over your content limits are left out of plans (or flagged, depending on your setting).",
    ],
    tips: ["\"Pair with…\" on a film's page sends a double feature here, with its two films already chosen."],
  },
  challenges: {
    title: "Challenges",
    what: "Themed goals like 30 Days of Horror or Found-Footage Week. Progress comes from your watch dates, so logging a watch anywhere moves every challenge.",
    points: [
      "\"Start\" begins a challenge. One that hasn't started yet has \"Start today\" to begin straight away.",
      "\"Plan my days\" in the Daily plan picks a film for each night, building from gentle to intense. Swap any night, fill open nights from your library, or download the plan for your calendar.",
      "\"Build my watch list\" suggests films from your library that count. \"Find ideas on TMDb\" suggests films you don't own yet.",
      "A streak counts days in a row with a logged watch.",
    ],
    tips: ["A plan is only an intention: watching something else never breaks a challenge."],
  },
  stats: {
    title: "Stats",
    what: "What your library says about you.",
    points: [
      "\"What your habits say\" shows patterns in your own ratings and watches. Each says how many films it's based on, and it needs about five films to start.",
      "\"Horror Wrapped\" is your year in horror. Save it as an image or copy it as text. It's made on your device and nothing is uploaded.",
      "\"Rank and badges\" turns watches into XP: 10 per watch, plus 5 for each day of a live streak after the first.",
      "The heatmap, scare-versus-rating chart and tag matrix show the rest.",
    ],
    tips: ["Scare levels without your own rating are estimates and are labelled \"est.\"."],
  },
  settings: {
    title: "Preferences",
    what: "Connections, comfort limits, appearance, and keeping your library safe.",
    points: [
      "Connections: paste your free TMDb token (needed for search, posters and suggestions), choose where you watch, and add the optional OMDb and DoesTheDogDie keys.",
      "Catalog & Content: turn auto-tagging on or off and set content limits: which content to avoid, a maximum scare level, and whether films over your limits are flagged or hidden.",
      "Backup & Import: choose a backup folder so a copy is saved after every change, install the app, export, and import from Letterboxd or IMDb.",
      "Appearance: theme, the spooky font, effects, high contrast and a dyslexia-friendly font.",
      "Reset app (at the bottom) erases everything HorrorHub has stored in this browser. It asks you to type RESET, offers to export a backup first, and can keep your settings and API keys.",
    ],
    tips: ["Your library lives only in this browser, so set up a backup."],
  },
  help: {
    title: "Help",
    what: "Everything explained in one place.",
    points: ["Search for a word, read how each screen works, check the glossary, or turn the first-visit tips off."],
    tips: [],
  },
};

// Words and labels you'll see around the app.
export const GLOSSARY = [
  { term: "Scare level", meaning: "How frightening a film is, from 0 to 10. Your own rating (the slider on a film) or your scare diary always counts first." },
  { term: "est.", meaning: "Short for estimated. A scare level is estimated from a film's tags and warnings until you set one yourself, and adjusted to how scared you tend to get. A runtime marked est. is a guess of 100 minutes until it's looked up." },
  { term: "Tags and ✦", meaning: "Subgenre labels such as slasher, folk-horror or slow-burn. A ✦ means HorrorHub added the tag automatically from TMDb data. Your own edits always win." },
  { term: "Content warnings", meaning: "Categories such as gore, animal harm or torture, worked out from TMDb keywords. They name a category and never spoil a plot. They can miss things, so an absent warning is not a guarantee." },
  { term: "Content limits", meaning: "The categories and maximum scare level you want to avoid (Settings). Films over your limits are either flagged (\"Warn me\") or kept out of sight (\"Hide them\")." },
  { term: "Library and watchlist", meaning: "The library is every film you track. The watchlist is the ones you want to see. Logging a watch takes a film off the watchlist." },
  { term: "Taste profile", meaning: "What HorrorHub has learned about you from your ratings, watches, tags and taste quiz. It's used to rank suggestions, and every suggestion says why." },
  { term: "Scare diary", meaning: "An optional note when you log a watch: how scared you actually were, who with, and when. HorrorHub uses it to learn how scary things are for you." },
  { term: "Streak", meaning: "Days in a row with a logged watch. A streak is still alive if it ended yesterday." },
  { term: "XP and rank", meaning: "10 XP for every logged watch, plus 5 for each day of a live streak after the first. XP moves you up the ranks from Fresh Meat to Elder God." },
  { term: "Pacing", meaning: "How the scare level flows across a marathon: building up to the scariest film last, peaking then winding down, or ebbing and flowing." },
  { term: "TMDb token", meaning: "A free key from themoviedb.org (Settings → API → \"API Read Access Token\") that lets HorrorHub fetch film details, posters and suggestions. It's stored only in this browser." },
  { term: "Local-first", meaning: "Your library, ratings and settings are stored in this browser on this device, with no account. That's private, but it means a backup matters." },
];

// Questions people ask.
export const FAQ = [
  { q: "Where is my data, and how do I keep it safe?", a: "In this browser on this device. In Settings → Backup & Import, choose a backup folder (Chrome, Edge and other Chromium browsers) and a copy is saved after every change. Elsewhere, use Export now and then, and HorrorHub will remind you when it's been a while." },
  { q: "How do I move to another device?", a: "Export on the old one (Settings → Backup & Import) and Import the file on the new one. Importing merges your films and never deletes any, and asks before replacing your settings with the ones in the file. Your TMDb token and other API keys are never included, so paste them in again." },
  { q: "How do I get a TMDb token?", a: "Create a free account at themoviedb.org, open Settings → API, and copy the long \"API Read Access Token\". Paste it into HorrorHub under Settings → Connections." },
  { q: "Why does a scare level say \"est.\"?", a: "You haven't set one for that film, so HorrorHub estimated it from the film's tags and warnings. Move the Scare slider on the film, or log how scared you were, and it becomes yours." },
  { q: "Why can't I see some films?", a: "Check the filters at the top of the screen, and whether your content limits are set to hide films (Settings). Discover and Rate films also have \"Skip titles in library\" style checkboxes." },
  { q: "How do I log a film I saw years ago?", a: "On a film's card (in All films or Browse), press \"Watched\" and choose \"Watched long ago\". It counts as seen without inventing a date." },
  { q: "How do I start over?", a: "Settings → Preferences → Reset app, at the bottom. It erases your library, settings and everything else HorrorHub stores in this browser, after you type RESET. Export a backup first if you might want your films back. Files in a backup folder are never touched." },
  { q: "How do I give half-star ratings?", a: "Right-click a knife." },
  { q: "Can I use it without internet, or install it?", a: "Yes. Your library and every screen work offline once the app has loaded; searching TMDb needs a connection. Install it from Settings → Backup & Import, or from your browser's menu." },
  { q: "Is anything uploaded?", a: "No account and no server of ours. Requests go only to TMDb (and to OMDb or DoesTheDogDie if you add their keys), using your own keys. Backups, exports and the Wrapped image stay on your device." },
  { q: "Why is a picked film over my limits?", a: "In \"Warn me\" mode films over your limits still appear, with the warning shown. Switch to \"Hide them\" in Settings → Catalog & Content to keep them out of sight." },
];

// Keyboard and links.
export const SHORTCUTS = [
  "In the top bar, use the left and right arrow keys to move between sections, and Home or End to jump to the first or last.",
  "The same keys move between the small tabs under a section, such as Browse, Rate films and Ask.",
  "Each screen has its own web address (for example #library), so the browser's Back button and bookmarks work.",
];

// Case-insensitive search over everything above. Returns what matches, so the
// Help screen can show just that.
export function searchHelp(query, { views = Object.keys(HELP) } = {}) {
  const q = String(query || "").trim().toLowerCase();
  const has = (...parts) => !q || parts.flat().some((p) => String(p).toLowerCase().includes(q));
  return {
    screens: views.filter((id) => HELP[id] && has(HELP[id].title, HELP[id].what, HELP[id].points, HELP[id].tips)),
    glossary: GLOSSARY.filter((g) => has(g.term, g.meaning)),
    faq: FAQ.filter((f) => has(f.q, f.a)),
  };
}
