import { describe, expect, it } from "vitest";
import { WATCHED_COLUMNS, buildLetterboxdExport, letterboxdWatchedRows, letterboxdWatchlistRows } from "./letterboxdExport.js";
import { parseCSV, parseLetterboxdCSV, toCSV } from "./csv.js";
import { mergeLibraries, normalizeLibrary } from "./library.js";
import { watchLog } from "./insights.js";

const at = (y, m, d) => new Date(y, m - 1, d).toISOString(); // local midnight, as the app stores a watch
let next = 1;
const film = (over = {}) => ({ id: next++, title: `Film ${next}`, year: 2010, rating: 0, tags: [], notes: "", watchedDates: [], watchlist: false, ...over });

describe("toCSV", () => {
  it("quotes what needs it and ends rows with CRLF", () => {
    const csv = toCSV(["a", "b"], [{ a: 'He said "hi", twice', b: "line1\nline2" }, { a: "plain", b: undefined }]);
    expect(csv).toBe('a,b\r\n"He said ""hi"", twice","line1\nline2"\r\nplain,\r\n');
  });
  it("reads back what it wrote", () => {
    const rows = [{ a: 'x, "y"', b: "multi\nline" }];
    const [header, row] = parseCSV(toCSV(["a", "b"], rows));
    expect(header).toEqual(["a", "b"]);
    expect(row).toEqual(['x, "y"', "multi\nline"]);
  });
});

describe("watched rows", () => {
  it("writes one row per watch, with the date as a calendar day and later ones marked as rewatches", () => {
    const rows = letterboxdWatchedRows([film({ id: 348, title: "Alien", year: 1979, rating: 5, tags: ["sci-horror", "creature"], notes: "Perfect.", watchedDates: [at(2025, 10, 31), at(2024, 1, 5)] })]);
    expect(rows).toEqual([
      { tmdbID: 348, Title: "Alien", Year: 1979, Rating: 5, WatchedDate: "2024-01-05", Rewatch: "", Tags: "sci-horror, creature", Review: "Perfect." },
      { tmdbID: 348, Title: "Alien", Year: 1979, Rating: 5, WatchedDate: "2025-10-31", Rewatch: "true", Tags: "", Review: "" },
    ]);
  });
  it("includes rated films with no watch, and films seen long ago, as undated rows", () => {
    const rows = letterboxdWatchedRows([
      film({ title: "Rated only", rating: 3.5 }),
      film({ title: "Long ago", watchedDates: [new Date(1900, 0, 1).toISOString()] }),
    ]);
    expect(rows.map((r) => [r.Title, r.WatchedDate, r.Rating])).toEqual([["Long ago", "", ""], ["Rated only", "", 3.5]]);
  });
  it("leaves out films you've neither watched nor rated", () => {
    expect(letterboxdWatchedRows([film({ watchlist: true }), film()])).toEqual([]);
  });
  it("only gives a TMDb id to films that have a real one", () => {
    const rows = letterboxdWatchedRows([film({ id: "letterboxd:X:2001", title: "X", rating: 4 }), film({ id: "imdb:tt1", title: "Y", rating: 4 })]);
    expect(rows.map((r) => r.tmdbID)).toEqual(["", ""]);
  });
  it("uses the configured long-ago year", () => {
    const rows = letterboxdWatchedRows([film({ watchedDates: [new Date(1800, 0, 1).toISOString(), at(2025, 1, 1)] })], { longAgoYear: 1800 });
    expect(rows).toHaveLength(1);
    expect(rows[0].WatchedDate).toBe("2025-01-01");
  });
  it("orders by date, then title", () => {
    const rows = letterboxdWatchedRows([film({ title: "B", watchedDates: [at(2025, 2, 1)] }), film({ title: "A", watchedDates: [at(2025, 2, 1)] }), film({ title: "C", watchedDates: [at(2025, 1, 1)] })]);
    expect(rows.map((r) => r.Title)).toEqual(["C", "A", "B"]);
  });
});

describe("watchlist rows", () => {
  it("lists only unwatched, unrated watchlist films", () => {
    const rows = letterboxdWatchlistRows([film({ title: "Want", watchlist: true }), film({ title: "Seen", watchlist: true, watchedDates: [at(2025, 1, 1)] }), film({ title: "Rated", watchlist: true, rating: 3 }), film({ title: "Not listed" })]);
    expect(rows.map((r) => r.Title)).toEqual(["Want"]);
  });
});

describe("buildLetterboxdExport", () => {
  const items = [film({ title: "A", rating: 4, watchedDates: [at(2025, 1, 1), at(2025, 2, 1)] }), film({ title: "B", rating: 3 }), film({ title: "W", watchlist: true })];
  const out = buildLetterboxdExport(items);
  it("counts films and dated watches", () => {
    expect(out.watched).toMatchObject({ films: 2, watches: 2 });
    expect(out.watchlist.films).toBe(1);
  });
  it("starts each file with Letterboxd's column names", () => {
    expect(out.watched.csv.split("\r\n")[0]).toBe(WATCHED_COLUMNS.join(","));
    expect(out.watchlist.csv.split("\r\n")[0]).toBe("tmdbID,Title,Year");
  });
});

describe("a round trip through HorrorHub's own importer", () => {
  const items = [
    film({ id: 348, title: "Alien", year: 1979, rating: 5, tags: ["sci-horror", "creature"], notes: 'Perfect, "classic".\nWatched on a big screen.', watchedDates: [at(2025, 10, 31), at(2024, 1, 5)] }),
    film({ id: 10, title: "A, Comma", year: 2001, rating: 2.5, watchedDates: [at(2025, 3, 9)] }),
  ];
  const imported = parseLetterboxdCSV(buildLetterboxdExport(items).watched.csv);

  it("keeps every watch on the same calendar day", () => {
    const merged = mergeLibraries([], imported).items;
    const days = watchLog(merged).map((w) => `${w.item.title} ${w.day}`);
    expect(days).toEqual(["Alien 2024-01-05", "A, Comma 2025-03-09", "Alien 2025-10-31"].sort((a, b) => a.split(" ").slice(-1)[0].localeCompare(b.split(" ").slice(-1)[0])));
  });
  it("keeps ratings, tags, review and TMDb ids", () => {
    const alien = mergeLibraries([], imported).items.find((i) => i.title === "Alien");
    expect(alien).toMatchObject({ id: 348, rating: 5, notes: 'Perfect, "classic".\nWatched on a big screen.' });
    expect(alien.tags).toEqual(["sci-horror", "creature"]);
    expect(alien.watchedDates).toHaveLength(2);
  });
  it("handles commas in titles", () => {
    expect(imported.some((i) => i.title === "A, Comma" && i.year === 2001)).toBe(true);
  });
  it("adds to an existing library without duplicating it", () => {
    const existing = normalizeLibrary(items);
    const { items: merged } = mergeLibraries(existing, imported);
    expect(merged).toHaveLength(2);
    expect(merged.find((i) => i.id === 348).watchedDates).toHaveLength(2);
  });
});

describe("importing Letterboxd's date format", () => {
  it("reads YYYY-MM-DD as that local day, not the evening before", () => {
    const [row] = parseLetterboxdCSV("Date,Name,Year,Letterboxd URI,Rating,Watched Date\n2026-03-05,Alien,1979,x,4,2026-03-05\n");
    const merged = mergeLibraries([], [row]).items[0];
    expect(watchLog([merged])[0].day).toBe("2026-03-05");
  });
});
