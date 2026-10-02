import { describe, expect, it } from "vitest";
import { diaryScare, mergeDiary, normalizeDiary, normalizeEntry, withDiaryEntry, withoutDiaryEntry } from "./diary.js";
import { normalizeItem, mergeLibraries } from "./library.js";
import { watchPatch } from "./watch.js";
import { estimateScare, scareBias, scareOf } from "./scare.js";

const film = (over = {}) => ({ id: 1, title: "F", year: 2010, tags: [], scares: 5, watchedDates: [], ...over });
const at = (y, m, d) => new Date(y, m - 1, d, 21).toISOString();

describe("normalizeEntry", () => {
  it("keeps what's valid and drops what isn't", () => {
    expect(normalizeEntry({ day: "2026-01-02", scared: 7.4, company: "friends", when: "late", junk: 1 })).toEqual({ day: "2026-01-02", scared: 7, company: "friends", when: "late" });
    expect(normalizeEntry({ day: "2026-01-02", scared: 99 })).toEqual({ day: "2026-01-02", scared: 10 });
    expect(normalizeEntry({ day: "2026-01-02", scared: -3 })).toEqual({ day: "2026-01-02", scared: 0 });
    expect(normalizeEntry({ day: "2026-01-02", scared: "", company: "robots", when: "never" })).toBeNull();
  });
  it("keeps a zero, which means 'not scared at all'", () => {
    expect(normalizeEntry({ day: "2026-01-02", scared: 0 })).toEqual({ day: "2026-01-02", scared: 0 });
  });
  it("needs a real day", () => {
    expect(normalizeEntry({ scared: 5 })).toBeNull();
    expect(normalizeEntry({ day: "2026-13-45", scared: 5 })).toBeNull();
    expect(normalizeEntry(null)).toBeNull();
  });
});

describe("normalizeDiary", () => {
  it("sorts, dedupes by day and survives junk", () => {
    const d = normalizeDiary([{ day: "2026-03-01", scared: 3 }, "x", { day: "2026-01-01", scared: 8 }, { day: "2026-03-01", scared: 9 }]);
    expect(d).toEqual([{ day: "2026-01-01", scared: 8 }, { day: "2026-03-01", scared: 3 }]);
    expect(normalizeDiary("nope")).toEqual([]);
  });
});

describe("withDiaryEntry / withoutDiaryEntry", () => {
  it("adds an entry for the local day of the watch, replacing that day's", () => {
    const first = withDiaryEntry([], at(2026, 5, 6), { scared: 4, company: "alone" });
    expect(first).toEqual([{ day: "2026-05-06", scared: 4, company: "alone" }]);
    expect(withDiaryEntry(first, at(2026, 5, 6), { scared: 8 })).toEqual([{ day: "2026-05-06", scared: 8 }]);
  });
  it("ignores an empty note", () => {
    expect(withDiaryEntry([{ day: "2026-01-01", scared: 3 }], at(2026, 5, 6), {})).toEqual([{ day: "2026-01-01", scared: 3 }]);
  });
  it("removes an entry by day", () => {
    expect(withoutDiaryEntry([{ day: "2026-01-01", scared: 3 }, { day: "2026-02-01", scared: 4 }], "2026-01-01")).toEqual([{ day: "2026-02-01", scared: 4 }]);
  });
});

describe("mergeDiary", () => {
  it("keeps your entries, fills gaps and adds new days", () => {
    const merged = mergeDiary([{ day: "2026-01-01", scared: 5 }], [{ day: "2026-01-01", scared: 9, company: "alone" }, { day: "2026-02-01", when: "late" }]);
    expect(merged).toEqual([{ day: "2026-01-01", scared: 5, company: "alone" }, { day: "2026-02-01", when: "late" }]);
  });
});

describe("diaryScare", () => {
  it("averages what you said", () => {
    expect(diaryScare(film({ diary: [{ day: "2026-01-01", scared: 6 }, { day: "2026-02-01", scared: 9 }] }))).toBe(8); // 7.5 rounds up
    expect(diaryScare(film({ diary: [{ day: "2026-01-01", company: "alone" }] }))).toBeNull();
    expect(diaryScare(film())).toBeNull();
  });
});

