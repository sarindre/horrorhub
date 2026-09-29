// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App.jsx";
import { LIBRARY_KEY } from "../../lib/library.js";
import { SETTINGS_KEY } from "../../lib/settings.js";
import { SHELVES_KEY, createShelf } from "../../lib/shelves.js";

const WAIT = { timeout: 5000 };
const tab = (name) => screen.getByRole("tab", { name });
const storedShelves = () => JSON.parse(localStorage.getItem(SHELVES_KEY) || '{"items":[]}').items;
const seedLibrary = (items) => localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: 3, items }));
const seedShelves = (shelves) => localStorage.setItem(SHELVES_KEY, JSON.stringify({ version: 1, items: shelves }));
const settings = (extra = {}) => localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 2, settings: { flicker: false, fog: false, ...extra } }));
const film = (id, extra = {}) => ({ id, title: `Film ${id}`, year: 2000 + id, poster: `/p${id}.jpg`, ...extra });

let downloads;

beforeEach(() => {
  window.location.hash = "";
  localStorage.clear();
  settings();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results: [] }) })));
  // capture downloads instead of navigating
  downloads = [];
  URL.createObjectURL = vi.fn((blob) => { downloads.push(blob); return "blob:test"; });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click() {
    downloads[downloads.length - 1].filename = this.download;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function openShelves() {
  render(<App />);
  fireEvent.click(tab("My Library"));
  fireEvent.click(tab("Shelves"));
  await screen.findByText("Curated for you", {}, WAIT);
}
const readBlob = (blob) =>
  new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsText(blob);
  });

