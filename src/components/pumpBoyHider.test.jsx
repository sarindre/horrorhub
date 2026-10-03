// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PumpBoyHider } from "./PumpBoyHider.jsx";
import { ToastProvider } from "./Toast.jsx";
import { hidingPlaces } from "../lib/pumpboy.js";
import { VIEW_IDS } from "../lib/nav.js";
import { getPref } from "../lib/prefs.js";

const DAY = "2026-10-03";
const NOW = new Date(2026, 9, 3, 12, 0, 0);
const places = hidingPlaces(DAY, VIEW_IDS);
const hiding = Object.keys(places)[0];
const notHiding = VIEW_IDS.find((v) => !places[v]);

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const show = (props) => render(<ToastProvider><PumpBoyHider {...props} /></ToastProvider>);
const button = () => screen.queryByRole("button", { name: /PumpBoy is hiding here/ });

describe("PumpBoyHider", () => {
  it("shows up on a screen he's hiding on, and not on others", () => {
    show({ view: notHiding });
    expect(button()).toBeNull();
    cleanup();
    show({ view: hiding });
    expect(button()).toBeTruthy();
  });

  it("is found with a click: a message, a count, and he's gone for the day", () => {
    show({ view: hiding });
    fireEvent.click(button());
    expect(screen.getByText(/You found PumpBoy/)).toBeTruthy();
    expect(button()).toBeNull();
    expect(getPref("pumpboy.finds", null)).toMatchObject({ total: 1, day: DAY, views: [hiding] });
  });

  it("stays gone after a reload", () => {
    show({ view: hiding });
    fireEvent.click(button());
    cleanup();
    show({ view: hiding });
    expect(button()).toBeNull();
  });

  it("doesn't appear when switched off in Settings", () => {
    show({ view: hiding, enabled: false });
    expect(button()).toBeNull();
  });
});
