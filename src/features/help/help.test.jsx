// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScreenHelp } from "../../components/ScreenHelp.jsx";
import { HelpView } from "./HelpView.jsx";
import { HELP, FAQ, GLOSSARY } from "../../lib/help.js";
import { getPref } from "../../lib/prefs.js";
import App from "../../App.jsx";
import { SETTINGS_KEY } from "../../lib/settings.js";

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("ScreenHelp", () => {
  it("opens by itself the first time, with what the screen is for", () => {
    render(<ScreenHelp view="tonight" onOpenHelp={() => {}} />);
    const panel = screen.getByRole("region", { name: "Help: Tonight" });
    expect(within(panel).getByText(HELP.tonight.what)).toBeTruthy();
    expect(within(panel).getAllByRole("listitem").length).toBeGreaterThan(HELP.tonight.points.length - 1);
    expect(screen.getByRole("button", { name: "Hide help" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("'Got it' folds it away and it stays folded on the next visit", () => {
    const first = render(<ScreenHelp view="tonight" onOpenHelp={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("region", { name: "Help: Tonight" })).toBeNull();
    expect(getPref("help.seen.tonight", false)).toBe(true);
    first.unmount();
    render(<ScreenHelp view="tonight" onOpenHelp={() => {}} />);
    expect(screen.queryByRole("region", { name: "Help: Tonight" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "How this screen works" })); // always one press away
    expect(screen.getByRole("region", { name: "Help: Tonight" })).toBeTruthy();
  });

  it("each screen keeps its own state", () => {
    const first = render(<ScreenHelp view="tonight" onOpenHelp={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    first.unmount();
    render(<ScreenHelp view="stats" onOpenHelp={() => {}} />);
    expect(screen.getByRole("region", { name: "Help: Stats" })).toBeTruthy();
  });

  it("stays folded when first-visit tips are turned off", () => {
    localStorage.setItem("horrorhub.prefs.v1", JSON.stringify({ version: 1, values: { "help.autoOpen": false } }));
    render(<ScreenHelp view="tonight" onOpenHelp={() => {}} />);
    expect(screen.queryByRole("region", { name: "Help: Tonight" })).toBeNull();
  });

  it("links to the full help", () => {
    const onOpenHelp = vi.fn();
    render(<ScreenHelp view="ask" onOpenHelp={onOpenHelp} />);
    fireEvent.click(screen.getByRole("button", { name: "More help" }));
    expect(onOpenHelp).toHaveBeenCalled();
  });

  it("shows nothing for a screen with no help", () => {
    const { container } = render(<ScreenHelp view="nope" onOpenHelp={() => {}} />);
    expect(container.textContent).toBe("");
  });
});

describe("HelpView", () => {
  it("shows getting started, every screen, the glossary and the questions", () => {
    render(<HelpView onGo={() => {}} />);
    expect(screen.getByText("Getting started")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Screens" })).getAllByRole("listitem", { hidden: true }).length).toBeGreaterThanOrEqual(Object.keys(HELP).length - 1);
    expect(within(screen.getByRole("region", { name: "Words you'll see" })).getByText("Scare level")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Questions" })).getByText(FAQ[0].q)).toBeTruthy();
    expect(GLOSSARY.length).toBeGreaterThan(5);
  });

  it("searches, showing only what matches and opening it", () => {
    render(<HelpView onGo={() => {}} />);
    fireEvent.change(screen.getByLabelText("Search help"), { target: { value: "streak" } });
    expect(screen.queryByText("Getting started")).toBeNull();
    expect(within(screen.getByRole("region", { name: "Words you'll see" })).getByText("Streak")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Keyboard and links" })).toBeNull();
  });

  it("says so when nothing matches", () => {
    render(<HelpView onGo={() => {}} />);
    fireEvent.change(screen.getByLabelText("Search help"), { target: { value: "xyzzyplugh" } });
    expect(screen.getByText(/Nothing in the help matches/)).toBeTruthy();
  });

  it("opens a screen from its help", () => {
    const onGo = vi.fn();
    render(<HelpView onGo={onGo} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Group night", hidden: true }));
    expect(onGo).toHaveBeenCalledWith("group");
  });

  it("turns first-visit tips off and back on, and shows every tip again", () => {
    render(<HelpView onGo={() => {}} />);
    fireEvent.click(screen.getByLabelText(/Open a short tip the first time/));
    expect(getPref("help.autoOpen", true)).toBe(false);
    fireEvent.click(screen.getByLabelText(/Open a short tip the first time/));
    expect(getPref("help.autoOpen", false)).toBe(true);

    localStorage.setItem("horrorhub.prefs.v1", JSON.stringify({ version: 1, values: { "help.seen.tonight": true, "help.seen.stats": true, "help.autoOpen": false } }));
    cleanup();
    render(<HelpView onGo={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Show every tip again" }));
    expect(getPref("help.seen.tonight", true)).toBe(false);
    expect(getPref("help.seen.stats", true)).toBe(false);
    expect(getPref("help.autoOpen", false)).toBe(true);
  });
});

describe("in the app", () => {
  const WAIT = { timeout: 4000 };
  beforeEach(() => {
    window.location.hash = "";
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 2, settings: { flicker: false, fog: false } }));
    localStorage.setItem("horrorhub.prefs.v1", JSON.stringify({ version: 1, values: { "onboarding.dismissed": true, "backup.snoozedUntil": "2999-01-01T00:00:00.000Z" } }));
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results: [] }) })));
  });

  it("explains each screen the first time you visit it, and only the first time", async () => {
    render(<App />);
    expect(screen.getByRole("region", { name: "Help: Tonight" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    fireEvent.click(screen.getByRole("tab", { name: "Stats" }));
    expect(await screen.findByRole("region", { name: "Help: Stats" }, WAIT)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Settings" })); // away and back
    fireEvent.click(screen.getByRole("tab", { name: "Tonight" }));
    expect(screen.queryByRole("region", { name: "Help: Tonight" })).toBeNull();
  });

  it("has a help button in the header that opens the Help screen", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    expect(await screen.findByText("Getting started", {}, WAIT)).toBeTruthy();
    expect(window.location.hash).toBe("#help");
    expect(screen.getByRole("tab", { name: "Help" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("region", { name: /^Help: / })).toBeNull(); // the Help screen doesn't help itself
  });

  it("'More help' goes to the Help screen", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "More help" }));
    expect(await screen.findByLabelText("Search help", {}, WAIT)).toBeTruthy();
  });
});

describe("About", () => {
  it("credits the mascot's artist on the Help screen", () => {
    render(<HelpView onGo={() => {}} />);
    const about = screen.getByRole("region", { name: "About" });
    expect(within(about).getByText(/PumpBoy/)).toBeTruthy();
    expect(within(about).getByText(/totalnightmare/)).toBeTruthy();
    expect(within(about).getByText(/TotalNightmar3 on ArtFight/)).toBeTruthy();
  });
});
