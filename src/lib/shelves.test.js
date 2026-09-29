import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addFilm, createShelf, editShelf, entriesWithItems, hasFilm, loadShelves, MAX_NAME, MAX_SHELF_FILMS, mergeShelves, moveFilm,
  normalizeShelf, parseShelfPayload, relinkShelves, removeFilm, saveShelves, SHELVES_KEY, shelfExport, shelfToText,
  shelvesContaining, smartShelves, snapshotFilm,
} from "./shelves.js";
import { buildTasteProfile } from "./taste.js";

const NOW = new Date(2025, 9, 15, 12, 0, 0);
const film = (id, extra = {}) => ({ id, title: `Film ${id}`, year: 2010, poster: `/p${id}.jpg`, ...extra });
const shelf = (films = [], extra = {}) => createShelf({ name: "Comfort horror", films, now: NOW, id: "s1", ...extra });
const ids = (s) => s.films.map((f) => f.id);

describe("snapshots and normalizing", () => {
  it("keeps only what a shelf needs from a film", () => {
    expect(snapshotFilm({ id: 1, title: " Alien ", year: 1979, poster: "/a.jpg", rating: 5, tags: ["x"] })).toEqual({ id: 1, title: "Alien", year: 1979, poster: "/a.jpg" });
    expect(snapshotFilm({ id: 1, title: "X", year: "junk" })).toEqual({ id: 1, title: "X" });
  });

  it("validates shelves and drops bad ones and bad films", () => {
    const good = normalizeShelf({ id: "a", name: "  Mine  ", films: [film(1), { nope: true }, film(1), film("x:Y:2000", { title: "Y" })] });
    expect(good.name).toBe("Mine");
    expect(ids(good)).toEqual([1, "x:Y:2000"]); // junk and the duplicate are gone
    for (const bad of [null, {}, { id: "a" }, { id: "a", name: "  " }, { name: "No id" }]) expect(normalizeShelf(bad)).toBeNull();
  });

  it("limits name, description and size", () => {
    expect(normalizeShelf({ id: "a", name: "x".repeat(200) }).name).toHaveLength(MAX_NAME);
    const big = normalizeShelf({ id: "a", name: "Big", films: Array.from({ length: MAX_SHELF_FILMS + 20 }, (_, i) => film(i + 1)) });
    expect(big.films).toHaveLength(MAX_SHELF_FILMS);
  });

  it("createShelf needs a name and gives each shelf its own id", () => {
    expect(createShelf({ name: "   " })).toBeNull();
    const a = createShelf({ name: "A" });
    const b = createShelf({ name: "B" });
    expect(a.id).not.toBe(b.id);
  });
});

describe("editing a shelf", () => {
  it("adds films once, at the end", () => {
    const s = addFilm(addFilm(shelf([film(1)]), film(2)), film(2));
    expect(ids(s)).toEqual([1, 2]);
    expect(hasFilm(s, 2)).toBe(true);
    expect(hasFilm(s, "2")).toBe(true); // ids are compared as text so 2 and "2" are the same film
  });

  it("removes films and ignores ones that aren't there", () => {
    const s = shelf([film(1), film(2)]);
    expect(ids(removeFilm(s, 1))).toEqual([2]);
    expect(removeFilm(s, 99)).toBe(s);
  });

  it("reorders, stopping at the ends, without mutating", () => {
    const s = shelf([film(1), film(2), film(3)]);
    expect(ids(moveFilm(s, 3, -1))).toEqual([1, 3, 2]);
    expect(ids(moveFilm(s, 1, 1))).toEqual([2, 1, 3]);
    expect(moveFilm(s, 1, -1)).toBe(s);
    expect(moveFilm(s, 3, 1)).toBe(s);
    expect(moveFilm(s, 99, 1)).toBe(s);
    expect(ids(s)).toEqual([1, 2, 3]);
  });

  it("renames and re-describes, but never leaves a shelf without a name", () => {
    const s = shelf([]);
    expect(editShelf(s, { name: "  Cozy  ", description: " for rainy nights " })).toMatchObject({ name: "Cozy", description: "for rainy nights" });
    expect(editShelf(s, { name: "   " }).name).toBe("Comfort horror");
    expect(editShelf(s, { description: "" }).description).toBe("");
  });

  it("stamps updatedAt", () => {
    const later = new Date(2025, 9, 20);
    expect(addFilm(shelf([]), film(1), later).updatedAt).toBe(later.toISOString());
  });

  it("finds which shelves hold a film", () => {
    const a = shelf([film(1)], { id: "a" });
    const b = shelf([film(2)], { id: "b" });
    expect(shelvesContaining([a, b], 1)).toEqual(["a"]);
    expect(shelvesContaining([a, b], 3)).toEqual([]);
  });
});