describe("shelves", () => {
  it("is a second view under My Library, with a friendly empty state", async () => {
    await openShelves();
    expect(tab("Shelves").getAttribute("aria-selected")).toBe("true");
    expect(tab("My Library").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("No shelves yet")).toBeTruthy();
    expect(screen.getByText(/Rate and tag a few films/)).toBeTruthy(); // nothing curated until there's taste to go on
  });

  it("creates a shelf, opens it, and persists it", async () => {
    await openShelves();
    fireEvent.change(screen.getByLabelText("New shelf name"), { target: { value: "  Comfort horror  " } });
    fireEvent.click(screen.getByRole("button", { name: "Create shelf" }));
    expect(screen.getByLabelText("Shelf name").value).toBe("Comfort horror"); // opened straight into the new shelf
    expect(screen.getByText(/This shelf is empty/)).toBeTruthy();
    expect(storedShelves().map((s) => s.name)).toEqual(["Comfort horror"]);
  });

  it("won't create a shelf with a blank name", async () => {
    await openShelves();
    expect(screen.getByRole("button", { name: "Create shelf" }).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("New shelf name"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Create shelf" }).disabled).toBe(true);
  });

  it("adds films from your library, reorders them, removes one", async () => {
    seedLibrary([film(1, { title: "Alpha" }), film(2, { title: "Beta" }), film(3, { title: "Gamma" })]);
    await openShelves();
    fireEvent.change(screen.getByLabelText("New shelf name"), { target: { value: "Mine" } });
    fireEvent.click(screen.getByRole("button", { name: "Create shelf" }));

    for (const title of ["Alpha", "Beta", "Gamma"]) {
      fireEvent.change(screen.getByLabelText("Search films to add"), { target: { value: title } });
      fireEvent.click(screen.getByRole("button", { name: "Add" })); // the one search result for that title
    }
    const order = () => storedShelves()[0].films.map((f) => f.title);
    expect(order()).toEqual(["Alpha", "Beta", "Gamma"]);

    fireEvent.click(screen.getByRole("button", { name: "Move Gamma up" }));
    expect(order()).toEqual(["Alpha", "Gamma", "Beta"]);
    expect(screen.getByRole("button", { name: "Move Alpha up" }).disabled).toBe(true); // can't go above the first
    expect(screen.getByRole("button", { name: "Move Beta down" }).disabled).toBe(true); // or below the last

    fireEvent.click(screen.getByRole("button", { name: "Remove Alpha from this shelf" }));
    expect(order()).toEqual(["Gamma", "Beta"]);
    expect(within(document.querySelector("ol")).queryByText("Alpha")).toBeNull(); // the numbered shelf list
  });

  it("renames a shelf and keeps the name if you clear the box", async () => {
    seedShelves([createShelf({ name: "Old name", id: "s1" })]);
    await openShelves();
    fireEvent.click(screen.getByRole("button", { name: "Open shelf Old name" }));
    const name = screen.getByLabelText("Shelf name");
    fireEvent.change(name, { target: { value: "New name" } });
    fireEvent.blur(name);
    expect(storedShelves()[0].name).toBe("New name");
    fireEvent.change(name, { target: { value: "  " } });
    fireEvent.blur(name);
    expect(storedShelves()[0].name).toBe("New name");
    const desc = screen.getByLabelText("Shelf description");
    fireEvent.change(desc, { target: { value: "For rainy nights" } });
    fireEvent.blur(desc);
    expect(storedShelves()[0].description).toBe("For rainy nights");
  });

  it("deletes a shelf after confirming, and keeps it if you say no", async () => {
    seedLibrary([film(1)]);
    seedShelves([createShelf({ name: "Doomed", id: "s1", films: [film(1)] })]);
    await openShelves();
    fireEvent.click(screen.getByRole("button", { name: "Open shelf Doomed" }));
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Delete shelf" }));
    expect(storedShelves()).toHaveLength(1);
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete shelf" }));
    expect(storedShelves()).toHaveLength(0);
    expect(screen.getByText("No shelves yet")).toBeTruthy(); // back on the list
    expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)).items).toHaveLength(1); // the film itself is untouched
  });

  it("shows films that aren't in your library and lets you add them", async () => {
    seedShelves([createShelf({ name: "Wishlist", id: "s1", films: [film(9, { title: "Unowned" })] })]);
    await openShelves();
    fireEvent.click(screen.getByRole("button", { name: "Open shelf Wishlist" }));
    expect(screen.getByText("Not in your library")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Watchlist" }));
    const items = JSON.parse(localStorage.getItem(LIBRARY_KEY)).items;
    expect(items.find((i) => i.id === 9)).toMatchObject({ title: "Unowned", watchlist: true });
    await waitFor(() => expect(screen.queryByText("Not in your library")).toBeNull(), WAIT);
  });

  it("can add all of a shelf to the watchlist", async () => {
    seedLibrary([film(1), film(2)]);
    seedShelves([createShelf({ name: "Queue", id: "s1", films: [film(1), film(2)] })]);
    await openShelves();
    fireEvent.click(screen.getByRole("button", { name: "Open shelf Queue" }));
    fireEvent.click(screen.getByRole("button", { name: "Add all to watchlist" }));
    expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)).items.every((i) => i.watchlist)).toBe(true);
  });
});

