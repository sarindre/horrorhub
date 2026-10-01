// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AskView } from "./AskView.jsx";
import { clearTmdbCache } from "../../lib/tmdb.js";

const WAIT = { timeout: 3000 };
const movie = (id, title = `Movie ${id}`) => ({ id, title, release_date: "2015-01-01", genre_ids: [27], vote_average: 7, poster_path: null });
// page 1: 1-3, page 2: 3-5 (3 repeats), page 3: 6
const PAGES = { 1: [1, 2, 3].map((i) => movie(i)), 2: [3, 4, 5].map((i) => movie(i)), 3: [movie(6)] };

let urls;
let failPage;
let dogDies;
let offset; // film ids are shifted per test, because warnings are remembered by id for the session

beforeEach(() => {
  localStorage.clear();
  clearTmdbCache();
  urls = [];
  failPage = null;
  dogDies = new Set();
  offset = 0;
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    const u = String(url);
    urls.push(u);
    if (u.includes("/discover/movie")) {
      const page = Number((u.match(/[?&]page=(\d+)/) || [])[1] || 1);
      if (page === failPage) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ results: (PAGES[page] || []).map((m) => ({ ...m, id: m.id + offset, title: `Movie ${m.id + offset}` })), total_pages: 3 }) };
    }
    const m = u.match(/\/movie\/(\d+)\?/);
    if (m) return { ok: true, status: 200, json: async () => ({ title: "x", overview: "", genres: [{ id: 27 }], keywords: { keywords: dogDies.has(Number(m[1])) ? [{ name: "animal cruelty" }] : [] } }) };
    return { ok: true, status: 200, json: async () => ({ results: [] }) };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const setup = (props = {}) => render(<AskView library={[]} apiKey="tok" region="US" onOpenDetails={() => {}} onAdd={() => {}} onUpdate={() => {}} {...props} />);
const ask = (q) => {
  fireEvent.change(screen.getByLabelText("Ask HorrorHub"), { target: { value: q } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
};
const tmdbTitles = () => within(screen.getByRole("region", { name: "From TMDb" })).queryAllByRole("button", { name: /^Movie \d+$/ }).map((b) => b.textContent);
const lookOnTmdb = () => fireEvent.click(screen.getByRole("button", { name: "Also look on TMDb" }));
const moreBtn = () => screen.getByRole("button", { name: /Show more films|Loading…/ });

describe("Ask: more films from TMDb", () => {
  it("shows a first page and offers more", async () => {
    setup();
    ask("under 2 hours");
    lookOnTmdb();
    await waitFor(() => expect(tmdbTitles()).toEqual(["Movie 1", "Movie 2", "Movie 3"]), WAIT);
    expect(screen.getByText(/Showing 3 of 3 found/)).toBeTruthy();
    expect(moreBtn()).toBeTruthy();
  });

  it("adds the next page below without repeating a film, then says that's everything", async () => {
    setup();
    ask("under 2 hours");
    lookOnTmdb();
    await waitFor(() => expect(tmdbTitles().length).toBe(3), WAIT);
    fireEvent.click(moreBtn());
    await waitFor(() => expect(tmdbTitles()).toEqual(["Movie 1", "Movie 2", "Movie 3", "Movie 4", "Movie 5"]), WAIT);
    expect(urls.some((u) => u.includes("/discover/movie") && u.includes("page=2"))).toBe(true);
    fireEvent.click(moreBtn());
    await waitFor(() => expect(tmdbTitles().length).toBe(6), WAIT);
    expect(screen.queryByRole("button", { name: "Show more films" })).toBeNull();
    expect(screen.getByText(/That's everything TMDb has for this/)).toBeTruthy();
  });

  it("counts what your exclusions left out, and keeps checking the new page's warnings", async () => {
    offset = 100;
    dogDies = new Set([102, 104]);
    setup();
    ask("under 2 hours, no animal harm");
    lookOnTmdb();
    await waitFor(() => expect(tmdbTitles()).toEqual(["Movie 101", "Movie 103"]), WAIT);
    expect(screen.getByText(/Showing 2 of 3 found \(1 left out/)).toBeTruthy();
    fireEvent.click(moreBtn());
    await waitFor(() => expect(tmdbTitles()).toEqual(["Movie 101", "Movie 103", "Movie 105"]), WAIT); // movie 104 has what you asked to avoid
    expect(screen.getByText(/Showing 3 of 5 found \(2 left out/)).toBeTruthy();
  });

  it("says so if the next page fails, keeps what you have, and lets you retry", async () => {
    setup();
    ask("under 2 hours");
    lookOnTmdb();
    await waitFor(() => expect(tmdbTitles().length).toBe(3), WAIT);
    failPage = 2;
    fireEvent.click(moreBtn());
    expect((await screen.findByRole("alert", {}, WAIT)).textContent).toMatch(/TMDb returned an error/);
    expect(tmdbTitles().length).toBe(3);
    failPage = null;
    fireEvent.click(await screen.findByRole("button", { name: "Show more films" }, WAIT));
    await waitFor(() => expect(tmdbTitles().length).toBe(5), WAIT);
  });

  it("asking something new starts over", async () => {
    setup();
    ask("under 2 hours");
    lookOnTmdb();
    await waitFor(() => expect(tmdbTitles().length).toBe(3), WAIT);
    fireEvent.click(moreBtn());
    await waitFor(() => expect(tmdbTitles().length).toBe(5), WAIT);
    ask("under 90 minutes");
    expect(screen.queryByRole("button", { name: "Show more films" })).toBeNull();
    lookOnTmdb();
    await waitFor(() => expect(tmdbTitles().length).toBe(3), WAIT);
  });

  it("offers the next page when everything on the first was already yours", async () => {
    const owned = [1, 2, 3].map((id) => ({ id, title: `Movie ${id}`, year: 2015, tags: [], contentFlags: [], watchedDates: [] }));
    setup({ library: owned });
    ask("under 2 hours");
    lookOnTmdb();
    expect(await screen.findByText(/nothing new/i, {}, WAIT)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try the next page" }));
    await waitFor(() => expect(tmdbTitles()).toEqual(["Movie 4", "Movie 5"]), WAIT);
  });
});
