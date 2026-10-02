// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChallengesView } from "./ChallengesView.jsx";
import { useChallenges } from "../../hooks/useChallenges.js";
import { dayKey } from "../../lib/dates.js";

const NOW = new Date(2026, 9, 3, 12, 0, 0); // Oct 3 2026: Halloween is on, days 1 and 2 are behind us
const film = (id) => ({ id, title: `Film ${id}`, year: 2010, tags: [], keywords: [], contentFlags: [], watchedDates: [], rating: 0, scares: 5, scaresRated: true, watchlist: false });

function Harness({ initial, apiKey = "" }) {
  const [library, setLibrary] = useState(initial);
  const store = useChallenges({ library });
  const upsert = (next) => setLibrary((lib) => (lib.some((i) => i.id === next.id) ? lib.map((i) => (i.id === next.id ? next : i)) : [...lib, next]));
  return <ChallengesView library={library} store={store} apiKey={apiKey} planTime="20:00" onUpdate={upsert} onAdd={upsert} onOpenDetails={() => {}} />;
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const start = () => fireEvent.click(screen.getAllByRole("button", { name: "Start" })[0]);
const progress = () => screen.getByRole("progressbar").parentElement.textContent;

describe("adding a watch to a day you missed", () => {
  it("logs a library film on a past day from the day square", () => {
    render(<Harness initial={[film(1), film(2)]} />);
    start();
    expect(progress()).toMatch(/^0\s*\/\s*31/);
    fireEvent.click(screen.getByRole("button", { name: "Log a film for Oct 1" }));
    fireEvent.change(screen.getByLabelText("Which film?"), { target: { value: "film 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Log it" }));
    expect(progress()).toMatch(/^1\s*\/\s*31/);
    const watches = screen.getByRole("region", { name: "Your watches" });
    expect(within(watches).getByText("Film 2")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Log a film for Oct 1" })).toBeNull(); // that day is covered now
  });

  it("adds a film that isn't in your library yet, from TMDb", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results: [{ id: 99, title: "Brand New", release_date: "2024-01-01", poster_path: null, overview: "", vote_average: 6 }] }) })));
    render(<Harness initial={[film(1)]} apiKey="tok" />);
    start();
    fireEvent.click(screen.getByRole("button", { name: "Log a film I watched" }));
    fireEvent.change(screen.getByLabelText("Which film?"), { target: { value: "brand" } });
    fireEvent.click(screen.getByRole("button", { name: "Search TMDb" }));
    fireEvent.click(await screen.findByRole("button", { name: "Log it" }));
    const watches = screen.getByRole("region", { name: "Your watches" });
    expect(within(watches).getByText("Brand New")).toBeTruthy();
    expect(progress()).toMatch(/^1\s*\/\s*31/);
  });

  it("changes the day of a watch, and removes one", () => {
    const watched = { ...film(1), watchedDates: [new Date(2026, 9, 2).toISOString()] };
    render(<Harness initial={[watched]} />);
    start();
    expect(progress()).toMatch(/^1\s*\/\s*31/);
    fireEvent.click(screen.getByRole("button", { name: "Change day" }));
    fireEvent.change(screen.getByLabelText("New day for Film 1"), { target: { value: dayKey(new Date(2026, 9, 1)) } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(within(screen.getByRole("region", { name: "Your watches" })).getByText(/Thu, Oct 1/)).toBeTruthy();

    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(progress()).toMatch(/^0\s*\/\s*31/);
  });
});