describe("sharing shelves", () => {
  it("exports a shelf as a file others can import", async () => {
    seedShelves([createShelf({ name: "Friday Night Frights", id: "s1", description: "Pick one", films: [film(1), film(2)] })]);
    await openShelves();
    fireEvent.click(screen.getByRole("button", { name: "Open shelf Friday Night Frights" }));
    fireEvent.click(screen.getByRole("button", { name: "Export file" }));
    expect(downloads).toHaveLength(1);
    expect(downloads[0].filename).toBe("horrorhub-shelf-friday-night-frights.json");
    const payload = JSON.parse(await readBlob(downloads[0]));
    expect(payload).toMatchObject({ app: "horrorhub", type: "shelf", shelf: { id: "s1", name: "Friday Night Frights" } });
    expect(payload.shelf.films.map((f) => f.id)).toEqual([1, 2]);
  });

  it("copies a shelf as a plain-text list", async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    seedShelves([createShelf({ name: "List", id: "s1", films: [film(1, { title: "Alien", year: 1979 })] })]);
    await openShelves();
    fireEvent.click(screen.getByRole("button", { name: "Open shelf List" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy as text" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1), WAIT);
    expect(writeText.mock.calls[0][0]).toContain("1. Alien (1979)");
    expect(await screen.findByText(/Copied the list/, {}, WAIT)).toBeTruthy();
  });

  const fileOf = (content) => new File([typeof content === "string" ? content : JSON.stringify(content)], "shelf.json", { type: "application/json" });

  it("imports a friend's shelf file, once", async () => {
    await openShelves();
    const friend = createShelf({ name: "From a friend", id: "friend-1", films: [film(5, { title: "Borrowed" })] });
    const input = screen.getByLabelText("Import a shelf file");
    fireEvent.change(input, { target: { files: [fileOf({ app: "horrorhub", type: "shelf", version: 1, shelf: friend })] } });
    expect(await screen.findByText("From a friend", {}, WAIT)).toBeTruthy();
    expect(storedShelves().map((s) => s.id)).toEqual(["friend-1"]);
    expect(await screen.findByText(/Imported 1 shelf/, {}, WAIT)).toBeTruthy();

    fireEvent.change(input, { target: { files: [fileOf({ shelf: friend })] } });
    expect(await screen.findByText("You already have that shelf.", {}, WAIT)).toBeTruthy();
    expect(storedShelves()).toHaveLength(1);
  });

  it("explains a bad file instead of failing quietly", async () => {
    await openShelves();
    const input = screen.getByLabelText("Import a shelf file");
    fireEvent.change(input, { target: { files: [fileOf("{ not json")] } });
    expect(await screen.findByText("That file isn't valid JSON.", {}, WAIT)).toBeTruthy();
    fireEvent.change(input, { target: { files: [fileOf({ hello: "world" })] } });
    expect(await screen.findByText("No shelves found in that file.", {}, WAIT)).toBeTruthy();
    expect(storedShelves()).toHaveLength(0);
  });

  it("the main backup includes shelves, and a shelf-only file imports from Settings too", async () => {
    seedShelves([createShelf({ name: "In the backup", id: "s1", films: [film(1)] })]);
    render(<App />);
    fireEvent.click(tab("Settings"));
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    const backup = JSON.parse(await readBlob(downloads[0]));
    expect(backup.shelves.map((s) => s.name)).toEqual(["In the backup"]);

    // a shelf-only file goes through the same Import button as everything else
    const friend = createShelf({ name: "Shelf via Settings", id: "friend-2", films: [film(7)] });
    const input = document.querySelector('input[type="file"][accept="application/json"]');
    fireEvent.change(input, { target: { files: [fileOf({ shelf: friend })] } });
    expect(await screen.findByText(/Imported 1 shelf from JSON/, {}, WAIT)).toBeTruthy();
    expect(storedShelves().map((s) => s.name).sort()).toEqual(["In the backup", "Shelf via Settings"]);
  });
});

describe("curated collections", () => {
  const day = (y, m, d) => new Date(y, m - 1, d).toISOString();
  const lib = (id, extra = {}) => ({ id, title: `Curated ${id}`, year: 2005, rating: 0, scares: 6, tags: [], watchedDates: [], ...extra });
  const library = [
    lib(1, { tags: ["occult"], rating: 5, watchedDates: [day(2022, 1, 1)] }),
    lib(2, { tags: ["occult", "possession"], rating: 4.5, watchedDates: [day(2023, 6, 1)] }),
    lib(3, { tags: ["occult"], rating: 4, watchedDates: [day(2024, 1, 1)] }),
    lib(4, { tags: ["occult"] }),
    lib(5, { tags: ["possession"] }),
  ];

  it("builds collections from your taste, and saves one as a shelf you can edit", async () => {
    seedLibrary(library);
    await openShelves();
    const section = within(screen.getByRole("region", { name: "Top picks for your Occult mood" }));
    expect(section.getByText("Curated 4")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Your best Occult" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Time for a rewatch" })).toBeTruthy();

    fireEvent.click(section.getByRole("button", { name: "Save as shelf" }));
    expect(storedShelves()[0]).toMatchObject({ name: "Top picks for your Occult mood" });
    expect(storedShelves()[0].films.map((f) => f.title).sort()).toEqual(["Curated 4", "Curated 5"]);
    expect(await screen.findByRole("button", { name: "Open shelf Top picks for your Occult mood" }, WAIT)).toBeTruthy();
  });

  it("can send a whole collection to the watchlist", async () => {
    seedLibrary(library);
    await openShelves();
    const section = within(screen.getByRole("region", { name: "Top picks for your Occult mood" }));
    fireEvent.click(section.getByRole("button", { name: "Add to watchlist" }));
    const items = JSON.parse(localStorage.getItem(LIBRARY_KEY)).items;
    expect(items.filter((i) => i.watchlist).map((i) => i.id).sort()).toEqual([4, 5]);
  });

  it("leaves out films over your content limits", async () => {
    seedLibrary(library.map((i) => (i.id === 4 ? { ...i, contentFlags: ["torture"] } : i)));
    settings({ avoidFlags: ["torture"] });
    await openShelves();
    const next = screen.queryByRole("region", { name: "Top picks for your Occult mood" });
    expect(next ? within(next).queryByText("Curated 4") : null).toBeNull();
  });
});

