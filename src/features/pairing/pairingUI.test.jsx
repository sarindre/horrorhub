// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PairWith } from "./PairWith.jsx";
import { MarathonPlanner } from "../watchlist/MarathonPlanner.jsx";
import { ContentPrefsContext } from "../../lib/contentContext.js";
import App from "../../App.jsx";
import { LIBRARY_KEY } from "../../lib/library.js";
import { SETTINGS_KEY } from "../../lib/settings.js";

const film = (id, over = {}) => ({ id, title: `Film ${id}`, year: 2010, tags: [], scares: 5, scaresRated: true, runtime: 100, contentFlags: [], watchedDates: [], rating: 0, watchlist: false, ...over });
const base = film(1, { title: "Heavy One", tags: ["slasher"], scares: 9, runtime: 130 });
const library = [
  base,
  film(2, { title: "Gentle One", scares: 3, runtime: 85, tags: ["campy"] }),
  film(3, { title: "Kindred One", tags: ["slasher"], scares: 8, runtime: 95 }),
  film(4, { title: "Quick One", scares: 8, runtime: 70 }),
];

afterEach(cleanup);

describe("PairWith", () => {
  it("stays closed until asked, then shows companions by kind with the length of the night", () => {
    render(<PairWith film={base} library={library} onPlan={() => {}} onOpenDetails={() => {}} />);
    expect(screen.queryByText("Palate cleanser")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pair with…" }));
    expect(screen.getByText("Same wavelength")).toBeTruthy();
    expect(screen.getByText("Palate cleanser")).toBeTruthy();
    expect(screen.getByText("Quick one")).toBeTruthy();
    expect(screen.getByText("Kindred One")).toBeTruthy();
    expect(screen.getByText(/Eases off from 9\/10 to 3\/10/)).toBeTruthy();
    expect(screen.getAllByText(/Night: /).length).toBeGreaterThan(0);
  });

  it("hands the pair to the planner in one tap", () => {
    const onPlan = vi.fn();
    render(<PairWith film={base} library={library} onPlan={onPlan} onOpenDetails={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Pair with…" }));
    const row = screen.getByText("Gentle One").closest("li");
    fireEvent.click(within(row).getByRole("button", { name: "Plan this double feature" }));
    const lineup = onPlan.mock.calls[0][0];
    expect(lineup.films.map((f) => f.title)).toEqual(["Heavy One", "Gentle One"]);
    expect(lineup.reasons[1][0]).toContain("Eases off");
  });

  it("opens a companion's page", () => {
    const onOpenDetails = vi.fn();
    render(<PairWith film={base} library={library} onPlan={() => {}} onOpenDetails={onOpenDetails} />);
    fireEvent.click(screen.getByRole("button", { name: "Pair with…" }));
    fireEvent.click(screen.getByRole("button", { name: /Kindred One/ }));
    expect(onOpenDetails).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });

  it("leaves out films over your limits", () => {
    const prefs = { showWarnings: true, avoidFlags: ["gore"], maxScares: 10, contentMode: "warn" };
    const lib = [base, film(2, { title: "Gory Gentle", scares: 3, contentFlags: ["gore"] })];
    render(
      <ContentPrefsContext.Provider value={prefs}>
        <PairWith film={base} library={lib} onPlan={() => {}} onOpenDetails={() => {}} />
      </ContentPrefsContext.Provider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Pair with…" }));
    expect(screen.queryByText("Gory Gentle")).toBeNull();
    expect(screen.getByText(/Nothing in your library fits yet/)).toBeTruthy();
  });

  it("says why there's no cleanser after a gentle film", () => {
    render(<PairWith film={film(9, { title: "Soft", scares: 2 })} library={library} onPlan={() => {}} onOpenDetails={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Pair with…" }));
    expect(screen.getByText(/already gentle/)).toBeTruthy();
  });
});

describe("the planner in double-feature mode", () => {
  const store = { marathons: [], save: vi.fn(() => ({ name: "saved" })), remove: vi.fn() };
  const pairing = { films: [base, library[1]], reasons: [[], ["Eases off from 9/10 to 3/10"]] };
  const setup = (extra = {}) => render(<MarathonPlanner library={library} watchlist={[]} store={store} onUpdate={() => {}} onOpenDetails={() => {}} pairing={pairing} onClearPairing={() => {}} {...extra} />);

  it("shows exactly the two films in order, why the second, and the night's length", () => {
    setup();
    expect(screen.getByText(/Double feature:/).textContent).toContain("Heavy One + Gentle One");
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toContain("Heavy One");
    expect(items[1]).toContain("Gentle One");
    expect(items[1]).toContain("Eases off from 9/10 to 3/10");
    expect(screen.getByText(/Total:/).closest("div").textContent).toContain("3h 50m"); // 130 + 15 + 85 minutes
  });

  it("hides the controls that don't apply, keeps the start time", () => {
    setup();
    expect(screen.queryByText("Theme")).toBeNull();
    expect(screen.queryByRole("button", { name: /Shuffle/ })).toBeNull();
    expect(screen.getByText("Start")).toBeTruthy();
  });

  it("goes back to planning automatically", () => {
    const onClear = vi.fn();
    setup({ onClearPairing: onClear });
    fireEvent.click(screen.getByRole("button", { name: "Plan automatically instead" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("saves it as a plan named for the pair", () => {
    store.save.mockClear();
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
    const saved = store.save.mock.calls[0][0];
    expect(saved.name).toBe("Double feature: Heavy One + Gentle One");
    expect(saved.themeLabel).toBe("Double feature");
    expect(saved.films.map((f) => f.title)).toEqual(["Heavy One", "Gentle One"]);
  });

  it("is the normal planner when there is no pairing", () => {
    setup({ pairing: null });
    expect(screen.getByText("Theme")).toBeTruthy();
    expect(screen.queryByText(/Double feature:/)).toBeNull();
  });
});

describe("in the app", () => {
  const WAIT = { timeout: 4000 };
  beforeEach(() => {
    window.location.hash = "";
    localStorage.clear();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 2, settings: { flicker: false, fog: false, calibration: { answers: { "halloween-1978": "loved" }, doneAt: "2026-01-01T00:00:00.000Z" } } }));
    localStorage.setItem("horrorhub.prefs.v1", JSON.stringify({ version: 1, values: { "onboarding.dismissed": true, "backup.snoozedUntil": "2999-01-01T00:00:00.000Z" } }));
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: 3, items: library.map((f) => ({ ...f, watchlist: true })) }));
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results: [] }) })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("takes you from Tonight's pick to the planner with both films", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Pair with…" }, WAIT));
    fireEvent.click(screen.getAllByRole("button", { name: "Plan this double feature" })[0]);
    expect(await screen.findByText(/Double feature:/, {}, WAIT)).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Watchlist & plans" }).getAttribute("aria-selected")).toBe("true");
    expect(window.location.hash).toBe("#watchlist");
    expect(screen.getAllByRole("listitem").filter((li) => /^\d\. /.test(li.textContent)).length).toBe(2);
  });
});
