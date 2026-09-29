// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs.jsx";
import { LIBRARY_KEY } from "./lib/library.js";
import { PREFS_KEY } from "./lib/prefs.js";
import { SETTINGS_KEY } from "./lib/settings.js";

// Real clicks on the real app (jsdom), the first interaction tests in the project.

beforeEach(() => {
  window.location.hash = ""; // the current view lives in the URL, so start each test at the default
  localStorage.clear();
  // keep the decorative overlays from ticking during tests
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 2, settings: { flicker: false, fog: false } }));
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results: [] }) })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const seedLibrary = (items) => localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: 3, items }));
const tab = (name) => screen.getByRole("tab", { name });

describe("Tabs", () => {
  it("works uncontrolled", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList><TabsTrigger value="a">A</TabsTrigger><TabsTrigger value="b">B</TabsTrigger></TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>
    );
    expect(screen.getByText("Panel A")).toBeTruthy();
    fireEvent.click(tab("B"));
    expect(screen.getByText("Panel B")).toBeTruthy();
    expect(screen.queryByText("Panel A")).toBeNull();
    expect(tab("B").getAttribute("aria-selected")).toBe("true");
  });

  it("works controlled: reports the click, and only changes when the value prop does", () => {
    const seen = [];
    function Harness() {
      const [v, setV] = useState("a");
      return (
        <Tabs value={v} onValueChange={(n) => { seen.push(n); if (n !== "b") setV(n); }}>
          <TabsList><TabsTrigger value="a">A</TabsTrigger><TabsTrigger value="b">B</TabsTrigger><TabsTrigger value="c">C</TabsTrigger></TabsList>
          <TabsContent value="a">Panel A</TabsContent>
          <TabsContent value="c">Panel C</TabsContent>
        </Tabs>
      );
    }
    render(<Harness />);
    fireEvent.click(tab("B")); // parent refuses this one
    expect(seen).toEqual(["b"]);
    expect(screen.getByText("Panel A")).toBeTruthy();
    fireEvent.click(tab("C"));
    expect(screen.getByText("Panel C")).toBeTruthy();
  });
});

describe("first run", () => {
  it("welcomes a new user with the checklist and none of the old scaffolding text", () => {
    render(<App />);
    expect(screen.getByText("Welcome to HorrorHub")).toBeTruthy();
    expect(screen.getByText(/0 of 4 steps done/)).toBeTruthy();
    expect(screen.queryByText(/MVP/)).toBeNull();
    expect(screen.queryByText("How to use")).toBeNull();
    expect(screen.getByText(/Back it up any time/)).toBeTruthy();
  });

  it("jumps to Settings from the token step", () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "Open Settings" })[0]);
    expect(screen.getByText("Appearance & Data")).toBeTruthy();
    expect(tab("Settings").getAttribute("aria-selected")).toBe("true");
  });

  it("can be hidden, and stays hidden", () => {
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Hide this" }));
    expect(screen.queryByText("Welcome to HorrorHub")).toBeNull();
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)).values["onboarding.dismissed"]).toBe(true);
    unmount();
    render(<App />);
    expect(screen.queryByText("Welcome to HorrorHub")).toBeNull();
  });

  it("ticks steps off as the library fills in, and disappears once everything is done", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 2, settings: { flicker: false, fog: false, apiKey: "tok", maxScares: 7 } }));
    seedLibrary(["A", "B", "C"].map((t, i) => ({ id: i + 1, title: t, year: 2000, rating: 4, watchedDates: ["2024-10-01T00:00:00.000Z"] })));
    render(<App />);
    expect(screen.queryByText("Welcome to HorrorHub")).toBeNull(); // token, films, 3 rated and a comfort limit: all done
  });

  it("shows only the steps still to do", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 2, settings: { flicker: false, fog: false, apiKey: "tok" } }));
    seedLibrary([{ id: 1, title: "Only One", year: 2000 }]);
    render(<App />);
    expect(screen.getByText(/2 of 4 steps done/)).toBeTruthy();
    expect(screen.getByText(/Rate 3 films/)).toBeTruthy();
  });
});

describe("library", () => {
  it("shows an empty state that points to Discover and importing", () => {
    render(<App />);
    fireEvent.click(tab("My Library"));
    expect(screen.getByText("Your library is empty")).toBeTruthy();
    expect(screen.getByText(/import your Letterboxd or IMDb history/)).toBeTruthy();
  });

  it("filters by tag on click, with counts", () => {
    seedLibrary([
      { id: 1, title: "Slasher One", year: 2000, tags: ["slasher"] },
      { id: 2, title: "Slasher Two", year: 2001, tags: ["slasher", "campy"] },
      { id: 3, title: "Ghost Story", year: 2002, tags: ["haunted"] },
    ]);
    render(<App />);
    fireEvent.click(tab("My Library"));
    expect(screen.getByText("Ghost Story")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /#slasher/ }));
    expect(screen.getByText("Slasher One")).toBeTruthy();
    expect(screen.queryByText("Ghost Story")).toBeNull();
    // a second tag narrows further (films must have both)
    fireEvent.click(screen.getByRole("button", { name: /#campy/ }));
    expect(screen.queryByText("Slasher One")).toBeNull();
    expect(screen.getByText("Slasher Two")).toBeTruthy();
  });

  it("filters by Untagged", () => {
    seedLibrary([
      { id: 1, title: "Tagged", year: 2000, tags: ["slasher"] },
      { id: 2, title: "Plain Film", year: 2001 },
    ]);
    render(<App />);
    fireEvent.click(tab("My Library"));
    fireEvent.click(screen.getByRole("button", { name: /Untagged/ }));
    expect(screen.getByText("Plain Film")).toBeTruthy();
    expect(screen.queryByText("Tagged")).toBeNull();
  });
});

describe("navigation", () => {
  it("leaves a film's details when you click a tab", () => {
    seedLibrary([{ id: 1, title: "Detail Film", year: 2000, overview: "About it." }]);
    render(<App />);
    fireEvent.click(tab("My Library"));
    fireEvent.click(screen.getAllByText("Detail Film")[0]);
    expect(screen.getByText("← Back")).toBeTruthy();
    fireEvent.click(tab("Plan"));
    expect(screen.queryByText("← Back")).toBeNull();
    expect(screen.getByText("Your Watchlist")).toBeTruthy();
  });

  it("changes settings through the real controls and persists them", () => {
    render(<App />);
    fireEvent.click(tab("Settings"));
    const panel = within(screen.getByRole("tabpanel"));
    fireEvent.click(panel.getByRole("button", { name: "Hide them" }));
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)).settings.contentMode).toBe("hide");
    fireEvent.click(panel.getByLabelText("Animal harm"));
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)).settings.avoidFlags).toEqual(["animal-harm"]);
  });
});
