import { describe, expect, it } from "vitest";
import { parseCSV, parseImdbCSV, parseLetterboxdCSV } from "./csv.js";
import { createICS, escapeICSText } from "./ics.js";
import { MOOD_PRESETS, matchesMood } from "./moods.js";

describe("parseCSV", () => {
  it("handles quotes, embedded commas, escaped quotes and CRLF", () => {
    const rows = parseCSV('a,b\r\n"Hello, World","She said ""hi"""\r\n');
    expect(rows).toEqual([["a", "b"], ["Hello, World", 'She said "hi"']]);
  });
});

describe("parseLetterboxdCSV", () => {
  it("maps rows without inventing tags or scares", () => {
    const csv = "Date,Name,Year,Letterboxd URI,Rating\n2024-10-31,Halloween,1978,x,4.5\n";
    const [item] = parseLetterboxdCSV(csv);
    expect(item).toMatchObject({ id: "letterboxd:Halloween:1978", title: "Halloween", year: 1978, rating: 4.5 });
    expect(item.watchedDates).toHaveLength(1);
    expect(item).not.toHaveProperty("tags");
    expect(item).not.toHaveProperty("scares");
  });

  it("survives a bad date in one row", () => {
    const csv = "Date,Name,Year,Rating\nnot-a-date,Scream,1996,3\n";
    const [item] = parseLetterboxdCSV(csv);
    expect(item.title).toBe("Scream");
    expect(item.watchedDates).toBeUndefined();
  });

  it("gives a clear error for the wrong file", () => {
    expect(() => parseLetterboxdCSV("foo,bar\n1,2\n")).toThrow(/Letterboxd/);
    expect(() => parseLetterboxdCSV("")).toThrow(/empty/i);
  });
});

describe("parseImdbCSV", () => {
  it("converts the 10-point scale to 5 stars", () => {
    const csv = "Const,Your Rating,Date Rated,Title,Year\ntt0078748,10,2024-01-02,Alien,1979\ntt0070047,7,2024-01-03,The Exorcist,1973\n";
    const items = parseImdbCSV(csv);
    expect(items[0]).toMatchObject({ id: "imdb:tt0078748", rating: 5 });
    expect(items[1].rating).toBe(3.5);
  });
});

describe("createICS", () => {
  it("escapes commas, semicolons and newlines", () => {
    expect(escapeICSText("a,b;c\nd")).toBe("a\\,b\\;c\\nd");
    const ics = createICS({ events: [{ title: "Watch: Us, Them", start: new Date("2025-10-31T20:00:00Z") }] });
    expect(ics).toContain("SUMMARY:Watch: Us\\, Them");
    expect(ics).toContain("DTSTART:20251031T200000Z");
  });
});

describe("matchesMood", () => {
  it("matches any tag in the preset, case-insensitively", () => {
    expect(matchesMood(["Slasher"], "slasher")).toBe(true);
    expect(matchesMood(["comedy"], "slasher")).toBe(false);
  });

  it("treats all/unknown moods as no filter", () => {
    expect(matchesMood([], "all")).toBe(true);
    expect(matchesMood([], "nope")).toBe(true);
  });

  it("every preset has at least one tag except all", () => {
    MOOD_PRESETS.filter((p) => p.id !== "all").forEach((p) => expect(p.tags.length).toBeGreaterThan(0));
  });
});
