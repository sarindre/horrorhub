import { describe, expect, it } from "vitest";
import { DEFAULT_VIEW, NAV, VIEW_IDS, groupOf, isView, stepIndex } from "./nav.js";

describe("nav model", () => {
  it("groups the ten views into six sections", () => {
    expect(NAV).toHaveLength(6);
    expect(VIEW_IDS).toHaveLength(10);
    expect(new Set(VIEW_IDS).size).toBe(10); // no view is listed twice
  });

  it("keeps every view id the app already uses", () => {
    for (const id of ["discover", "library", "shelves", "watchlist", "recs", "rate", "continuity", "challenges", "stats", "settings"]) expect(isView(id)).toBe(true);
    expect(isView("nope")).toBe(false);
    expect(isView("")).toBe(false);
    expect(isView(undefined)).toBe(false);
  });

  it("finds a view's section, falling back to the first for an unknown id", () => {
    expect(groupOf("rate").id).toBe("discover");
    expect(groupOf("shelves").id).toBe("library");
    expect(groupOf("continuity").id).toBe("foryou");
    expect(groupOf("challenges").id).toBe("plan");
    expect(groupOf("watchlist").id).toBe("plan");
    expect(groupOf("bogus")).toBe(NAV[0]);
  });

  it("opens each section on its first view, and the app on Discover", () => {
    expect(NAV.map((g) => g.views[0].id)).toEqual(["discover", "library", "recs", "watchlist", "stats", "settings"]);
    expect(DEFAULT_VIEW).toBe("discover");
  });

  it("uses distinct labels so tabs can be told apart", () => {
    const labels = [...NAV.map((g) => g.label), ...NAV.filter((g) => g.views.length > 1).flatMap((g) => g.views.map((v) => v.label))];
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("wraps around when stepping through tabs", () => {
    expect(stepIndex(0, -1, 6)).toBe(5);
    expect(stepIndex(5, 1, 6)).toBe(0);
    expect(stepIndex(2, 1, 6)).toBe(3);
  });
});
