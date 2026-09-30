// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Tonight } from "./Tonight.jsx";
import { ContentPrefsContext } from "../../lib/contentContext.js";
import { CALIBRATION_FILMS, emptyCalibration } from "../../lib/calibration.js";

const film = (id, over = {}) => ({
  id, title: `Film ${id}`, year: 2010, tags: [], scares: 5, scaresRated: true, rating: 0, watchedDates: [], contentFlags: [], watchlist: true, ...over,
});

const setup = (props = {}, prefs) => {
  const handlers = { onSaveCalibration: vi.fn(), onOpenDetails: vi.fn(), onGo: vi.fn() };
  const ui = (
    <Tonight library={[film(1), film(2), film(3)]} calibration={emptyCalibration()} mixer={{ ghosts: 1, occult: 1, slasher: 1, folk: 1 }} challenges={[]} {...handlers} {...props} />
  );
  render(prefs ? <ContentPrefsContext.Provider value={prefs}>{ui}</ContentPrefsContext.Provider> : ui);
  return handlers;
};

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("Tonight", () => {
  it("leads with one pick, its reasons and a way to open it", () => {
    const h = setup();
    expect(screen.getByText("Tonight's pick")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Let's watch it" }));
    expect(h.onOpenDetails).toHaveBeenCalledTimes(1);
  });

  it("shows a warning chip and the reason when the pick trips your limits", () => {
    setup(
      { library: [film(1, { contentFlags: ["animal-harm"], title: "Only Film" })] },
      { showWarnings: true, avoidFlags: ["animal-harm"], maxScares: 10, contentMode: "warn" }
    );
    expect(screen.getByText("Only Film", { exact: false })).toBeTruthy();
    expect(screen.getAllByText(/Animal harm/i).length).toBeGreaterThan(0);
  });

  it("labels an estimated scare level as an estimate, and your own as plain", () => {
    setup({ library: [film(1, { scaresRated: false, scares: 5, tags: ["gore"], title: "Est Film" })] });
    expect(screen.getByText(/Scare 6\/10 \(est\.\)/)).toBeTruthy();
    cleanup();
    setup({ library: [film(1, { scares: 7, title: "Rated Film" })] });
    expect(screen.getByText(/Scare 7\/10$/)).toBeTruthy();
  });

  it("'Another' moves to a different film and never repeats the last one", () => {
    setup();
    const title = () => screen.getByRole("heading", { level: 3 }).textContent;
    const first = title();
    fireEvent.click(screen.getByRole("button", { name: /Another/ }));
    const second = title();
    expect(second).not.toBe(first);
    fireEvent.click(screen.getByRole("button", { name: /Another/ }));
    expect(new Set([first, second, title()]).size).toBe(3);
  });

  it("'Not for me' is remembered across visits", () => {
    setup();
    const first = screen.getByRole("heading", { level: 3 }).textContent;
    fireEvent.click(screen.getByRole("button", { name: /Not for me/ }));
    cleanup();
    setup();
    const titles = screen.getAllByText(/Film \d/).map((n) => n.textContent);
    expect(titles.some((t) => t.startsWith(first.split(" (")[0]))).toBe(false);
  });

  it("keeps the dials behind one line until you ask", () => {
    setup();
    expect(screen.queryByRole("slider")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.getByRole("slider", { name: /How scared/ })).toBeTruthy();
  });

  it("sends an empty library to the two ways of filling it", () => {
    const h = setup({ library: [] });
    fireEvent.click(screen.getByRole("button", { name: "Browse films" }));
    expect(h.onGo).toHaveBeenCalledWith("discover");
    fireEvent.click(screen.getByRole("button", { name: /Import from Letterboxd/ }));
    expect(h.onGo).toHaveBeenCalledWith("settings");
  });

  it("offers everything back after you've been through every suggestion", () => {
    setup({ library: [film(1)] });
    fireEvent.click(screen.getByRole("button", { name: /Not for me/ }));
    expect(screen.getByText(/been through every suggestion/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Bring back films I said no to/ }));
    expect(screen.getByText("Tonight's pick")).toBeTruthy();
  });

  it("hide mode keeps over-limit films off the screen and says how many", () => {
    setup(
      { library: [film(1, { contentFlags: ["gore"] }), film(2, { title: "Safe One" })] },
      { showWarnings: true, avoidFlags: ["gore"], maxScares: 10, contentMode: "hide" }
    );
    expect(screen.getByRole("heading", { level: 3 }).textContent).toContain("Safe One");
    expect(screen.getByText(/1 film/i)).toBeTruthy();
  });
});

describe("taste quiz", () => {
  it("is offered while HorrorHub is still learning, saves answers and stops nagging", () => {
    const h = setup();
    fireEvent.click(screen.getByRole("button", { name: "Take the taste quiz" }));
    expect(screen.getByText(`Film 1 of ${CALIBRATION_FILMS.length}`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Loved it" }));
    fireEvent.click(screen.getByRole("button", { name: "Too intense" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish now" }));
    expect(h.onSaveCalibration).toHaveBeenCalledTimes(1);
    const saved = h.onSaveCalibration.mock.calls[0][0];
    expect(saved.answers[CALIBRATION_FILMS[0].key]).toBe("loved");
    expect(saved.answers[CALIBRATION_FILMS[1].key]).toBe("toomuch");
    expect(saved.doneAt).toBeTruthy();
  });

  it("lets you step back and cancel without saving", () => {
    const h = setup();
    fireEvent.click(screen.getByRole("button", { name: "Take the taste quiz" }));
    fireEvent.click(screen.getByRole("button", { name: "Loved it" }));
    fireEvent.click(screen.getByRole("button", { name: "← Back" }));
    expect(screen.getByText(`Film 1 of ${CALIBRATION_FILMS.length}`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(h.onSaveCalibration).not.toHaveBeenCalled();
    expect(screen.getByText("Tonight's pick")).toBeTruthy();
  });

  it("finishing the last film saves without a second click", () => {
    const h = setup();
    fireEvent.click(screen.getByRole("button", { name: "Take the taste quiz" }));
    for (let i = 0; i < CALIBRATION_FILMS.length; i++) fireEvent.click(screen.getByRole("button", { name: "Haven't seen it" }));
    expect(h.onSaveCalibration).toHaveBeenCalledTimes(1);
  });

  it("replaces the invitation with a retake link once taken", () => {
    setup({ calibration: { answers: { [CALIBRATION_FILMS[0].key]: "loved" }, doneAt: "2026-01-01T00:00:00.000Z" } });
    expect(screen.queryByRole("button", { name: "Take the taste quiz" })).toBeNull();
    expect(screen.getByRole("button", { name: "Retake taste quiz" })).toBeTruthy();
  });
});
