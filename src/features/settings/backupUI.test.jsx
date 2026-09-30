// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackupCard } from "./BackupCard.jsx";
import { BackupReminder } from "../../components/BackupReminder.jsx";
import App from "../../App.jsx";
import { LIBRARY_KEY } from "../../lib/library.js";
import { SETTINGS_KEY } from "../../lib/settings.js";
import { getLastBackup } from "../../lib/backup.js";

afterEach(cleanup);

const fns = () => ({ choose: vi.fn(), reconnect: vi.fn(), disable: vi.fn(), backupNow: vi.fn() });
const backup = (over = {}) => ({ supported: true, status: "off", folderName: "", lastBackupAt: null, error: null, busy: false, ...fns(), ...over });
const app = (over = {}) => ({ installed: false, canInstall: false, install: vi.fn(), persisted: null, canProtect: true, protectStorage: vi.fn(), ...over });

describe("BackupCard: automatic backup", () => {
  it("invites you to pick a folder, and explains what goes in it", () => {
    const b = backup();
    render(<BackupCard backup={b} app={app()} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose backup folder" }));
    expect(b.choose).toHaveBeenCalled();
    expect(screen.getByText(/API keys and settings are not included/)).toBeTruthy();
    expect(screen.getByText(/OneDrive, Dropbox or iCloud/)).toBeTruthy();
  });
  it("shows where it is backing up and when it last did", () => {
    const b = backup({ status: "ready", folderName: "My Backups", lastBackupAt: new Date().toISOString() });
    render(<BackupCard backup={b} app={app()} />);
    expect(screen.getByText("My Backups")).toBeTruthy();
    expect(screen.getByText(/Last backup today/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back up now" }));
    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
    expect(b.backupNow).toHaveBeenCalled();
    expect(b.disable).toHaveBeenCalled();
  });
  it("asks you to reconnect when access lapsed", () => {
    const b = backup({ status: "needs-permission", folderName: "My Backups" });
    render(<BackupCard backup={b} app={app()} />);
    expect(screen.getByRole("alert").textContent).toContain("paused");
    fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
    expect(b.reconnect).toHaveBeenCalled();
  });
  it("shows a failure and lets you retry", () => {
    render(<BackupCard backup={backup({ status: "error", folderName: "X", error: "Disk full" })} app={app()} />);
    expect(screen.getByText(/Disk full/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
  it("explains the alternative where the browser can't do it", () => {
    render(<BackupCard backup={backup({ supported: false, status: "unsupported" })} app={app()} />);
    expect(screen.getByText(/can't save to a folder/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Choose backup folder" })).toBeNull();
  });
});

describe("BackupCard: install and storage", () => {
  it("offers an install button when the browser allows it", () => {
    const a = app({ canInstall: true });
    render(<BackupCard backup={backup()} app={a} />);
    fireEvent.click(screen.getByRole("button", { name: "Install HorrorHub" }));
    expect(a.install).toHaveBeenCalled();
  });
  it("gives menu instructions when it doesn't, and confirms when installed", () => {
    render(<BackupCard backup={backup()} app={app()} />);
    expect(screen.getByText(/Add to Home Screen/)).toBeTruthy();
    cleanup();
    render(<BackupCard backup={backup()} app={app({ installed: true })} />);
    expect(screen.getByText(/You're using HorrorHub as an app/)).toBeTruthy();
  });
  it("lets you ask the browser to keep the data, and says when it has agreed", () => {
    const a = app({ persisted: false });
    render(<BackupCard backup={backup()} app={a} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask the browser to keep my data" }));
    expect(a.protectStorage).toHaveBeenCalled();
    cleanup();
    render(<BackupCard backup={backup()} app={app({ persisted: true })} />);
    expect(screen.getByText(/Protected/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ask the browser to keep my data" })).toBeNull();
  });
});

describe("BackupReminder", () => {
  const handlers = () => ({ onReconnect: vi.fn(), onExport: vi.fn(), onSetup: vi.fn(), onSnooze: vi.fn() });
  it("says nothing when there is nothing to say", () => {
    const { container } = render(<BackupReminder reminder={null} paused={false} supported {...handlers()} />);
    expect(container.textContent).toBe("");
  });
  it("nags a library that was never backed up, and offers the three ways out", () => {
    const h = handlers();
    render(<BackupReminder reminder={{ kind: "never" }} supported {...h} />);
    expect(screen.getByText(/haven't backed it up yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Export now" }));
    fireEvent.click(screen.getByRole("button", { name: "Set up automatic backup" }));
    fireEvent.click(screen.getByRole("button", { name: "Remind me later" }));
    expect(h.onExport).toHaveBeenCalled();
    expect(h.onSetup).toHaveBeenCalled();
    expect(h.onSnooze).toHaveBeenCalled();
  });
  it("doesn't offer automatic backup where it can't work", () => {
    render(<BackupReminder reminder={{ kind: "stale", days: 20 }} supported={false} lastBackupAt="2020-01-01T00:00:00.000Z" {...handlers()} />);
    expect(screen.queryByRole("button", { name: "Set up automatic backup" })).toBeNull();
  });
  it("puts a paused automatic backup first, with one button to fix it", () => {
    const h = handlers();
    render(<BackupReminder reminder={{ kind: "never" }} paused supported {...h} />);
    fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
    expect(h.onReconnect).toHaveBeenCalled();
    expect(screen.queryByText(/haven't backed it up/)).toBeNull();
  });
});

describe("in the app", () => {
  const WAIT = { timeout: 4000 };
  beforeEach(() => {
    window.location.hash = "";
    localStorage.clear();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 2, settings: { flicker: false, fog: false, apiKey: "tok" } }));
    localStorage.setItem("horrorhub.prefs.v1", JSON.stringify({ version: 1, values: { "onboarding.dismissed": true } }));
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results: [] }) })));
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.unstubAllGlobals());
  const withFilm = () => localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: 3, items: [{ id: 1, title: "Backup Film", year: 2000 }] }));

  it("reminds you when a library has never been backed up", async () => {
    withFilm();
    render(<App />);
    expect(await screen.findByText(/haven't backed it up yet/, {}, WAIT)).toBeTruthy();
  });

  it("stays quiet for an empty library", async () => {
    render(<App />);
    await screen.findByText("Tonight's pick", {}, WAIT).catch(() => {});
    expect(screen.queryByText(/haven't backed it up yet/)).toBeNull();
  });

  it("'Export now' downloads a backup and clears the reminder", async () => {
    withFilm();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Export now" }, WAIT));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(getLastBackup()).toBeTruthy();
    await act(async () => {});
    expect(screen.queryByText(/haven't backed it up yet/)).toBeNull();
  });

  it("'Remind me later' hides it", async () => {
    withFilm();
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Remind me later" }, WAIT));
    expect(screen.queryByText(/haven't backed it up yet/)).toBeNull();
  });
});
