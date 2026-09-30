// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChallengesView } from "./ChallengesView.jsx";
import { useChallenges } from "../../hooks/useChallenges.js";

const NOW = new Date(2026, 8, 29, 12, 0, 0); // Sept 29 2026: Halloween hasn't started
const noop = () => {};
const film = (id) => ({ id, title: `Film ${id}`, year: 2010, tags: [], keywords: [], contentFlags: [], watchedDates: [], rating: 0, scares: 1 + (id % 8), scaresRated: true, watchlist: false });
const LIBRARY = Array.from({ length: 40 }, (_, i) => film(i + 1));

function Harness({ initial = LIBRARY, apiKey = "", onAdd = noop }) {
  const [library] = useState(initial);
  const store = useChallenges({ library });
  return <ChallengesView library={library} store={store} apiKey={apiKey} planTime="20:00" onUpdate={noop} onAdd={onAdd} onOpenDetails={noop} />;
}

const startHalloween = () => fireEvent.click(screen.getAllByRole("button", { name: "Start" })[0]);
const plan = () => screen.getByRole("region", { name: "Daily plan" });
const rowTitles = () => within(plan()).queryAllByText(/^Film \d+$/).map((n) => n.textContent);

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("challenge start and daily plan", () => {
  it("offers to start an upcoming challenge today", () => {
    render(<Harness />);
    startHalloween();
    expect(screen.getByText("Not started")).toBeTruthy();
    expect(screen.getByText(/Starts Oct 1, in 2 days/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start today" }));
    expect(screen.getByText("In progress")).toBeTruthy();
    expect(screen.queryByText("Not started")).toBeNull();
    expect(screen.getByText(/Sep 29 – Oct 29/)).toBeTruthy(); // same 31-day length, moved
  });

  it("plans every night, showing a week and expanding to all of them", () => {
    render(<Harness />);
    startHalloween();
    expect(screen.getByText(/Pick a film for every night/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Plan my days" }));
    expect(rowTitles()).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "Show all 31 nights" }));
    expect(rowTitles()).toHaveLength(31);
    expect(new Set(rowTitles()).size).toBe(31); // no repeats
    fireEvent.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(rowTitles()).toHaveLength(7);
  });

  it("swaps a night for a different film", () => {
    render(<Harness />);
    startHalloween();
    fireEvent.click(screen.getByRole("button", { name: "Plan my days" }));
    const before = rowTitles();
    fireEvent.click(screen.getAllByRole("button", { name: "Swap" })[0]);
    const after = rowTitles();
    expect(after[0]).not.toBe(before[0]);
    expect(after.slice(1)).toEqual(before.slice(1));
    expect(after.filter((t) => t === after[0])).toHaveLength(1);
  });

  it("marks tonight once the challenge has started", () => {
    render(<Harness />);
    startHalloween();
    fireEvent.click(screen.getByRole("button", { name: "Start today" }));
    fireEvent.click(screen.getByRole("button", { name: "Plan my days" }));
    expect(within(plan()).getByText(/Tonight/)).toBeTruthy();
  });

  it("keeps the plan between visits, and Clear removes it", () => {
    const first = render(<Harness />);
    startHalloween();
    fireEvent.click(screen.getByRole("button", { name: "Plan my days" }));
    const titles = rowTitles();
    first.unmount();
    render(<Harness />);
    expect(rowTitles()).toEqual(titles);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("button", { name: "Plan my days" })).toBeTruthy();
  });

  it("says so when the library can't fill every night", () => {
    render(<Harness initial={LIBRARY.slice(0, 5)} />);
    startHalloween();
    fireEvent.click(screen.getByRole("button", { name: "Plan my days" }));
    // five films planned, then one line for the 26 empty nights instead of 26 rows
    expect(within(plan()).getByText("26 nights open")).toBeTruthy();
    expect(within(plan()).queryAllByText("Open slot")).toHaveLength(0);
    // nothing else in the library fits, so filling can't help (and doesn't pretend to)
    fireEvent.click(within(plan()).getByRole("button", { name: "Fill from library" }));
    expect(within(plan()).getByText("26 nights open")).toBeTruthy();
  });

  it("fills open nights from the library when it has films to give", () => {
    const base = { id: "halloween-31-2026-10-01", templateId: "halloween-31", title: "31 Nights of Halloween", kind: "daily", target: 31, startDate: "2026-10-01", endDate: "2026-10-31", match: [], createdAt: "2026-09-01T00:00:00.000Z" };
    const plan = [
      { day: "2026-10-01", filmId: null },
      { day: "2026-10-02", filmId: null },
      { day: "2026-10-03", filmId: 1, title: "Film 1" },
    ];
    localStorage.setItem("horrorhub.challenges.v1", JSON.stringify({ version: 1, items: [{ ...base, plan }] }));
    render(<Harness />);
    expect(within(screen.getByRole("region", { name: "Daily plan" })).getByText("2 nights open")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fill from library" }));
    const region = screen.getByRole("region", { name: "Daily plan" });
    expect(within(region).queryByText(/nights? open/)).toBeNull();
    const titles = within(region).queryAllByText(/^Film \d+$/).map((n) => n.textContent);
    expect(titles).toHaveLength(3);
    expect(new Set(titles).size).toBe(3);
  });

  it("leaves finished challenges without a plan section", () => {
    localStorage.setItem("horrorhub.challenges.v1", JSON.stringify({ version: 1, items: [{ id: "old", templateId: "thirty-days", title: "Old one", kind: "daily", target: 3, startDate: "2026-01-01", endDate: "2026-01-03", match: [], createdAt: "2026-01-01T00:00:00.000Z" }] }));
    render(<Harness />);
    expect(screen.getByText("Old one")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Daily plan" })).toBeNull();
  });
});

describe("watch list and TMDb ideas stay compact", () => {
  it("shows three suggestions from your library, then the rest on request, and can be hidden", () => {
    render(<Harness />);
    startHalloween();
    fireEvent.click(screen.getByRole("button", { name: "Build my watch list" }));
    const list = () => screen.getByRole("region", { name: "From your library" });
    expect(within(list()).getAllByRole("button", { name: "+ Watchlist" })).toHaveLength(3);
    fireEvent.click(within(list()).getByRole("button", { name: /^Show all \d+$/ }));
    expect(within(list()).getAllByRole("button", { name: "+ Watchlist" }).length).toBeGreaterThan(3);
    fireEvent.click(within(list()).getByRole("button", { name: "Hide" }));
    expect(screen.queryByText("From your library")).toBeNull();
  });

  it("shows each suggestion's reason once, without repeating 'On your watchlist'", () => {
    render(<Harness initial={LIBRARY.map((f) => ({ ...f, watchlist: true }))} />);
    startHalloween();
    fireEvent.click(screen.getByRole("button", { name: "Build my watch list" }));
    const list = screen.getByRole("region", { name: "From your library" });
    expect(within(list).getAllByText("✓ Listed")).toHaveLength(3);
    expect(list.textContent).not.toContain(" · "); // one reason per film, not the whole list
  });

  it("lists TMDb ideas as compact rows with one button each", async () => {
    const results = [101, 102, 103, 104, 105].map((id) => ({ id, title: `Idea ${id}`, release_date: "1999-01-01", poster_path: null, vote_average: 7.1, genre_ids: [27] }));
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results }) })));
    const onAdd = vi.fn();
    render(<Harness apiKey="tok" onAdd={onAdd} />);
    startHalloween();
    fireEvent.click(screen.getByRole("button", { name: "Find ideas on TMDb" }));
    const ideas = await screen.findByRole("region", { name: "Ideas from TMDb" });
    expect(within(ideas).getAllByRole("button", { name: "+ Watchlist" })).toHaveLength(3);
    fireEvent.click(within(ideas).getAllByRole("button", { name: "+ Watchlist" })[0]);
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 101, watchlist: true }));
    fireEvent.click(within(ideas).getByRole("button", { name: "Show all 5" }));
    expect(within(ideas).getAllByRole("button", { name: "+ Watchlist" })).toHaveLength(5);
    fireEvent.click(within(ideas).getByRole("button", { name: "Hide" }));
    expect(screen.queryByRole("region", { name: "Ideas from TMDb" })).toBeNull();
    vi.unstubAllGlobals();
  });
});
