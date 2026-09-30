import { describe, expect, it } from "vitest";
import { estimateScare, isScareRated, scareBias, scareOf } from "./scare.js";

const film = (over = {}) => ({ id: 1, title: "F", tags: [], contentFlags: [], keywords: [], scares: 5, ...over });

describe("isScareRated", () => {
  it("trusts the marker when present", () => {
    expect(isScareRated(film({ scaresRated: true, scares: 5 }))).toBe(true);
    expect(isScareRated(film({ scaresRated: false, scares: 8 }))).toBe(false);
  });
  it("treats a bare 5 as never rated and any other number as yours (older libraries)", () => {
    expect(isScareRated(film({ scares: 5 }))).toBe(false);
    expect(isScareRated(film({ scares: 8 }))).toBe(true);
    expect(isScareRated(film({ scares: 0 }))).toBe(true);
  });
});

describe("estimateScare", () => {
  it("has no signals for an untagged film", () => {
    expect(estimateScare(film())).toEqual({ value: 5, signals: 0 });
  });
  it("rates brutal subgenres above gentle ones", () => {
    const brutal = estimateScare(film({ tags: ["gore", "disturbing", "possession"] }));
    const gentle = estimateScare(film({ tags: ["campy", "classic"] }));
    expect(brutal.value).toBeGreaterThanOrEqual(8);
    expect(gentle.value).toBeLessThanOrEqual(3);
  });
  it("counts a tag and the same content flag once", () => {
    expect(estimateScare(film({ tags: ["gore"], contentFlags: ["gore"] })).signals).toBe(1);
  });
  it("marks horror comedies as light", () => {
    expect(estimateScare(film({ tags: ["slasher"], keywords: ["horror comedy"] })).value).toBeLessThan(estimateScare(film({ tags: ["slasher"] })).value);
  });
  it("stays between 1 and 9", () => {
    expect(estimateScare(film({ tags: ["gore", "body-horror", "disturbing", "torture", "extreme-violence", "possession"] })).value).toBe(9);
    expect(estimateScare(film({ tags: ["campy", "classic", "arthouse"], keywords: ["parody"] })).value).toBe(1);
  });
});

describe("scareOf", () => {
  it("returns your rating untouched", () => {
    expect(scareOf(film({ scares: 7, tags: ["campy"] }))).toMatchObject({ value: 7, estimated: false });
  });
  it("estimates when unrated, and says so", () => {
    expect(scareOf(film({ tags: ["gore"] }))).toMatchObject({ value: 6, estimated: true });
  });
  it("falls back to the neutral 5 with no clues", () => {
    expect(scareOf(film())).toMatchObject({ value: 5, estimated: true, signals: 0 });
  });
  it("applies your bias to estimates only", () => {
    expect(scareOf(film({ tags: ["gore"] }), { bias: 2 }).value).toBe(8);
    expect(scareOf(film({ scares: 3 }), { bias: 2 }).value).toBe(3);
  });
});

describe("scareBias", () => {
  const rated = (tags, scares) => film({ tags, scares, scaresRated: true });
  it("is zero without enough rated films", () => {
    expect(scareBias([rated(["gore"], 9), rated(["gore"], 9)])).toBe(0);
  });
  it("is positive when you rate scarier than the estimates", () => {
    const items = [1, 2, 3, 4, 5, 6].map(() => rated(["gore"], 9)); // estimate is 6
    const bias = scareBias(items);
    expect(bias).toBeGreaterThan(1);
    expect(bias).toBeLessThanOrEqual(2);
  });
  it("is negative when horror hits you softer", () => {
    expect(scareBias([1, 2, 3, 4].map(() => rated(["gore"], 3)))).toBeLessThan(0);
  });
  it("ignores films the estimator knows nothing about", () => {
    expect(scareBias([1, 2, 3, 4].map(() => rated([], 9)))).toBe(0);
  });
});
