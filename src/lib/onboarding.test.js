import { describe, expect, it } from "vitest";
import { isOnboardingDone, nextStep, onboardingSteps, remainingSteps } from "./onboarding.js";
import { DEFAULT_SETTINGS } from "./settings.js";

const steps = (over = {}) =>
  onboardingSteps({ settings: { ...DEFAULT_SETTINGS, ...(over.settings || {}) }, library: over.library || [], signalCount: over.signalCount || 0 });
const byId = (list, id) => list.find((s) => s.id === id);

describe("onboardingSteps", () => {
  it("starts with nothing done for a new user, token first", () => {
    const s = steps();
    expect(s.map((x) => x.id)).toEqual(["token", "films", "rate", "comfort"]);
    expect(s.every((x) => !x.done)).toBe(true);
    expect(nextStep(s).id).toBe("token");
    expect(isOnboardingDone(s)).toBe(false);
  });

  it("ticks steps off as the user progresses", () => {
    expect(byId(steps({ settings: { apiKey: "tok" } }), "token").done).toBe(true);
    expect(byId(steps({ library: [{ id: 1 }] }), "films").done).toBe(true);
    expect(byId(steps({ signalCount: 2 }), "rate").done).toBe(false);
    expect(byId(steps({ signalCount: 3 }), "rate").done).toBe(true);
  });

  it("counts any comfort setting as done, and marks it optional", () => {
    expect(byId(steps(), "comfort").optional).toBe(true);
    expect(byId(steps({ settings: { avoidFlags: ["gore"] } }), "comfort").done).toBe(true);
    expect(byId(steps({ settings: { maxScares: 7 } }), "comfort").done).toBe(true);
    expect(byId(steps({ settings: { contentMode: "hide" } }), "comfort").done).toBe(true);
  });

  it("points to the first unfinished required step, then the optional one, then nothing", () => {
    const partial = steps({ settings: { apiKey: "tok" } });
    expect(nextStep(partial).id).toBe("films");
    const allRequired = steps({ settings: { apiKey: "tok" }, library: [{ id: 1 }], signalCount: 5 });
    expect(nextStep(allRequired).id).toBe("comfort");
    expect(remainingSteps(allRequired)).toHaveLength(1);
    const everything = steps({ settings: { apiKey: "tok", maxScares: 6 }, library: [{ id: 1 }], signalCount: 5 });
    expect(isOnboardingDone(everything)).toBe(true);
    expect(nextStep(everything)).toBeNull();
  });

  it("gives every step actions that go somewhere real, the first being the main one", () => {
    for (const s of steps()) {
      expect(s.actions.length).toBeGreaterThan(0);
      expect(s.action).toEqual(s.actions[0]);
      for (const a of s.actions) expect(["settings", "discover", "tonight", "rate"]).toContain(a.tab);
    }
  });

  it("counts the taste quiz as teaching it your taste, with or without rated films", () => {
    const quiz = { calibration: { answers: { "halloween-1978": "loved" }, doneAt: "2026-01-01T00:00:00.000Z" } };
    expect(byId(steps({ settings: quiz }), "rate").done).toBe(true);
    expect(byId(steps({ settings: { calibration: { answers: {}, doneAt: "" } } }), "rate").done).toBe(false);
    expect(byId(steps(), "rate").actions.map((a) => a.label)).toEqual(["Take the taste quiz", "Rate films"]);
  });

  it("offers a way to add films and a way to import them", () => {
    expect(byId(steps(), "films").actions.map((a) => a.tab)).toEqual(["discover", "settings"]);
  });
});
