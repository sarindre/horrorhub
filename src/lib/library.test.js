import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEGACY_LIBRARY_KEY,
  LIBRARY_KEY,
  loadLibrary,
  mergeLibraries,
  normalizeItem,
  saveLibrary,
  validateImport,
} from "./library.js";

function fakeStorage(initial = {}, { failWrites = false } = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (failWrites) throw new Error("QuotaExceededError");
      map.set(k, String(v));
    },
    _map: map,
  };
}

describe("normalizeItem", () => {
  it("fills defaults and keeps unknown fields", () => {
    const item = normalizeItem({ id: 1, title: " Hereditary ", jumpScares: 4 });
    expect(item).toMatchObject({ id: 1, title: "Hereditary", rating: 0, scares: 5, tags: [], watchedDates: [], watchlist: false, jumpScares: 4 });
  });

  it("clamps rating/scares and cleans tags", () => {
    const item = normalizeItem({ id: 1, title: "X", rating: 9, scares: -3, tags: [" Gore ", "gore", "", null, "Slasher"] });
    expect(item.rating).toBe(5);
    expect(item.scares).toBe(0);
    expect(item.tags).toEqual(["gore", "slasher"]);
  });

  it("drops invalid and exactly-duplicate watch dates but keeps a same-day rewatch", () => {
    const item = normalizeItem({
      id: 1,
      title: "X",
      watchedDates: ["2024-10-01T10:00:00.000Z", "2024-10-01T10:00:00.000Z", "2024-10-01T22:00:00.000Z", "nope", 5],
    });
    expect(item.watchedDates).toEqual(["2024-10-01T10:00:00.000Z", "2024-10-01T22:00:00.000Z"]);
  });

  it("rejects items without an id or title", () => {
    expect(normalizeItem(null)).toBeNull();
    expect(normalizeItem({ title: "X" })).toBeNull();
    expect(normalizeItem({ id: 1, title: "  " })).toBeNull();
  });
});

describe("validateImport", () => {
  it("accepts a bare array and an export envelope", () => {
    expect(validateImport([{ id: 1, title: "A" }]).items).toHaveLength(1);
    expect(validateImport({ app: "horrorhub", items: [{ id: 1, title: "A" }] }).items).toHaveLength(1);
  });

  it("reports skipped rows and rejects non-library JSON", () => {
    const res = validateImport([{ id: 1, title: "A" }, { nope: true }]);
    expect(res.skipped).toBe(1);
    expect(validateImport({ hello: "world" }).error).toBeTruthy();
    expect(validateImport([{ nope: true }]).error).toBeTruthy();
  });
});

describe("mergeLibraries", () => {
  const existing = [
    { id: 101, title: "The Thing", year: 1982, rating: 5, scares: 8, tags: ["creature"], watchedDates: ["2024-10-01T00:00:00.000Z"] },
  ];

  it("adds new titles and never removes existing ones", () => {
    const { items, added, updated } = mergeLibraries(existing, [{ id: 202, title: "Alien", year: 1979 }]);
    expect(items.map((i) => i.title)).toEqual(["The Thing", "Alien"]);
    expect([added, updated]).toEqual([1, 0]);
  });

  it("matches a CSV row to an existing TMDb entry by title + year", () => {
    const row = { id: "letterboxd:The Thing:1982", title: "The Thing", year: 1982, watchedDates: ["2025-01-05T00:00:00.000Z"] };
    const { items, added, updated } = mergeLibraries(existing, [row]);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(101);
    expect(items[0].watchedDates).toHaveLength(2);
    expect([added, updated]).toEqual([0, 1]);
  });

  it("collapses the same viewing imported with a different timestamp", () => {
    const row = { id: 101, title: "The Thing", year: 1982, watchedDates: ["2024-10-01T18:30:00.000Z"] };
    const { items } = mergeLibraries(existing, [row]);
    expect(items[0].watchedDates).toEqual(["2024-10-01T00:00:00.000Z"]);
  });

  it("does not overwrite curated data with empty import values", () => {
    const { items } = mergeLibraries(existing, [{ id: 101, title: "The Thing", year: 1982, rating: 0, tags: [] }]);
    expect(items[0]).toMatchObject({ rating: 5, scares: 8, tags: ["creature"] });
  });

  it("never takes a film off your watchlist because an import defaulted watchlist to false", () => {
    const listed = [{ id: 7, title: "Queued", year: 2001, watchlist: true }];
    expect(mergeLibraries(listed, [{ id: 7, title: "Queued", year: 2001, watchlist: false }]).items[0].watchlist).toBe(true);
    // ...but an import can still put a film on it
    const plain = [{ id: 8, title: "Plain", year: 2002, watchlist: false }];
    expect(mergeLibraries(plain, [{ id: 8, title: "Plain", year: 2002, watchlist: true }]).items[0].watchlist).toBe(true);
  });

  it("unions tags and lets non-empty incoming values win", () => {
    const { items } = mergeLibraries(existing, [{ id: 101, title: "The Thing", year: 1982, rating: 4, tags: ["sci-horror"] }]);
    expect(items[0].rating).toBe(4);
    expect(items[0].tags).toEqual(["creature", "sci-horror"]);
  });
});

describe("storage round trip", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("migrates the legacy v2 array to v3 and keeps v2 as a backup", () => {
    const store = fakeStorage({ [LEGACY_LIBRARY_KEY]: JSON.stringify([{ id: 1, title: "Old", rating: 3 }]) });
    vi.stubGlobal("localStorage", store);
    const items = loadLibrary();
    expect(items[0]).toMatchObject({ id: 1, title: "Old", scares: 5 });
    expect(JSON.parse(store._map.get(LIBRARY_KEY)).version).toBe(3);
    expect(store._map.has(LEGACY_LIBRARY_KEY)).toBe(true);
  });

  it("keeps a copy of an unreadable v3 value instead of silently dropping it", () => {
    const store = fakeStorage({ [LIBRARY_KEY]: "{not json" });
    vi.stubGlobal("localStorage", store);
    expect(loadLibrary()).toEqual([]);
    expect(store._map.get("horrorhub.library.corrupt")).toBe("{not json");
  });

  it("reports failed writes instead of throwing", () => {
    vi.stubGlobal("localStorage", fakeStorage({}, { failWrites: true }));
    expect(saveLibrary([])).toBe(false);
  });
});
