// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoBackup } from "./useAutoBackup.js";
import { saveHandle } from "../lib/folderBackup.js";
import { getLastBackup } from "../lib/backup.js";
import { fakeDirectory, fakeIndexedDB } from "../test/fakeFolder.js";

const WAIT = { timeout: 2000 };
const data = (n = 1) => ({ items: Array.from({ length: n }, (_, i) => ({ id: i + 1, title: `Film ${i + 1}` })), extras: {} });
const setup = (initial = data()) => renderHook(({ d }) => useAutoBackup(d, { debounceMs: 20 }), { initialProps: { d: initial } });
const latest = (dir) => JSON.parse(dir.store.get("horrorhub-backup.json"));

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("indexedDB", fakeIndexedDB());
});
afterEach(() => vi.unstubAllGlobals());

describe("without the folder API", () => {
  it("reports unsupported and does nothing", () => {
    const { result } = setup();
    expect(result.current.status).toBe("unsupported");
    expect(result.current.supported).toBe(false);
  });
});

describe("choosing a folder", () => {
  it("writes a first backup straight away and reports it", async () => {
    const dir = fakeDirectory({ name: "Backups" });
    vi.stubGlobal("showDirectoryPicker", vi.fn(async () => dir));
    const { result } = setup(data(2));
    await waitFor(() => expect(result.current.status).toBe("off"), WAIT);
    await act(async () => { await result.current.choose(); });
    expect(result.current.status).toBe("ready");
    expect(result.current.folderName).toBe("Backups");
    expect(latest(dir).items).toHaveLength(2);
    expect(latest(dir).app).toBe("horrorhub");
    expect(result.current.lastBackupAt).toBeTruthy();
    expect(getLastBackup()).toBe(result.current.lastBackupAt);
  });

  it("does nothing if you cancel the picker", async () => {
    vi.stubGlobal("showDirectoryPicker", vi.fn(async () => { throw new DOMException("cancelled", "AbortError"); }));
    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe("off"), WAIT);
    await act(async () => { await result.current.choose(); });
    expect(result.current.status).toBe("off");
    expect(result.current.error).toBeNull();
  });

  it("says so if the folder can't be written to", async () => {
    vi.stubGlobal("showDirectoryPicker", vi.fn(async () => fakeDirectory({ permission: "denied" })));
    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe("off"), WAIT);
    await act(async () => { await result.current.choose(); });
    expect(result.current.status).toBe("off");
    expect(result.current.error).toMatch(/permission/);
  });
});

describe("keeping the backup current", () => {
  const ready = async () => {
    const dir = fakeDirectory();
    vi.stubGlobal("showDirectoryPicker", vi.fn(async () => dir));
    const initial = data(1);
    const hook = setup(initial);
    await waitFor(() => expect(hook.result.current.status).toBe("off"), WAIT);
    await act(async () => { await hook.result.current.choose(); });
    return { dir, initial, ...hook };
  };

  it("rewrites the backup shortly after the data changes", async () => {
    const { dir, rerender } = await ready();
    expect(latest(dir).items).toHaveLength(1);
    rerender({ d: data(3) });
    await waitFor(() => expect(latest(dir).items).toHaveLength(3), WAIT);
  });

  it("batches quick edits into one write", async () => {
    const { dir, rerender } = await ready();
    const before = dir.calls.writes.length;
    rerender({ d: data(2) });
    rerender({ d: data(3) });
    rerender({ d: data(4) });
    await waitFor(() => expect(latest(dir).items).toHaveLength(4), WAIT);
    await new Promise((r) => setTimeout(r, 80));
    expect(dir.calls.writes.length - before).toBe(2); // the latest copy and the day's copy, once
  });

  it("does not rewrite when nothing changed", async () => {
    const { dir, rerender, initial } = await ready();
    const before = dir.calls.writes.length;
    rerender({ d: initial }); // same data, e.g. an unrelated re-render
    await new Promise((r) => setTimeout(r, 100));
    expect(dir.calls.writes.length).toBe(before);
  });

  it("backs up on demand", async () => {
    const { dir, result } = await ready();
    const before = dir.calls.writes.length;
    await act(async () => { await result.current.backupNow(); });
    expect(dir.calls.writes.length).toBeGreaterThan(before);
  });

  it("asks you to reconnect when the browser revokes access", async () => {
    const { dir, result, rerender } = await ready();
    dir.permission = "prompt"; // the browser forgot
    rerender({ d: data(2) });
    await waitFor(() => expect(result.current.status).toBe("needs-permission"), WAIT);
  });
});

describe("coming back on a later visit", () => {
  it("resumes quietly when access is still allowed, without rewriting", async () => {
    const dir = fakeDirectory({ name: "Backups" });
    vi.stubGlobal("showDirectoryPicker", () => {});
    await saveHandle(dir);
    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe("ready"), WAIT);
    expect(result.current.folderName).toBe("Backups");
    await new Promise((r) => setTimeout(r, 80));
    expect(dir.calls.writes).toEqual([]);
  });

  it("asks to reconnect when permission has lapsed, and resumes after a click", async () => {
    const dir = fakeDirectory({ permission: "prompt" });
    vi.stubGlobal("showDirectoryPicker", () => {});
    await saveHandle(dir);
    const { result } = setup(data(2));
    await waitFor(() => expect(result.current.status).toBe("needs-permission"), WAIT);
    await act(async () => { await result.current.reconnect(); });
    expect(result.current.status).toBe("ready");
    expect(latest(dir).items).toHaveLength(2);
  });

  it("stays paused if you decline", async () => {
    const dir = fakeDirectory({ permission: "prompt" });
    dir.grantOnRequest = false;
    vi.stubGlobal("showDirectoryPicker", () => {});
    await saveHandle(dir);
    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe("needs-permission"), WAIT);
    await act(async () => { await result.current.reconnect(); });
    expect(result.current.status).toBe("needs-permission");
    expect(dir.calls.writes).toEqual([]);
  });
});

describe("turning it off", () => {
  it("forgets the folder", async () => {
    const dir = fakeDirectory();
    vi.stubGlobal("showDirectoryPicker", () => {});
    await saveHandle(dir);
    const { result, unmount } = setup();
    await waitFor(() => expect(result.current.status).toBe("ready"), WAIT);
    await act(async () => { await result.current.disable(); });
    expect(result.current.status).toBe("off");
    unmount();
    const again = setup();
    await waitFor(() => expect(again.result.current.status).toBe("off"), WAIT);
  });

  it("counts a manual export as a backup", async () => {
    vi.stubGlobal("showDirectoryPicker", () => {});
    const { result } = setup();
    await waitFor(() => expect(result.current.status).toBe("off"), WAIT);
    expect(result.current.lastBackupAt).toBeNull();
    act(() => result.current.recordManual());
    expect(result.current.lastBackupAt).toBeTruthy();
    expect(getLastBackup()).toBe(result.current.lastBackupAt);
  });
});