describe("filing a film from its page", () => {
  it("adds it to a new shelf, then to an existing one, and shows the count", async () => {
    seedLibrary([film(1, { title: "Details Film" })]);
    seedShelves([createShelf({ name: "Existing", id: "s0" })]);
    render(<App />);
    fireEvent.click(tab("My Library"));
    fireEvent.click(screen.getAllByText(/Details Film/)[0]);
    fireEvent.click(await screen.findByRole("button", { name: /^Shelves/ }, WAIT));

    const dialog = within(screen.getByRole("dialog"));
    fireEvent.change(dialog.getByLabelText("New shelf name"), { target: { value: "Fresh shelf" } });
    fireEvent.click(dialog.getByRole("button", { name: /Create/ }));
    fireEvent.click(dialog.getByRole("checkbox", { name: /Existing/ }));
    expect(storedShelves().map((s) => [s.name, s.films.length]).sort()).toEqual([["Existing", 1], ["Fresh shelf", 1]]);

    fireEvent.click(dialog.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("button", { name: "Shelves (2)" })).toBeTruthy();

    // and off again
    fireEvent.click(screen.getByRole("button", { name: "Shelves (2)" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("checkbox", { name: /Existing/ }));
    expect(storedShelves().find((s) => s.name === "Existing").films).toHaveLength(0);
  });
});

describe("shelves and imported films", () => {
  it("keep a film on its shelves when it's matched to TMDb (its id changes)", async () => {
    settings({ apiKey: "tok" });
    seedLibrary([{ id: "letterboxd:Alien:1979", title: "Alien", year: 1979, rating: 5 }]);
    seedShelves([createShelf({ name: "Space horror", id: "s1", films: [{ id: "letterboxd:Alien:1979", title: "Alien", year: 1979 }] })]);
    vi.stubGlobal("fetch", vi.fn(async (url) => ({
      ok: true,
      status: 200,
      json: async () => (String(url).includes("/search/movie")
        ? { results: [{ id: 348, title: "Alien", original_title: "Alien", release_date: "1979-05-25", poster_path: "/alien.jpg", overview: "In space...", popularity: 60 }] }
        : { results: [] }),
    })));
    render(<App />);
    await waitFor(() => expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)).items[0].id).toBe(348), WAIT);
    await waitFor(() => expect(storedShelves()[0].films[0]).toMatchObject({ id: 348, title: "Alien", poster: "/alien.jpg" }), WAIT);
    expect(storedShelves()[0].films).toHaveLength(1);
  });
});
