// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MysteryReel } from "./MysteryReel.jsx";
import { ContentPrefsContext } from "../../lib/contentContext.js";

afterEach(cleanup);

const film = (id, over = {}) => ({ id, title: `Secret Title ${id}`, year: 1978, tags: ["slasher"], contentFlags: [], scares: 5, scaresRated: true, runtime: 95, watchedDates: [], watchlist: true, overview: `Plot spoiler ${id}`, poster: `/p${id}.jpg`, ...over });

const setup = (library, props = {}, prefs) => {
  const handlers = { onOpenDetails: vi.fn(), onGo: vi.fn() };
  const ui = <MysteryReel library={library} {...handlers} {...props} />;
  render(prefs ? <ContentPrefsContext.Provider value={prefs}>{ui}</ContentPrefsContext.Provider> : ui);
  return handlers;
};
const draw = () => fireEvent.click(screen.getByRole("button", { name: "Draw a mystery film" }));
const body = () => document.body.textContent;

describe("Mystery reel", () => {
  it("starts with a button, not a pick, and says how many films it can draw from", () => {
    setup([film(1), film(2)]);
    expect(screen.getByText(/2 films to draw from/)).toBeTruthy();
    expect(screen.queryByText("Mystery film")).toBeNull();
  });

  it("shows the clue and warnings but never the title, year, poster or plot until revealed", () => {
    setup([film(1, { contentFlags: ["animal-harm"], runtime: 100 })]);
    draw();
    expect(screen.getByText("Mystery film")).toBeTruthy();
    expect(screen.getByText("A #slasher film from the 1970s.")).toBeTruthy();
    expect(screen.getByText("1h 40m")).toBeTruthy();
    expect(screen.getByText(/Animal harm/)).toBeTruthy(); // deciding needs the warnings
    for (const secret of ["Secret Title", "Plot spoiler", "1978"]) expect(body()).not.toContain(secret);
    expect(document.querySelector("img")).toBeNull();
  });

  it("reveals the title and poster on request, and opens its page", () => {
    const { onOpenDetails } = setup([film(1)]);
    draw();
    fireEvent.click(screen.getByRole("button", { name: "Reveal it" }));
    expect(screen.getByRole("heading", { level: 3 }).textContent).toContain("Secret Title 1");
    expect(document.querySelector("img").getAttribute("src")).toContain("/p1.jpg");
    expect(screen.queryByRole("button", { name: "Reveal it" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open its page" }));
    expect(onOpenDetails).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it("'Draw another' moves on without repeating, then says when that's all of them", () => {
    setup([film(1), film(2)]);
    draw();
    const seen = new Set();
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Reveal it" }));
      seen.add(screen.getByRole("heading", { level: 3 }).textContent);
      fireEvent.click(screen.getByRole("button", { name: /Draw another/ }));
    }
    expect(seen.size).toBe(2); // both, once each
    expect(screen.getByText(/That's every film that fits/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByText("Mystery film")).toBeTruthy();
  });

  it("a revealed film is hidden again on the next draw", () => {
    setup([film(1), film(2)]);
    draw();
    fireEvent.click(screen.getByRole("button", { name: "Reveal it" }));
    fireEvent.click(screen.getByRole("button", { name: /Draw another/ }));
    expect(screen.getByText("Mystery film")).toBeTruthy();
    expect(body()).not.toContain("Secret Title");
  });

  it("never draws a film over your limits, even in 'warn' mode", () => {
    const prefs = { showWarnings: true, avoidFlags: ["gore"], maxScares: 10, contentMode: "warn" };
    setup([film(1, { contentFlags: ["gore"] }), film(2)], {}, prefs);
    expect(screen.getByText(/1 film to draw from/)).toBeTruthy();
  });

  it("draws from the watchlist by default and from the library when asked", () => {
    setup([film(1), film(2, { watchlist: false }), film(3, { watchlist: false })]);
    expect(screen.getByText(/1 film to draw from/)).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "library" } });
    expect(screen.getByText(/3 films to draw from/)).toBeTruthy();
  });

  it("with an empty watchlist, offers the whole library", () => {
    setup([film(1, { watchlist: false })]);
    // there's no watchlist, so it starts on the library
    expect(screen.getByRole("combobox").value).toBe("library");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "watchlist" } });
    expect(screen.getByText(/watchlist is empty/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Draw from my whole library" }));
    expect(screen.getByText(/1 film to draw from/)).toBeTruthy();
  });

  it("points an empty library at finding films", () => {
    const { onGo } = setup([]);
    fireEvent.click(screen.getByRole("button", { name: "Find films to add" }));
    expect(onGo).toHaveBeenCalledWith("discover");
  });

  it("says when nothing fits the vibe and draws the closest", () => {
    setup([film(1, { tags: ["cosmic"], scares: 10 })]);
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    fireEvent.click(screen.getByRole("button", { name: "Slasher" }));
    draw();
    expect(screen.getByText(/Nothing matches your vibe exactly/)).toBeTruthy();
  });

  it("keeps the dials behind one line until you ask", () => {
    setup([film(1)]);
    expect(screen.queryByRole("slider")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.getByRole("slider", { name: /How scared/ })).toBeTruthy();
  });

  it("never gives away a tag you typed that's part of the title", () => {
    setup([film(1, { title: "Nightwatcher", tags: ["nightwatcher", "occult"] })]);
    draw();
    expect(body().toLowerCase()).not.toContain("nightwatcher");
    expect(screen.getByText("A #occult film from the 1970s.")).toBeTruthy();
  });
});