describe("on a film", () => {
  it("is kept by normalizeItem, and left off when empty", () => {
    expect(normalizeItem(film({ diary: [{ day: "2026-01-01", scared: 3 }, { day: "bad" }] })).diary).toEqual([{ day: "2026-01-01", scared: 3 }]);
    expect(normalizeItem(film({ diary: [] })).diary).toBeUndefined();
  });
  it("survives an import: entries from both sides are kept", () => {
    const existing = [film({ diary: [{ day: "2026-01-01", scared: 5 }] })];
    const { items } = mergeLibraries(existing, [film({ diary: [{ day: "2026-01-01", scared: 9 }, { day: "2026-02-01", scared: 2 }] })]);
    expect(items[0].diary).toEqual([{ day: "2026-01-01", scared: 5 }, { day: "2026-02-01", scared: 2 }]);
  });
  it("an import without a diary doesn't wipe yours", () => {
    const { items } = mergeLibraries([film({ diary: [{ day: "2026-01-01", scared: 5 }] })], [film({ rating: 4 })]);
    expect(items[0].diary).toHaveLength(1);
  });
});

describe("watchPatch with a diary note", () => {
  it("logs the watch and the note together", () => {
    const patch = watchPatch(film(), at(2026, 5, 6), { scared: 7, company: "partner" });
    expect(patch.watchedDates).toEqual([at(2026, 5, 6)]);
    expect(patch.watchlist).toBe(false);
    expect(patch.diary).toEqual([{ day: "2026-05-06", scared: 7, company: "partner" }]);
  });
  it("leaves the diary alone when there's no note", () => {
    expect(watchPatch(film(), at(2026, 5, 6)).diary).toBeUndefined();
  });
  it("keeps earlier entries", () => {
    const patch = watchPatch(film({ diary: [{ day: "2026-01-01", scared: 4 }] }), at(2026, 5, 6), { scared: 6 });
    expect(patch.diary).toHaveLength(2);
  });
});

describe("the diary changes scare levels", () => {
  const gory = (over) => film({ scaresRated: false, scares: 5, tags: ["gore", "disturbing"], ...over }); // estimated 7-8
  it("replaces an estimate with what you said, and says it isn't an estimate", () => {
    const s = scareOf(gory({ diary: [{ day: "2026-01-01", scared: 3 }] }));
    expect(s).toMatchObject({ value: 3, estimated: false, source: "diary" });
  });
  it("a scare rating you set yourself still wins", () => {
    expect(scareOf(gory({ scares: 9, scaresRated: true, diary: [{ day: "2026-01-01", scared: 3 }] })).value).toBe(9);
  });
  it("an entry with no 'scared' doesn't count", () => {
    expect(scareOf(gory({ diary: [{ day: "2026-01-01", company: "alone" }] })).estimated).toBe(true);
  });
  it("calibrates predictions to you: if you're scared more than the estimates say, they go up", () => {
    const logged = Array.from({ length: 4 }, (_, i) => gory({ id: i + 1, diary: [{ day: "2026-01-01", scared: 10 }] }));
    const bias = scareBias(logged);
    expect(bias).toBeGreaterThan(0.5);
    const unseen = gory({ id: 99 });
    expect(scareOf(unseen, { bias }).value).toBeGreaterThan(scareOf(unseen).value);
  });
  it("and down if horror doesn't get to you", () => {
    const logged = Array.from({ length: 4 }, (_, i) => gory({ id: i + 1, diary: [{ day: "2026-01-01", scared: 2 }] }));
    expect(scareBias(logged)).toBeLessThan(-0.5);
  });
  it("needs a few observations first", () => {
    expect(scareBias([gory({ id: 1, diary: [{ day: "2026-01-01", scared: 10 }] })])).toBe(0);
  });
  it("combines diary entries and slider ratings", () => {
    const items = [
      gory({ id: 1, diary: [{ day: "2026-01-01", scared: 10 }] }),
      gory({ id: 2, diary: [{ day: "2026-01-01", scared: 10 }] }),
      gory({ id: 3, scares: 10, scaresRated: true }),
    ];
    expect(scareBias(items)).toBeGreaterThan(0);
    expect(estimateScare(items[0]).value).toBeLessThan(10);
  });
});

describe("watchPatch with a rating", () => {
  it("sets the rating only when one is given", () => {
    expect(watchPatch(film(), at(2026, 5, 6), undefined, 4).rating).toBe(4);
    expect(watchPatch(film(), at(2026, 5, 6), undefined, 0).rating).toBe(0);
    expect(watchPatch(film(), at(2026, 5, 6)).rating).toBeUndefined();
  });
});
