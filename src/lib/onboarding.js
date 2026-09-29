// First-run checklist: what a new user needs to do to get the most out of the
// app, and how far along they are. Pure; the UI is components/GettingStarted.

export const RATED_FILMS_TARGET = 3;

// `signalCount` is how many films you've rated or watched (from the taste profile).
export function onboardingSteps({ settings, library, signalCount }) {
  return [
    {
      id: "token",
      title: "Add your TMDb token",
      detail: "It's free: create an account at themoviedb.org, then Settings → API, and copy the long \"API Read Access Token\". It unlocks search, posters, suggestions and auto-tagging.",
      done: !!settings.apiKey,
      action: { label: "Open Settings", tab: "settings" },
    },
    {
      id: "films",
      title: "Add some films",
      detail: "Search Discover for horror you've seen or want to see, or bring your history over from Letterboxd or IMDb in Settings → Backup & Import.",
      done: library.length > 0,
      action: { label: "Browse Discover", tab: "discover" },
    },
    {
      id: "rate",
      title: `Rate ${RATED_FILMS_TARGET} films you've watched`,
      detail: "Ratings and watch dates teach HorrorHub what you like, so recommendations and \"tonight's picks\" fit your taste.",
      done: signalCount >= RATED_FILMS_TARGET,
      action: { label: "Open My Library", tab: "library" },
    },
    {
      id: "comfort",
      title: "Set your comfort limits",
      detail: "Optional. Choose which content warnings to avoid (animal harm, gore...) and whether films over your limits are flagged or hidden.",
      done: (settings.avoidFlags || []).length > 0 || settings.maxScares < 10 || settings.contentMode === "hide",
      optional: true,
      action: { label: "Open Settings", tab: "settings" },
    },
  ];
}

export const remainingSteps = (steps) => steps.filter((s) => !s.done);
export const isOnboardingDone = (steps) => remainingSteps(steps).length === 0;
// The one thing to do next: the first unfinished required step, else the first optional one.
export const nextStep = (steps) => steps.find((s) => !s.done && !s.optional) || steps.find((s) => !s.done) || null;
