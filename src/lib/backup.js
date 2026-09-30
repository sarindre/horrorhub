import { getPref, setPref } from "./prefs.js";
import { dayKey, daysBetween } from "./dates.js";

// Backup rules that don't touch the browser's file APIs: file names, which old
// copies to delete, when to nag, and how to describe "last backed up".
// (The folder writing itself is in folderBackup.js.)

export const LATEST_BACKUP_NAME = "horrorhub-backup.json";
export const KEEP_DATED_BACKUPS = 7;
export const STALE_AFTER_DAYS = 14;
export const SNOOZE_DAYS = 7;

const DATED = /^horrorhub-backup-(\d{4}-\d{2}-\d{2})\.json$/;

export const datedBackupName = (date = new Date()) => `horrorhub-backup-${dayKey(date)}.json`;

// Dated copies to delete so only the newest `keep` remain. Names that aren't
// ours (anything else in the folder) are never touched.
export function datedBackupsToDelete(names, keep = KEEP_DATED_BACKUPS) {
  return names
    .filter((n) => DATED.test(n))
    .sort()
    .reverse()
    .slice(keep);
}

// "never", "today", "yesterday", "3 days ago", "2 weeks ago"...
export function ageLabel(iso, now = new Date()) {
  const at = iso ? new Date(iso) : null;
  if (!at || Number.isNaN(at.getTime())) return "never";
  const days = daysBetween(dayKey(at), dayKey(now));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

// Whether to show the "back up your library" banner, and what it should say.
// Never for an empty library, never while automatic backups are working, and
// not again until a snooze has passed.
export function backupReminder({ hasData, autoActive, lastBackupAt, snoozedUntil, now = new Date() } = {}) {
  if (!hasData || autoActive) return null;
  if (snoozedUntil && new Date(snoozedUntil) > now) return null;
  const last = lastBackupAt ? new Date(lastBackupAt) : null;
  if (!last || Number.isNaN(last.getTime())) return { kind: "never" };
  const days = daysBetween(dayKey(last), dayKey(now));
  return days >= STALE_AFTER_DAYS ? { kind: "stale", days } : null;
}

// ---- what we remember (per browser) ----

export const getLastBackup = () => getPref("backup.lastAt", null);
export const getSnoozedUntil = () => getPref("backup.snoozedUntil", null);
export const recordBackup = (at = new Date()) => setPref("backup.lastAt", at.toISOString());
export const snoozeReminder = (now = new Date(), days = SNOOZE_DAYS) => setPref("backup.snoozedUntil", new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString());
