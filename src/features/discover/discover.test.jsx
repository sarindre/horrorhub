// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Discover } from "./Discover.jsx";
import { clearTmdbCache } from "../../lib/tmdb.js";

const LIST = [1, 2, 3].map((id) => ({ id, title: `Movie ${id}`, release_date: "2024-01-01", poster_path: null, overview: "", vote_average: 6, genre_ids: [27] }));
const PROVIDERS = {
  1: { results: { US: { flatrate: [{ provider_name: "Netflix" }] }, GB: { flatrate: [{ provider_name: "Disney Plus" }] } } },
  2: { results: { US: { ads: [{ provider_name: "Hulu" }] } } },
  3: { results: {} },
};
const WAIT = { timeout: 3000 };

let providerCalls;
let failIds;
beforeEach(() => {
  localStorage.clear();
  clearTmdbCache?.();
  providerCalls = [];
  failIds = new Set();
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    const u = String(url);
    const m = u.match(/\/movie\/(\d+)\/watch\/providers/);
    if (m) {
      providerCalls.push(u);
      if (failIds.has(m[1])) return { ok: false, status: 429, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => PROVIDERS[m[1]] };
    }
    if (u.includes("/discover/movie")) return { ok: true, status: 200, json: async () => ({ results: LIST }) };
    return { ok: true, status: 200, json: async () => ({ results: [] }) };
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const setup = (props = {}) =>
  render(<Discover apiKey="tok" region="US" onAdd={() => {}} onRemove={() => {}} inLibraryIds={new Set()} onToggleWatchlist={() => {}} onOpenDetails={() => {}} watchlistIds={new Set()} ratingById={{}} {...props} />);
const shownTitles = () => screen.queryAllByTitle("Open details").filter((n) => n.textContent.trim()).map((n) => n.textContent.replace(/\s*\(\d{4}\).*$/, ""));

describe("Discover 'Available on' filter", () => {
  it("shows everything until a service is ticked", async () => {
    setup();
    await waitFor(() => expect(shownTitles().length).toBe(3), WAIT);
    expect(providerCalls.length).toBe(0);
  });

  it("keeps only films streaming on the ticked service", async () => {
    setup();
    await waitFor(() => expect(shownTitles().length).toBe(3), WAIT);
    fireEvent.click(screen.getByLabelText("netflix"));
    await waitFor(() => expect(shownTitles()).toEqual(["Movie 1"]), WAIT);
  });

  it("counts ad-supported streaming (Hulu with ads)", async () => {
    setup();
    await waitFor(() => expect(shownTitles().length).toBe(3), WAIT);
    fireEvent.click(screen.getByLabelText("hulu"));
    await waitFor(() => expect(shownTitles()).toEqual(["Movie 2"]), WAIT);
  });

  it("uses the region you chose", async () => {
    setup({ region: "GB" });
    await waitFor(() => expect(shownTitles().length).toBe(3), WAIT);
    fireEvent.click(screen.getByLabelText("disney"));
    await waitFor(() => expect(shownTitles()).toEqual(["Movie 1"]), WAIT);
  });

  it("says what's happening instead of showing an empty page", async () => {
    setup();
    await waitFor(() => expect(shownTitles().length).toBe(3), WAIT);
    fireEvent.click(screen.getByLabelText("prime")); // nothing here streams on Prime
    await waitFor(() => expect(screen.getByText(/None of these are streaming on/)).toBeTruthy(), WAIT);
    expect(shownTitles()).toEqual([]);
  });

  it("tells you when a lookup failed rather than silently hiding the film", async () => {
    failIds.add("1");
    setup({ region: "CA" }); // a region no earlier test used, so nothing is cached
    await waitFor(() => expect(shownTitles().length).toBe(3), WAIT);
    fireEvent.click(screen.getByLabelText("netflix"));
    await waitFor(() => expect(screen.getByText(/couldn't check/i)).toBeTruthy(), WAIT);
  });
});
