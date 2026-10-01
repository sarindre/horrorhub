// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Discover } from "./Discover.jsx";
import { ToastProvider } from "../../components/Toast.jsx";
import { clearTmdbCache } from "../../lib/tmdb.js";

const WAIT = { timeout: 3000 };
const movies = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => ({ id: from + i, title: `Movie ${from + i}`, release_date: "2020-01-01", poster_path: null, overview: "", vote_average: 6, genre_ids: [27] }));

// page 1: movies 1-20, page 2: 20-39 (20 repeats), page 3: 40-45
const PAGES = { 1: movies(1, 20), 2: movies(20, 39), 3: movies(40, 45) };
let urls;
let failPage;

beforeEach(() => {
  localStorage.clear();
  clearTmdbCache();
  urls = [];
  failPage = null;
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    const u = String(url);
    urls.push(u);
    const page = Number((u.match(/[?&]page=(\d+)/) || [])[1] || 1);
    if (u.includes("/discover/movie") || u.includes("/search/movie")) {
      if (page === failPage) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ results: PAGES[page] || [], total_pages: 3 }) };
    }
    return { ok: true, status: 200, json: async () => ({ results: [] }) };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const setup = (props = {}) =>
  render(
    <ToastProvider>
      <Discover apiKey="tok" region="US" onAdd={() => {}} onRemove={() => {}} inLibraryIds={new Set()} onToggleWatchlist={() => {}} onOpenDetails={() => {}} watchlistIds={new Set()} ratingById={{}} {...props} />
    </ToastProvider>
  );
const shown = () => screen.queryAllByTitle("Open details").filter((n) => n.textContent.trim()).length;
const more = () => screen.getByRole("button", { name: /Show more films|Loading…/ });

describe("Discover: Show more films", () => {
  it("starts with one page and offers more", async () => {
    setup();
    await waitFor(() => expect(shown()).toBe(20), WAIT);
    expect(screen.getByText(/Showing 20 of 20 loaded/)).toBeTruthy();
    expect(more()).toBeTruthy();
  });

  it("adds the next page below, without repeating a film", async () => {
    setup();
    await waitFor(() => expect(shown()).toBe(20), WAIT);
    fireEvent.click(more());
    await waitFor(() => expect(shown()).toBe(39), WAIT); // 20 + 19 new (movie 20 came back on page 2)
    expect(urls.some((u) => u.includes("page=2"))).toBe(true);
    expect(screen.getByText(/Showing 39 of 39 loaded/)).toBeTruthy();
  });

  it("goes on to the last page and then says that's everything", async () => {
    setup();
    await waitFor(() => expect(shown()).toBe(20), WAIT);
    fireEvent.click(more());
    await waitFor(() => expect(shown()).toBe(39), WAIT);
    fireEvent.click(more());
    await waitFor(() => expect(shown()).toBe(45), WAIT);
    expect(screen.queryByRole("button", { name: "Show more films" })).toBeNull();
    expect(screen.getByText(/That's everything for this list/)).toBeTruthy();
  });

  it("counts what your filters hide, and still lets you load more", async () => {
    localStorage.setItem("horrorhub.prefs.v1", JSON.stringify({ version: 1, values: { "discover.hideInLibrary": true } }));
    setup({ inLibraryIds: new Set([1, 2, 3, 4, 5]) });
    await waitFor(() => expect(shown()).toBe(15), WAIT);
    expect(screen.getByText(/Showing 15 of 20 loaded \(5 hidden by your filters\)/)).toBeTruthy();
    fireEvent.click(more());
    await waitFor(() => expect(shown()).toBe(34), WAIT);
  });

  it("a new search starts again from the first page", async () => {
    setup();
    await waitFor(() => expect(shown()).toBe(20), WAIT);
    fireEvent.click(more());
    await waitFor(() => expect(shown()).toBe(39), WAIT);
    fireEvent.change(screen.getByPlaceholderText(/Search horror/), { target: { value: "alien" } });
    fireEvent.keyDown(screen.getByPlaceholderText(/Search horror/), { key: "Enter" });
    await waitFor(() => expect(shown()).toBe(20), WAIT);
    expect(urls.filter((u) => u.includes("/search/movie") && u.includes("query=alien")).length).toBeGreaterThan(0);
    fireEvent.click(more());
    await waitFor(() => expect(urls.some((u) => u.includes("/search/movie") && u.includes("query=alien") && u.includes("page=2"))).toBe(true), WAIT);
  });

  it("changing the sort starts again too", async () => {
    setup();
    await waitFor(() => expect(shown()).toBe(20), WAIT);
    fireEvent.click(more());
    await waitFor(() => expect(shown()).toBe(39), WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Newest" }));
    await waitFor(() => expect(shown()).toBe(20), WAIT);
  });

  it("says so if a page can't be loaded, keeps what you have, and lets you try again", async () => {
    setup();
    await waitFor(() => expect(shown()).toBe(20), WAIT);
    failPage = 2;
    fireEvent.click(more());
    expect(await screen.findByText(/TMDb returned an error/, {}, WAIT)).toBeTruthy();
    expect(shown()).toBe(20);
    failPage = null;
    fireEvent.click(await screen.findByRole("button", { name: "Show more films" }, WAIT));
    await waitFor(() => expect(shown()).toBe(39), WAIT);
  });

  it("has no button without a token", () => {
    setup({ apiKey: "" });
    expect(screen.queryByRole("button", { name: "Show more films" })).toBeNull();
  });
});
