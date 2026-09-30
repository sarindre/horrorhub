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

function Harness({ initial = LIBRARY }) {
  const [library] = useState(initial);
  const store = useChallenges({ library });
  return <ChallengesView library={library} store={store} apiKey="" planTime="20:00" onUpdate={noop} onAdd={noop} onOpenDetails={noop} />;
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
    fireEvent.click(screen.getByRole("button", { name: "Show all 31 nights" }));
    expect(within(plan()).getAllByText("Open slot")).toHaveLength(26);
  });

  it("leaves finished challenges without a plan section", () => {
    localStorage.setItem("horrorhub.challenges.v1", JSON.stringify({ version: 1, items: [{ id: "old", templateId: "thirty-days", title: "Old one", kind: "daily", target: 3, startDate: "2026-01-01", endDate: "2026-01-03", match: [], createdAt: "2026-01-01T00:00:00.000Z" }] }));
    render(<Harness />);
    expect(screen.getByText("Old one")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Daily plan" })).toBeNull();
  });
});
