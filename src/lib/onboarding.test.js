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

  it("gives every step an action that goes somewhere real", () => {
    for (const s of steps()) expect(["settings", "discover", "library"]).toContain(s.action.tab);
  });
});
