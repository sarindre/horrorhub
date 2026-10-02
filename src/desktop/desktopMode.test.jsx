// @vitest-environment jsdom
import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isDesktopApp } from "../lib/desktop.js";
import { useInstallPrompt } from "../hooks/useInstallPrompt.js";
import { BackupCard } from "../features/settings/BackupCard.jsx";
import { registerServiceWorker } from "../registerSW.js";

const backup = { supported: true, status: "off", folderName: "", lastBackupAt: null, error: null, busy: false, choose() {}, reconnect() {}, disable() {}, backupNow() {} };
const app = { installed: false, canInstall: false, install() {}, persisted: null, canProtect: true, protectStorage() {} };

afterEach(() => {
  cleanup();
  delete window.horrorhubDesktop;
  vi.restoreAllMocks();
});

describe("isDesktopApp", () => {
  it("is false in a browser and true when the desktop shell says so", () => {
    expect(isDesktopApp()).toBe(false);
    window.horrorhubDesktop = { isDesktop: true, platform: "win32" };
    expect(isDesktopApp()).toBe(true);
  });
  it("is not fooled by something that merely has the name", () => {
    window.horrorhubDesktop = { isDesktop: "yes" };
    expect(isDesktopApp()).toBe(false);
  });
});

describe("in the desktop app", () => {
  it("counts as already installed, so there's no Install prompt", () => {
    expect(renderHook(() => useInstallPrompt()).result.current.installed).toBe(false);
    window.horrorhubDesktop = { isDesktop: true };
    expect(renderHook(() => useInstallPrompt()).result.current.installed).toBe(true);
  });

  it("doesn't register the web service worker", () => {
    const register = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });
    const add = vi.spyOn(window, "addEventListener");
    window.horrorhubDesktop = { isDesktop: true };
    registerServiceWorker();
    expect(add.mock.calls.some(([type]) => type === "load")).toBe(false);
    expect(register).not.toHaveBeenCalled();
  });

  it("hides the browser-storage section, which is about browsers clearing data", () => {
    render(<BackupCard backup={backup} app={app} />);
    expect(screen.getByRole("region", { name: "Storage" })).toBeTruthy();
    cleanup();
    window.horrorhubDesktop = { isDesktop: true };
    render(<BackupCard backup={backup} app={{ ...app, installed: true }} />);
    expect(screen.queryByRole("region", { name: "Storage" })).toBeNull();
    expect(screen.getByRole("region", { name: "Install" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Automatic backup" })).toBeTruthy(); // backup still works
  });
});
