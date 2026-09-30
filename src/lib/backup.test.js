// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { ageLabel, backupReminder, datedBackupName, datedBackupsToDelete, getLastBackup, getSnoozedUntil, recordBackup, snoozeReminder } from "./backup.js";

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0);
const NOW = at(2026, 6, 20);

describe("file names", () => {
  it("names the daily copy by local date", () => {
    expect(datedBackupName(at(2026, 1, 5, 23))).toBe("horrorhub-backup-2026-01-05.json");
  });
  it("keeps the newest dated copies and never touches other files", () => {
    const names = ["horrorhub-backup.json", "notes.txt", "horrorhub-backup-2026-06-01.json", "horrorhub-backup-2026-06-03.json", "horrorhub-backup-2026-06-02.json", "horrorhub-backup-old.json"];
    expect(datedBackupsToDelete(names, 2)).toEqual(["horrorhub-backup-2026-06-01.json"]);
    expect(datedBackupsToDelete(names, 5)).toEqual([]);
    expect(datedBackupsToDelete(["a.json"], 0)).toEqual([]);
  });
});

describe("ageLabel", () => {
  it("speaks in days, then weeks, then months", () => {
    expect(ageLabel(null, NOW)).toBe("never");
    expect(ageLabel("nonsense", NOW)).toBe("never");
    expect(ageLabel(at(2026, 6, 20, 1).toISOString(), NOW)).toBe("today");
    expect(ageLabel(at(2026, 6, 19, 23).toISOString(), NOW)).toBe("yesterday");
    expect(ageLabel(at(2026, 6, 15).toISOString(), NOW)).toBe("5 days ago");
    expect(ageLabel(at(2026, 5, 20).toISOString(), NOW)).toBe("4 weeks ago");
    expect(ageLabel(at(2026, 1, 20).toISOString(), NOW)).toBe("5 months ago");
  });
});

describe("backupReminder", () => {
  const base = { hasData: true, autoActive: false, lastBackupAt: null, snoozedUntil: null, now: NOW };
  it("asks when there's data and no backup has ever been made", () => {
    expect(backupReminder(base)).toEqual({ kind: "never" });
  });
  it("asks again once the last backup is two weeks old", () => {
    expect(backupReminder({ ...base, lastBackupAt: at(2026, 6, 10).toISOString() })).toBeNull();
    expect(backupReminder({ ...base, lastBackupAt: at(2026, 6, 6).toISOString() })).toEqual({ kind: "stale", days: 14 });
  });
  it("stays quiet with no films, while automatic backups work, or while snoozed", () => {
    expect(backupReminder({ ...base, hasData: false })).toBeNull();
    expect(backupReminder({ ...base, autoActive: true })).toBeNull();
    expect(backupReminder({ ...base, snoozedUntil: at(2026, 6, 25).toISOString() })).toBeNull();
    expect(backupReminder({ ...base, snoozedUntil: at(2026, 6, 19).toISOString() })).toEqual({ kind: "never" });
  });
  it("treats an unreadable date as never backed up", () => {
    expect(backupReminder({ ...base, lastBackupAt: "garbage" })).toEqual({ kind: "never" });
  });
});

describe("what we remember", () => {
  beforeEach(() => localStorage.clear());
  it("records the last backup and a snooze", () => {
    expect(getLastBackup()).toBeNull();
    recordBackup(NOW);
    expect(getLastBackup()).toBe(NOW.toISOString());
    snoozeReminder(NOW, 7);
    expect(new Date(getSnoozedUntil()).getTime() - NOW.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
