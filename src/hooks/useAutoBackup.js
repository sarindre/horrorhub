import { useCallback, useEffect, useRef, useState } from "react";
import { buildExport } from "../lib/library.js";
import { getLastBackup, recordBackup } from "../lib/backup.js";
import { clearHandle, folderPermission, loadHandle, saveHandle, supportsFolderBackup, writeFolderBackup } from "../lib/folderBackup.js";

const DEBOUNCE_MS = 4000;

// Automatic backups to a folder you pick. `data` is { items, extras }, the same
// shape the Export button uses; when it changes, a copy is written a few seconds
// later. status: "unsupported" | "loading" | "off" | "needs-permission" | "ready" | "error".
// "needs-permission" means the browser forgot the folder access (usually after a
// restart); reconnect() must be called from a click.
export function useAutoBackup(data, { debounceMs = DEBOUNCE_MS } = {}) {
  const supported = supportsFolderBackup();
  const [status, setStatus] = useState(supported ? "loading" : "unsupported");
  const [folderName, setFolderName] = useState("");
  const [lastBackupAt, setLastBackupAt] = useState(getLastBackup);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleRef = useRef(null);
  const dataRef = useRef(data);
  const savedRef = useRef(null); // the data last written, so unchanged data isn't rewritten
  const timerRef = useRef(null);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const writeNow = useCallback(async () => {
    const dir = handleRef.current;
    if (!dir) return false;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    setBusy(true);
    const snapshot = dataRef.current;
    try {
      await writeFolderBackup(dir, JSON.stringify(buildExport(snapshot.items, snapshot.extras), null, 2));
      const at = new Date();
      recordBackup(at);
      savedRef.current = snapshot;
      setLastBackupAt(at.toISOString());
      setStatus("ready");
      setError(null);
      return true;
    } catch (err) {
      if ((await folderPermission(dir)) !== "granted") setStatus("needs-permission");
      else {
        setStatus("error");
        setError(err?.message || "The backup folder couldn't be written to.");
      }
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  // pick up a folder chosen on an earlier visit
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    (async () => {
      const dir = await loadHandle();
      if (cancelled) return;
      if (!dir) return setStatus("off");
      handleRef.current = dir;
      setFolderName(dir.name || "");
      if ((await folderPermission(dir)) === "granted") {
        savedRef.current = dataRef.current; // assume the folder is current; the next change writes
        if (!cancelled) setStatus("ready");
      } else if (!cancelled) setStatus("needs-permission");
    })();
    return () => {
      cancelled = true;
    };
  }, [supported]);

  // write a few seconds after the data changes, and right away if the tab is being hidden
  useEffect(() => {
    if (status !== "ready" || savedRef.current === data) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(writeNow, debounceMs);
    return () => clearTimeout(timerRef.current);
  }, [data, status, debounceMs, writeNow]);
  useEffect(() => {
    if (status !== "ready") return;
    const flush = () => {
      if (document.visibilityState === "hidden" && timerRef.current) writeNow();
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [status, writeNow]);

  const choose = useCallback(async () => {
    let dir;
    try {
      dir = await window.showDirectoryPicker({ id: "horrorhub-backups", mode: "readwrite" });
    } catch (err) {
      if (err?.name !== "AbortError") setError(err?.message || "Couldn't open the folder picker.");
      return false; // cancelled
    }
    if ((await folderPermission(dir, { ask: true })) !== "granted") {
      setError("HorrorHub needs permission to write to that folder.");
      return false;
    }
    await saveHandle(dir);
    handleRef.current = dir;
    setFolderName(dir.name || "");
    setError(null);
    return writeNow();
  }, [writeNow]);

  const reconnect = useCallback(async () => {
    const dir = handleRef.current;
    if (!dir) return false;
    if ((await folderPermission(dir, { ask: true })) !== "granted") return false;
    return writeNow();
  }, [writeNow]);

  const disable = useCallback(async () => {
    clearTimeout(timerRef.current);
    handleRef.current = null;
    savedRef.current = null;
    await clearHandle().catch(() => {});
    setFolderName("");
    setError(null);
    setStatus("off");
  }, []);

  // a manual export counts as a backup too
  const recordManual = useCallback(() => {
    const at = new Date();
    recordBackup(at);
    setLastBackupAt(at.toISOString());
  }, []);

  return { supported, status, folderName, lastBackupAt, error, busy, choose, reconnect, disable, backupNow: writeNow, recordManual };
}
