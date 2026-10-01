// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportImport } from "./ExportImport.jsx";

const at = (y, m, d) => new Date(y, m - 1, d).toISOString();
const items = [
  { id: 348, title: "Alien", year: 1979, rating: 5, tags: ["sci-horror"], notes: "", watchedDates: [at(2025, 10, 31)], watchlist: false },
  { id: 9, title: "Wanted", year: 2020, rating: 0, tags: [], notes: "", watchedDates: [], watchlist: true },
];

let blobs;
beforeEach(() => {
  blobs = [];
  URL.createObjectURL = vi.fn((blob) => (blobs.push(blob), "blob:x"));
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const readBlob = (blob) => new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsText(blob); });

describe("Export for Letterboxd", () => {
  it("downloads a CSV in the format Letterboxd imports", async () => {
    render(<ExportImport data={items} onImport={() => {}} watchlist={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Export for Letterboxd/ }));
    const text = await readBlob(blobs[0]);
    expect(text.split("\r\n")[0]).toBe("tmdbID,Title,Year,Rating,WatchedDate,Rewatch,Tags,Review");
    expect(text).toContain("348,Alien,1979,5,2025-10-31,,sci-horror,");
    expect(text).not.toContain("Wanted"); // the watchlist is its own file
  });

  it("offers the watchlist as a separate file only when there is one", async () => {
    render(<ExportImport data={items} onImport={() => {}} watchlist={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Letterboxd watchlist" }));
    const text = await readBlob(blobs[0]);
    expect(text).toBe("tmdbID,Title,Year\r\n9,Wanted,2020\r\n");
    cleanup();
    render(<ExportImport data={[items[0]]} onImport={() => {}} watchlist={[]} />);
    expect(screen.queryByRole("button", { name: "Letterboxd watchlist" })).toBeNull();
  });

  it("is disabled with nothing to export, and doesn't count as a backup", () => {
    const onExported = vi.fn();
    render(<ExportImport data={[]} onImport={() => {}} watchlist={[]} onExported={onExported} />);
    expect(screen.getByRole("button", { name: /Export for Letterboxd/ }).disabled).toBe(true);
    cleanup();
    render(<ExportImport data={items} onImport={() => {}} watchlist={[]} onExported={onExported} />);
    fireEvent.click(screen.getByRole("button", { name: /Export for Letterboxd/ }));
    expect(onExported).not.toHaveBeenCalled(); // it's a different format, not a full backup
  });

  it("uses your 'long ago' year so placeholder dates don't become real ones", async () => {
    const longAgo = [{ ...items[0], watchedDates: [new Date(1800, 0, 1).toISOString()] }];
    render(<ExportImport data={longAgo} onImport={() => {}} watchlist={[]} longAgoYear={1800} />);
    fireEvent.click(screen.getByRole("button", { name: /Export for Letterboxd/ }));
    expect(await readBlob(blobs[0])).toContain("348,Alien,1979,5,,,sci-horror,");
  });
});
