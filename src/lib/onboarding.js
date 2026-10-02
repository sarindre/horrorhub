// First-run guide: what a new user needs to do to get the most out of the app, and how far
// along they are. Pure; the UI is components/GettingStarted, which shows one step at a time.

import { isCalibrated } from "./calibration.js";

export const RATED_FILMS_TARGET = 3;

// `signalCount` is how many films you've rated or watched (from the taste profile).
// Each step has `actions` (the first is the main one) that jump to the right screen.
export function onboardingSteps({ settings, library, signalCount }) {
  const steps = [
    {
      id: "token",
      title: "Add your TMDb token",
      detail: "It's free and takes about 3 minutes; Settings has a step-by-step guide. It unlocks search, posters, suggestions and auto-tagging.",
      done: !!settings.apiKey,
      actions: [{ label: "Open Settings", tab: "settings" }],
    },
    {
      id: "films",
      title: "Add some films",
      detail: "Search Browse for horror you've seen or want to see, or bring your history over from Letterboxd or IMDb in Settings → Backup & Import.",
      done: library.length > 0,
      actions: [{ label: "Browse films", tab: "discover" }, { label: "Import a history", tab: "settings" }],
    },
    {
      id: "rate",
      title: "Teach HorrorHub your taste",
      detail: "Take the 60-second quiz on Tonight, or rate films you've watched. It learns what you like and how scary is too scary, so picks fit you.",
      done: signalCount >= RATED_FILMS_TARGET || isCalibrated(settings.calibration),
      actions: [{ label: "Take the taste quiz", tab: "tonight", intent: "quiz" }, { label: "Rate films", tab: "rate" }],
    },
    {
      id: "comfort",
      title: "Set your comfort limits",
      detail: "Optional. Choose which content warnings to avoid (animal harm, gore...) and whether films over your limits are flagged or hidden.",
      done: (settings.avoidFlags || []).length > 0 || settings.maxScares < 10 || settings.contentMode === "hide",
      optional: true,
      actions: [{ label: "Open Settings", tab: "settings" }],
    },
  ];
  return steps.map((s) => ({ ...s, action: s.actions[0] }));
}

export const remainingSteps = (steps) => steps.filter((s) => !s.done);
export const isOnboardingDone = (steps) => remainingSteps(steps).length === 0;
// The one thing to do next: the first unfinished required step, else the first optional one.
export const nextStep = (steps) => steps.find((s) => !s.done && !s.optional) || steps.find((s) => !s.done) || null;
