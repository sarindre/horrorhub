// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearHandle, folderPermission, loadHandle, saveHandle, supportsFolderBackup, writeFolderBackup } from "./folderBackup.js";
import { fakeDirectory, fakeIndexedDB } from "../test/fakeFolder.js";

afterEach(() => vi.unstubAllGlobals());

describe("supportsFolderBackup", () => {
  it("needs the folder picker and IndexedDB", () => {
    vi.stubGlobal("indexedDB", fakeIndexedDB());
    expect(supportsFolderBackup()).toBe(false);
    vi.stubGlobal("showDirectoryPicker", () => {});
    expect(supportsFolderBackup()).toBe(true);
  });
});

describe("remembering the folder", () => {
  beforeEach(() => vi.stubGlobal("indexedDB", fakeIndexedDB()));
  it("saves, loads and forgets a handle", async () => {
    expect(await loadHandle()).toBeNull();
    const dir = fakeDirectory();
    await saveHandle(dir);
    expect(await loadHandle()).toBe(dir);
    await clearHandle();
    expect(await loadHandle()).toBeNull();
  });
  it("treats broken storage as no folder chosen", async () => {
    vi.stubGlobal("indexedDB", { open: () => { throw new Error("blocked"); } });
    expect(await loadHandle()).toBeNull();
  });
});

describe("folderPermission", () => {
  it("reports what the browser says without asking", async () => {
    const dir = fakeDirectory({ permission: "prompt" });
    expect(await folderPermission(dir)).toBe("prompt");
    expect(dir.calls.requested).toBe(0);
  });
  it("asks only when told to (from a click)", async () => {
    const dir = fakeDirectory({ permission: "prompt" });
    expect(await folderPermission(dir, { ask: true })).toBe("granted");
    expect(dir.calls.requested).toBe(1);
  });
  it("does not ask again when already allowed", async () => {
    const dir = fakeDirectory();
    await folderPermission(dir, { ask: true });
    expect(dir.calls.requested).toBe(0);
  });
  it("says denied if the handle is unusable", async () => {
    expect(await folderPermission({ queryPermission: async () => { throw new Error("stale"); } })).toBe("denied");
  });
});

describe("writeFolderBackup", () => {
  const now = new Date(2026, 5, 20, 12);
  it("writes the latest copy and today's copy", async () => {
    const dir = fakeDirectory();
    await writeFolderBackup(dir, '{"items":[]}', { now });
    expect([...dir.store.keys()].sort()).toEqual(["horrorhub-backup-2026-06-20.json", "horrorhub-backup.json"]);
    expect(dir.store.get("horrorhub-backup.json")).toBe('{"items":[]}');
  });
  it("overwrites rather than piling up when run again the same day", async () => {
    const dir = fakeDirectory();
    await writeFolderBackup(dir, "one", { now });
    await writeFolderBackup(dir, "two", { now });
    expect(dir.store.size).toBe(2);
    expect(dir.store.get("horrorhub-backup-2026-06-20.json")).toBe("two");
  });
  it("deletes dated copies beyond the newest few, and nothing else", async () => {
    const files = { "my-photo.jpg": "x", "horrorhub-backup-2026-06-01.json": "a", "horrorhub-backup-2026-06-02.json": "b", "horrorhub-backup-2026-06-03.json": "c" };
    const dir = fakeDirectory({ files });
    await writeFolderBackup(dir, "new", { now, keep: 2 });
    expect([...dir.store.keys()].sort()).toEqual(["horrorhub-backup-2026-06-03.json", "horrorhub-backup-2026-06-20.json", "horrorhub-backup.json", "my-photo.jpg"]);
  });
  it("fails loudly when access was lost, so the caller can ask again", async () => {
    const dir = fakeDirectory({ permission: "prompt" });
    await expect(writeFolderBackup(dir, "x", { now })).rejects.toThrow();
  });
});
