// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import { LIBRARY_KEY } from "./lib/library.js";
import { SETTINGS_KEY } from "./lib/settings.js";

const WAIT = { timeout: 5000 };
const tab = (name) => screen.getByRole("tab", { name });
const queryTab = (name) => screen.queryByRole("tab", { name });
const hash = () => window.location.hash;

beforeEach(async () => {
  window.location.hash = "";
  localStorage.clear();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 2, settings: { flicker: false, fog: false } }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results: [] }) })));
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); // let any pending hashchange from the reset settle
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("main navigation", () => {
  it("shows seven sections and only offers sub-views where a section has more than one", () => {
    render(<App />);
    const sections = within(screen.getByRole("tablist", { name: "Sections" })).getAllByRole("tab").map((t) => t.textContent);
    expect(sections).toEqual(["Tonight", "Discover", "My Library", "For You", "Plan", "Stats", "Settings"]);
    // Tonight has one view, so no sub-tabs; Discover has two
    expect(screen.queryByRole("tablist", { name: /views$/ })).toBeNull();
    fireEvent.click(tab("Discover"));
    expect(screen.getByRole("tablist", { name: "Discover views" })).toBeTruthy();
    fireEvent.click(tab("My Library"));
    expect(screen.getByRole("tablist", { name: "My Library views" })).toBeTruthy(); // All films + Shelves
    fireEvent.click(tab("Stats"));
    expect(screen.queryByRole("tablist", { name: /views$/ })).toBeNull();
  });

  it("switches between the views inside a section", async () => {
    render(<App />);
    fireEvent.click(tab("Discover"));
    fireEvent.click(tab("Rate films"));
    expect(await screen.findByText("Rating Roulette", {}, WAIT)).toBeTruthy();
    expect(tab("Rate films").getAttribute("aria-selected")).toBe("true");
    expect(tab("Discover").getAttribute("aria-selected")).toBe("true"); // still inside the Discover section
    fireEvent.click(tab("Browse"));
    expect(screen.queryByText("Rating Roulette")).toBeNull();
  });

  it("opens For You on picks and reaches Because you liked… from the sub-tabs", async () => {
    render(<App />);
    fireEvent.click(tab("For You"));
    expect(screen.getByText("Night vibe")).toBeTruthy();
    fireEvent.click(tab("Because you liked…"));
    expect(await screen.findByText("Because You Liked…", {}, WAIT)).toBeTruthy();
  });

  it("puts the watchlist and challenges together under Plan", async () => {
    render(<App />);
    fireEvent.click(tab("Plan"));
    expect(screen.getByText("Your Watchlist")).toBeTruthy();
    fireEvent.click(tab("Challenges"));
    expect(await screen.findByText("Start a challenge", {}, WAIT)).toBeTruthy();
  });

  it("returns you to the view you last used in a section", async () => {
    render(<App />);
    fireEvent.click(tab("Plan"));
    fireEvent.click(tab("Challenges"));
    await screen.findByText("Start a challenge", {}, WAIT);
    fireEvent.click(tab("Settings"));
    expect(screen.getByText("Appearance & Data")).toBeTruthy();
    fireEvent.click(tab("Plan"));
    expect(await screen.findByText("Start a challenge", {}, WAIT)).toBeTruthy(); // Challenges, not the Watchlist
    expect(tab("Challenges").getAttribute("aria-selected")).toBe("true");
  });

  it("still lets the first-run checklist jump to a section", () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "Open Settings" })[0]);
    expect(tab("Settings").getAttribute("aria-selected")).toBe("true");
  });
});

describe("keyboard", () => {
  it("moves between sections with the arrow keys, wrapping at the ends, and Home/End", () => {
    render(<App />);
    const tonight = tab("Tonight");
    tonight.focus();
    fireEvent.keyDown(tonight, { key: "ArrowRight" });
    expect(tab("Discover").getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab("Discover"));
    fireEvent.keyDown(tab("Discover"), { key: "ArrowLeft" });
    fireEvent.keyDown(tab("Tonight"), { key: "ArrowLeft" }); // wraps to the last section
    expect(tab("Settings").getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tab("Settings"), { key: "Home" });
    expect(tab("Tonight").getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tab("Tonight"), { key: "End" });
    expect(tab("Settings").getAttribute("aria-selected")).toBe("true");
  });

  it("moves between sub-views too, and ignores unrelated keys", () => {
    render(<App />);
    fireEvent.click(tab("Plan"));
    fireEvent.keyDown(tab("Watchlist & plans"), { key: "ArrowRight" });
    expect(tab("Challenges").getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tab("Challenges"), { key: "a" });
    expect(tab("Challenges").getAttribute("aria-selected")).toBe("true");
  });

  it("only the selected tab is in the tab order (roving tabindex)", () => {
    render(<App />);
    expect(tab("Tonight").getAttribute("tabindex")).toBe("0");
    expect(tab("Discover").getAttribute("tabindex")).toBe("-1");
    fireEvent.click(tab("Discover"));
    expect(tab("Discover").getAttribute("tabindex")).toBe("0");
    expect(tab("My Library").getAttribute("tabindex")).toBe("-1");
    expect(tab("Browse").getAttribute("tabindex")).toBe("0");
    expect(tab("Rate films").getAttribute("tabindex")).toBe("-1");
  });
});

describe("URL and the browser's Back button", () => {
  it("records the current view in the URL", () => {
    render(<App />);
    fireEvent.click(tab("My Library"));
    expect(hash()).toBe("#library");
    fireEvent.click(tab("Settings"));
    expect(hash()).toBe("#settings");
  });

  it("opens the view named in the URL, and falls back to Tonight for junk", () => {
    window.location.hash = "#stats";
    const first = render(<App />);
    expect(tab("Stats").getAttribute("aria-selected")).toBe("true");
    first.unmount();
    window.location.hash = "#not-a-view";
    render(<App />);
    expect(tab("Tonight").getAttribute("aria-selected")).toBe("true");
  });

  it("follows the URL when it changes (Back, Forward, or a bookmark)", async () => {
    render(<App />);
    fireEvent.click(tab("My Library"));
    fireEvent.click(tab("Settings"));
    act(() => { window.history.back(); });
    await waitFor(() => expect(tab("My Library").getAttribute("aria-selected")).toBe("true"), WAIT);
    expect(screen.queryByText("Appearance & Data")).toBeNull();
    act(() => { window.history.forward(); });
    await waitFor(() => expect(tab("Settings").getAttribute("aria-selected")).toBe("true"), WAIT);
  });

  it("closes a film's details when the URL changes", async () => {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: 3, items: [{ id: 1, title: "Nav Detail Film", year: 2000 }] }));
    render(<App />);
    fireEvent.click(tab("My Library"));
    fireEvent.click(screen.getAllByText(/Nav Detail Film/)[0]);
    expect(screen.getByText("← Back")).toBeTruthy();
    act(() => { window.location.hash = "#stats"; });
    await waitFor(() => expect(screen.queryByText("← Back")).toBeNull(), WAIT);
    expect(tab("Stats").getAttribute("aria-selected")).toBe("true");
  });

  it("doesn't pile up history entries when you click the view you're already on", () => {
    render(<App />);
    fireEvent.click(tab("My Library"));
    const length = window.history.length;
    fireEvent.click(tab("My Library"));
    fireEvent.click(tab("My Library"));
    expect(window.history.length).toBe(length);
  });

  it("has no old nine-tab bar left", () => {
    render(<App />);
    expect(queryTab("Rating Roulette")).toBeNull(); // now "Rate films" under Discover
    expect(queryTab("Recommendations")).toBeNull(); // now "For You"
  });
});
