// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App.jsx";
import { WatchDialog } from "./WatchDialog.jsx";
import { dayKey } from "../lib/dates.js";
import { LIBRARY_KEY } from "../lib/library.js";
import { SETTINGS_KEY } from "../lib/settings.js";
import { LAST_WATCH_KEY, longAgoDate, watchPatch } from "../lib/watch.js";

const stored = () => JSON.parse(localStorage.getItem(LIBRARY_KEY)).items;
const localDays = (film) => film.watchedDates.map((iso) => dayKey(new Date(iso)));

beforeEach(() => {
  window.location.hash = "";
  localStorage.clear();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 2, settings: { flicker: false, fog: false, longAgoYear: 1985 } }));
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results: [] }) })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("watchPatch / longAgoDate", () => {
  it("adds a date once and takes the film off the watchlist", () => {
    const p = watchPatch({ watchedDates: ["2025-10-01T07:00:00.000Z"], watchlist: true }, "2025-10-02T07:00:00.000Z");
    expect(p).toEqual({ watchedDates: ["2025-10-01T07:00:00.000Z", "2025-10-02T07:00:00.000Z"], watchlist: false });
    expect(watchPatch(p, "2025-10-02T07:00:00.000Z").watchedDates).toHaveLength(2);
    expect(watchPatch(undefined, "x").watchedDates).toEqual(["x"]);
  });

  it("uses January 1st of the configured long-ago year", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 2, settings: { longAgoYear: 1985 } }));
    const d = longAgoDate();
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([1985, 0, 1]);
  });
});

describe("WatchDialog on its own", () => {
  it("logs the picked day and closes", () => {
    const onLog = vi.fn();
    render(<WatchDialog onLog={onLog} />);
    fireEvent.click(screen.getByRole("button", { name: "Watched" }));
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.change(dialog.getByLabelText("When did you watch it?"), { target: { value: "2025-10-15" } });
    fireEvent.click(dialog.getByRole("button", { name: "Save date" }));
    expect(onLog).toHaveBeenCalledTimes(1);
    expect(dayKey(new Date(onLog.mock.calls[0][0]))).toBe("2025-10-15"); // it used to log the 14th west of UTC
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(localStorage.getItem(LAST_WATCH_KEY)).toBe(onLog.mock.calls[0][0]);
  });

  it("can't pick a day in the future", () => {
    render(<WatchDialog onLog={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Watched" }));
    expect(screen.getByLabelText("When did you watch it?").getAttribute("max")).toBe(dayKey(new Date()));
  });

  it("offers 'long ago' only when asked, and doesn't count it as your last watch", () => {
    const onLog = vi.fn();
    const { unmount } = render(<WatchDialog onLog={onLog} />);
    fireEvent.click(screen.getByRole("button", { name: "Watched" }));
    expect(screen.queryByRole("button", { name: "Watched long ago" })).toBeNull();
    unmount();
    render(<WatchDialog onLog={onLog} longAgo />);
    fireEvent.click(screen.getByRole("button", { name: "Watched" }));
    fireEvent.click(screen.getByRole("button", { name: "Watched long ago" }));
    expect(dayKey(new Date(onLog.mock.calls[0][0]))).toBe("1985-01-01");
    expect(localStorage.getItem(LAST_WATCH_KEY)).toBeNull();
  });

  it("starts from today each time it opens", () => {
    render(<WatchDialog onLog={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Watched" }));
    fireEvent.change(screen.getByLabelText("When did you watch it?"), { target: { value: "2020-01-01" } });
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    fireEvent.click(screen.getByRole("button", { name: "Watched" }));
    expect(screen.getByLabelText("When did you watch it?").value).toBe(dayKey(new Date()));
  });
});

describe("logging a watch in the app", () => {
  const seed = () => localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: 3, items: [{ id: 1, title: "Tonight Film", year: 2000, watchlist: true }] }));

  it("saves the day you picked (not the day before) and takes the film off the watchlist", () => {
    seed();
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "My Library" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Watched" })[0]);
    fireEvent.change(screen.getByLabelText("When did you watch it?"), { target: { value: "2025-10-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Save date" }));
    const film = stored()[0];
    expect(localDays(film)).toEqual(["2025-10-15"]);
    expect(film.watchlist).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("'Watched today' logs today's local day and remembers it for the nudge", () => {
    seed();
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "My Library" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Watched" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Watched today" }));
    expect(localDays(stored()[0])).toEqual([dayKey(new Date())]);
    expect(localStorage.getItem(LAST_WATCH_KEY)).toBeTruthy();
  });

  it("logging the same day twice doesn't double up", () => {
    seed();
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "My Library" }));
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getAllByRole("button", { name: "Watched" })[0]);
      fireEvent.click(screen.getByRole("button", { name: "Watched today" }));
    }
    expect(stored()[0].watchedDates).toHaveLength(1);
  });
});
