// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/wrappedImage.js", async (importOriginal) => ({ ...(await importOriginal()), wrappedBlob: vi.fn(async () => new Blob(["png"], { type: "image/png" })) }));

import { StatsView } from "./StatsView.jsx";
import { InsightsCard } from "./InsightsCard.jsx";
import { LevelCard } from "./LevelCard.jsx";
import { WrappedCard } from "./WrappedCard.jsx";
import { wrappedBlob } from "../../lib/wrappedImage.js";

const at = (y, m, d) => new Date(y, m - 1, d, 21).toISOString();
let next = 1;
const film = (over = {}) => ({ id: next++, title: `Film ${next}`, year: 2010, tags: [], rating: 0, scares: 5, runtime: 100, watchedDates: [], watchlist: false, notes: "", ...over });

const richLibrary = () => [
  ...Array.from({ length: 4 }, () => film({ rating: 4.5, tags: ["slow-burn"], watchedDates: [at(2025, 10, 3)] })),
  ...Array.from({ length: 4 }, () => film({ rating: 2.5, tags: ["slasher"], watchedDates: [at(2025, 10, 10)] })),
  film({ title: "Older Year", watchedDates: [at(2024, 5, 5)], rating: 4 }),
];

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  wrappedBlob.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("InsightsCard", () => {
  it("shows sentences about your habits with what they rest on", () => {
    render(<InsightsCard items={richLibrary()} />);
    expect(screen.getByText(/You rate #slow-burn films 4.5★ on average, but #slasher only 2.5★/)).toBeTruthy();
    expect(screen.getByText(/Based on 4 and 4 rated films/)).toBeTruthy();
  });
  it("asks for more films when there is little to go on", () => {
    render(<InsightsCard items={[film({ rating: 4 })]} />);
    expect(screen.getByText(/Rate or log 4 more films/)).toBeTruthy();
  });
});

describe("LevelCard", () => {
  it("shows your rank, XP and the distance to the next one", () => {
    const items = Array.from({ length: 12 }, () => film({ watchedDates: [at(2025, 1, 1)] })); // 120 XP
    render(<LevelCard items={items} />);
    expect(screen.getByText("Camper")).toBeTruthy();
    expect(screen.getByText("120")).toBeTruthy();
    expect(screen.getByText(/180 XP to Survivor/)).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Progress to Survivor" }).getAttribute("aria-valuenow")).toBe("10");
  });
  it("starts everyone as Fresh Meat", () => {
    render(<LevelCard items={[]} />);
    expect(screen.getByText("Fresh Meat")).toBeTruthy();
    expect(screen.getByText(/100 XP to Camper/)).toBeTruthy();
  });
  it("shows how close each unearned badge is", () => {
    const items = [film({ tags: ["folk-horror"], watchedDates: [at(2025, 1, 1)] }), film({ tags: ["folk-horror"], watchedDates: [at(2025, 1, 2)] })];
    render(<LevelCard items={items} />);
    const badge = screen.getByText(/Folk Horror Initiate/).closest("li");
    expect(within(badge).getByText("2/3")).toBeTruthy();
  });
});

describe("WrappedCard", () => {
  it("shows your year, personality and the highlights", () => {
    render(<WrappedCard items={richLibrary()} />);
    expect(screen.getByText(/Your 2025 in horror/)).toBeTruthy();
    expect(screen.getByText("The Dread Connoisseur")).toBeTruthy(); // half the year was slow-burn
    expect(screen.getByText("films")).toBeTruthy();
    expect(screen.getByText(/Busiest month:/)).toBeTruthy();
  });
  it("switches year", () => {
    render(<WrappedCard items={richLibrary()} />);
    fireEvent.change(screen.getByLabelText("Year"), { target: { value: "2024" } });
    expect(screen.getByText(/Your 2024 in horror/)).toBeTruthy();
    expect(screen.getByText("film")).toBeTruthy();
  });
  it("hides the year picker when there is only one year", () => {
    render(<WrappedCard items={[film({ watchedDates: [at(2025, 1, 1)] })]} />);
    expect(screen.queryByLabelText("Year")).toBeNull();
  });
  it("saves the card as an image", async () => {
    render(<WrappedCard items={richLibrary()} />);
    fireEvent.click(screen.getByRole("button", { name: /Save as image/ }));
    await waitFor(() => expect(wrappedBlob).toHaveBeenCalled());
    expect(wrappedBlob.mock.calls[0][0].year).toBe(2025);
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  });
  it("copies the summary as text", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<WrappedCard items={richLibrary()} />);
    fireEvent.click(screen.getByRole("button", { name: /Copy as text/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain("My 2025 in horror");
  });
  it("invites you to log watches when there are none", () => {
    render(<WrappedCard items={[film({ rating: 4 })]} />);
    expect(screen.getByText(/Log some watch dates/)).toBeTruthy();
  });
});

describe("StatsView", () => {
  it("puts insights, Wrapped and your rank on the page, and labels estimated scares", () => {
    render(<StatsView items={richLibrary()} />);
    expect(screen.getByText("What your habits say")).toBeTruthy();
    expect(screen.getByText("Horror Wrapped")).toBeTruthy();
    expect(screen.getByText("Rank and badges")).toBeTruthy();
    expect(screen.getByText(/Avg scare \(est\.\)/)).toBeTruthy(); // none of these have a scare level you set
  });
  it("doesn't call it an estimate once you've set most scare levels", () => {
    const items = richLibrary().map((f) => ({ ...f, scares: 7, scaresRated: true }));
    render(<StatsView items={items} />);
    expect(screen.queryByText(/Avg scare \(est\.\)/)).toBeNull();
    expect(screen.getByText("Avg scare")).toBeTruthy();
  });
});