describe("keeping shelves in step with the library", () => {
  it("follows a film when an imported title is matched to TMDb", () => {
    const s = shelf([film("letterboxd:Alien:1979", { title: "Alien", year: 1979 }), film(2)]);
    const [next] = relinkShelves([s], "letterboxd:Alien:1979", { id: 348, title: "Alien", year: 1979, poster: "/alien.jpg" });
    expect(next.films[0]).toEqual({ id: 348, title: "Alien", year: 1979, poster: "/alien.jpg" });
    expect(ids(next)).toEqual([348, 2]);
  });

  it("doesn't duplicate a film the shelf already had under its TMDb id", () => {
    const s = shelf([film("imdb:tt1", { title: "Alien" }), film(348, { title: "Alien" })]);
    expect(ids(relinkShelves([s], "imdb:tt1", { id: 348, title: "Alien" })[0])).toEqual([348]);
  });

  it("leaves shelves without that film untouched", () => {
    const s = shelf([film(1)]);
    expect(relinkShelves([s], "nope", { id: 5, title: "X" })[0]).toBe(s);
  });

  it("joins entries with library films by id, then by title and year", () => {
    const s = shelf([film(1), film("old-id", { title: "Alien", year: 1979 }), film(3)]);
    const library = [{ id: 1, title: "Film 1", year: 2010, rating: 4 }, { id: 348, title: "Alien", year: 1979 }];
    const rows = entriesWithItems(s, library);
    expect(rows.map((r) => r.item?.id ?? null)).toEqual([1, 348, null]);
  });
});

describe("sharing", () => {
  it("exports a shelf in an envelope other machines can read back", () => {
    const s = shelf([film(1), film(2)]);
    const exported = shelfExport(s, NOW);
    expect(exported).toMatchObject({ app: "horrorhub", type: "shelf", version: 1 });
    const { shelves, skipped } = parseShelfPayload(JSON.parse(JSON.stringify(exported)));
    expect(skipped).toBe(0);
    expect(shelves[0]).toMatchObject({ id: "s1", name: "Comfort horror" });
    expect(ids(shelves[0])).toEqual([1, 2]);
  });

  it("reads a full backup's shelves, a bare shelf, and reports unusable ones", () => {
    const s = shelf([film(1)]);
    expect(parseShelfPayload({ items: [], shelves: [s, s] }).shelves).toHaveLength(2);
    expect(parseShelfPayload(s).shelves).toHaveLength(1);
    expect(parseShelfPayload({ shelves: [s, { junk: true }] })).toMatchObject({ skipped: 1 });
    expect(parseShelfPayload({ hello: "world" })).toEqual({ shelves: [], skipped: 0 });
    expect(parseShelfPayload(null)).toEqual({ shelves: [], skipped: 0 });
  });

  it("renders a plain-text list", () => {
    const text = shelfToText(shelf([film(1, { title: "Alien", year: 1979 }), film(2, { title: "Blair", year: undefined })], { description: "Cozy scares" }));
    expect(text.split("\n")).toEqual(["Comfort horror", "Cozy scares", "", "1. Alien (1979)", "2. Blair", "", "Made with HorrorHub"]);
  });

  it("merges an import without replacing what you have", () => {
    const mine = shelf([film(1)], { id: "a" });
    const { shelves, added } = mergeShelves([mine], [{ ...mine, name: "Changed" }, shelf([film(2)], { id: "b" }), { junk: 1 }]);
    expect(added).toBe(1);
    expect(shelves.map((s) => s.id)).toEqual(["a", "b"]);
    expect(shelves[0].name).toBe("Comfort horror");
  });
});

