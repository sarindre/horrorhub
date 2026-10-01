// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App.jsx";
import { LIBRARY_KEY } from "../../lib/library.js";
import { SETTINGS_KEY } from "../../lib/settings.js";
import { clearTmdbCache } from "../../lib/tmdb.js";

const WAIT = { timeout: 4000 };
const stored = () => JSON.parse(localStorage.getItem(LIBRARY_KEY) || '{"items":[]}').items;

beforeEach(() => {
  window.location.hash = "#ask";
  localStorage.clear();
  clearTmdbCache();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 2, settings: { flicker: false, fog: false, apiKey: "tok" } }));
  localStorage.setItem("horrorhub.prefs.v1", JSON.stringify({ version: 1, values: { "onboarding.dismissed": true, "backup.snoozedUntil": "2999-01-01T00:00:00.000Z" } }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    const u = String(url);
    if (u.includes("/discover/movie")) return { ok: true, status: 200, json: async () => ({ results: [{ id: 501, title: "Clean New", release_date: "2019-01-01", genre_ids: [27], vote_average: 7, poster_path: null }] }) };
    return { ok: true, status: 200, json: async () => ({ results: [] }) };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Ask in the real app", () => {
  it("adding a TMDb film to the watchlist really adds it, and says so", async () => {
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Ask HorrorHub", {}, WAIT), { target: { value: "under 2 hours" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    fireEvent.click(await screen.findByRole("button", { name: "Also look on TMDb" }, WAIT));
    fireEvent.click(await screen.findByRole("button", { name: "+ Watchlist" }, WAIT));
    await waitFor(() => expect(stored().find((i) => i.id === 501)?.watchlist).toBe(true), WAIT);
    // and the screen shows it
    expect(await screen.findByText("✓ On watchlist", {}, WAIT)).toBeTruthy();
    expect(screen.getByText(/Added Clean New to your watchlist/)).toBeTruthy(); // the message
    expect(screen.queryByRole("button", { name: "+ Watchlist" })).toBeNull();
  });
});
