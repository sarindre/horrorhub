// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import { LIBRARY_KEY } from "./lib/library.js";
import { SETTINGS_KEY } from "./lib/settings.js";

const WAIT = { timeout: 5000 };
const film = (id, title) => ({ id, title, year: 2000 + id, poster: `/p${id}.jpg` });

beforeEach(() => {
  window.location.hash = "";
  localStorage.clear();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 2, settings: { flicker: false, fog: false, pumpBoy: false } }));
  localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: 3, items: [film(1, "Alpha Night"), film(2, "Beta Night"), film(3, "Gamma Dusk")] }));
  window.scrollTo = vi.fn();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results: [] }) })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const search = () => screen.getByPlaceholderText(/Search your library/);
const openLibrarySearch = async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: "My Library" }));
  fireEvent.change(await screen.findByPlaceholderText(/Search your library/, {}, WAIT), { target: { value: "Night" } });
  await waitFor(() => expect(screen.queryByText("Gamma Dusk")).toBeNull(), WAIT); // the search has been applied
};
const backButton = () => screen.queryByRole("button", { name: /← Back/ });

describe("Back from a film's details", () => {
  it("returns to the list you were searching, with your search still there (button)", async () => {
    await openLibrarySearch();
    fireEvent.click(screen.getAllByText("Beta Night")[0]);
    expect(await screen.findByRole("button", { name: /← Back/ }, WAIT)).toBeTruthy();
    fireEvent.click(backButton());
    await waitFor(() => expect(backButton()).toBeNull(), WAIT);
    expect(search().value).toBe("Night");
    expect(screen.queryByText("Gamma Dusk")).toBeNull(); // the search filter is still applied
    expect(screen.getAllByText("Beta Night").length).toBeGreaterThan(0);
  });

  it("does the same with the browser's Back button", async () => {
    await openLibrarySearch();
    fireEvent.click(screen.getAllByText("Alpha Night")[0]);
    await screen.findByRole("button", { name: /← Back/ }, WAIT);
    window.history.back();
    await waitFor(() => expect(backButton()).toBeNull(), WAIT);
    expect(search().value).toBe("Night");
    expect(window.location.hash).toBe("#library"); // still on the Library screen, not sent somewhere earlier
  });

  it("puts you back where you were on the page", async () => {
    await openLibrarySearch();
    Object.defineProperty(window, "scrollY", { value: 640, configurable: true });
    fireEvent.click(screen.getAllByText("Alpha Night")[0]);
    await screen.findByRole("button", { name: /← Back/ }, WAIT);
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0); // details open at the top
    fireEvent.click(backButton());
    await waitFor(() => expect(window.scrollTo).toHaveBeenLastCalledWith(0, 640), WAIT);
  });
});
