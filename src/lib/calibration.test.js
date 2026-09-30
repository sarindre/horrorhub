import { describe, expect, it } from "vitest";
import { ANSWER_IDS, CALIBRATION_FILMS, calibrationSignals, normalizeCalibration, scareCeilingFrom, answeredCount } from "./calibration.js";
import { SUGGESTED_TAGS } from "./tagging.js";
import { buildTasteProfile, isLearning, rankLibrary, scoreLibraryItem } from "./taste.js";

describe("quiz films", () => {
  it("use only the app's tag vocabulary and unique keys", () => {
    expect(new Set(CALIBRATION_FILMS.map((f) => f.key)).size).toBe(CALIBRATION_FILMS.length);
    for (const f of CALIBRATION_FILMS) for (const t of f.tags) expect(SUGGESTED_TAGS).toContain(t);
  });
});

describe("normalizeCalibration", () => {
  it("keeps known films and answers, drops the rest", () => {
    const c = normalizeCalibration({ answers: { "exorcist-1973": "loved", nope: "loved", "halloween-1978": "meh" }, doneAt: "2026-01-02T00:00:00.000Z" });
    expect(c.answers).toEqual({ "exorcist-1973": "loved" });
    expect(c.doneAt).toBe("2026-01-02T00:00:00.000Z");
  });
  it("survives junk", () => {
    for (const bad of [null, undefined, 5, "x", [], { answers: 3, doneAt: 9 }]) expect(normalizeCalibration(bad)).toEqual({ answers: {}, doneAt: "" });
    expect(ANSWER_IDS).toContain("unseen");
  });
});

describe("calibrationSignals and ceiling", () => {
  const cal = { answers: { "exorcist-1973": "toomuch", "halloween-1978": "loved", "scream-1996": "unseen" }, doneAt: "x" };
  it("skips films you haven't seen", () => {
    expect(calibrationSignals(cal).map((s) => s.title).sort()).toEqual(["Halloween", "The Exorcist"]);
    expect(answeredCount(cal)).toBe(2);
  });
  it("sets the ceiling one below the mildest film that was too intense", () => {
    expect(scareCeilingFrom(cal)).toBe(8);
    expect(scareCeilingFrom({ answers: { "halloween-1978": "loved" } })).toBeNull();
  });
});

describe("taste profile with the quiz", () => {
  const cal = { answers: { "halloween-1978": "loved", "scream-1996": "loved", "tcm-1974": "loved", "hereditary-2018": "toomuch" }, doneAt: "x" };
  it("learns from answers before any rating exists", () => {
    const p = buildTasteProfile([], { calibration: cal });
    expect(p.signalCount).toBe(0);
    expect(p.seedCount).toBe(4);
    expect(p.likedTags.map((t) => t.tag)).toContain("slasher");
    expect(p.scarePref).toBeGreaterThan(5);
    expect(p.scareCeiling).toBe(8);
  });
  it("still says it is learning until there is real history, but sooner than with nothing", () => {
    expect(isLearning(buildTasteProfile([], { calibration: cal }))).toBe(true);
    const many = { answers: Object.fromEntries(CALIBRATION_FILMS.map((f) => [f.key, "loved"])), doneAt: "x" };
    expect(isLearning(buildTasteProfile([], { calibration: many }))).toBe(false); // 13 answers
  });
  it("ranks a slasher above an unrelated film for a slasher fan", () => {
    const slasher = { id: 1, title: "Slash", tags: ["slasher"], scares: 5 };
    const cosmic = { id: 2, title: "Void", tags: ["cosmic"], scares: 5 };
    const ranked = rankLibrary([cosmic, slasher], buildTasteProfile([], { calibration: cal }), { scare: 5 });
    expect(ranked[0].item.title).toBe("Slash");
  });
  it("marks down films above the ceiling", () => {
    const p = buildTasteProfile([], { calibration: cal });
    const mild = { id: 1, title: "A", tags: [], scares: 6, scaresRated: true };
    const harsh = { id: 2, title: "B", tags: [], scares: 10, scaresRated: true };
    expect(scoreLibraryItem(harsh, p, { scare: 8 }).score).toBeLessThan(scoreLibraryItem(mild, p, { scare: 8 }).score);
  });
  it("adds nothing without the quiz", () => {
    const p = buildTasteProfile([]);
    expect(p.seedCount).toBe(0);
    expect(p.scareCeiling).toBeNull();
  });
});