describe("smartShelves", () => {
  const day = (y, m, d) => new Date(y, m - 1, d).toISOString();
  const lib = (id, extra = {}) => ({ id, title: `Lib ${id}`, year: 2005, rating: 0, scares: 6, tags: [], watchedDates: [], watchlist: false, ...extra });
  const library = [
    // loved occult films
    lib(1, { tags: ["occult"], rating: 5, watchedDates: [day(2022, 1, 1)] }),
    lib(2, { tags: ["occult", "possession"], rating: 4.5, watchedDates: [day(2024, 6, 1)] }),
    lib(3, { tags: ["occult"], rating: 4, watchedDates: [day(2025, 9, 1)] }),
    // unwatched occult films to recommend next
    lib(4, { tags: ["occult"] }),
    lib(5, { tags: ["possession"] }),
    // unrelated
    lib(6, { tags: ["slasher"], rating: 1, watchedDates: [day(2025, 1, 1)] }),
    lib(7, { tags: ["comedy"] }),
  ];
  const byId = (shelves, id) => shelves.find((s) => s.id === id);

  it("offers picks in the mood you love, best-of and rewatch shelves", () => {
    const shelves = smartShelves(library, { now: NOW });
    const ids = shelves.map((s) => s.id);
    expect(ids).toContain("next-occult");
    expect(ids).toContain("best-occult");
    expect(ids).toContain("rewatch");
    expect(byId(shelves, "next-occult").title).toBe("Top picks for your Occult mood");
  });

  it("only recommends unwatched films that fit the mood, each with a reason", () => {
    const next = byId(smartShelves(library, { now: NOW }), "next-occult");
    expect(next.films.map((f) => f.item.id).sort()).toEqual([4, 5]);
    for (const f of next.films) expect(f.reasons.length).toBeGreaterThan(0);
  });

  it("'best of' lists your highest-rated films first, and 'rewatch' only favorites you haven't seen in a year", () => {
    const shelves = smartShelves(library, { now: NOW });
    expect(byId(shelves, "best-occult").films.map((f) => f.item.id)).toEqual([1, 2, 3]);
    const rewatch = byId(shelves, "rewatch").films;
    expect(rewatch.map((f) => f.item.id)).toEqual([1, 2]); // 3 was watched last month
    expect(rewatch[0].reasons[0]).toMatch(/years? ago|a year ago/);
  });

  it("leaves out films over your content limits", () => {
    const flagged = library.map((i) => (i.id === 4 ? { ...i, contentFlags: ["torture"] } : i));
    const next = byId(smartShelves(flagged, { prefs: { avoidFlags: ["torture"] }, now: NOW }), "next-occult");
    expect(next?.films.map((f) => f.item.id) ?? []).not.toContain(4);
  });

  it("doesn't make a shelf out of a single film, and offers nothing for an empty or untouched library", () => {
    expect(smartShelves([], { now: NOW })).toEqual([]);
    expect(smartShelves([lib(1), lib(2)], { now: NOW })).toEqual([]); // nothing watched or rated: no taste yet
    const oneOccult = [lib(1, { tags: ["occult"], rating: 5, watchedDates: [day(2020, 1, 1)] })];
    expect(smartShelves(oneOccult, { now: NOW }).some((s) => s.id === "rewatch")).toBe(false); // only one favorite
  });

  it("can reuse a profile you've already built", () => {
    const profile = buildTasteProfile(library, { now: NOW.getTime() });
    expect(smartShelves(library, { profile, now: NOW }).map((s) => s.id)).toEqual(smartShelves(library, { now: NOW }).map((s) => s.id));
  });
});

describe("persistence", () => {
  afterEach(() => vi.unstubAllGlobals());
  const store = () => {
    const map = new Map();
    return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), _map: map };
  };

  it("round-trips through storage and survives corrupt data", () => {
    const s = store();
    vi.stubGlobal("localStorage", s);
    expect(saveShelves([shelf([film(1)])])).toBe(true);
    expect(JSON.parse(s._map.get(SHELVES_KEY)).version).toBe(1);
    expect(loadShelves()).toHaveLength(1);
    s.setItem(SHELVES_KEY, "{bad");
    expect(loadShelves()).toEqual([]);
  });
});
