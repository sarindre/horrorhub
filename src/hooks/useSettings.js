import { useCallback, useEffect, useState } from "react";
import { loadSettings, normalizeSettings, saveSettings } from "../lib/settings.js";

// The single source of truth for settings. Components read `settings` and call
// `update({ key: value })`; every change is validated and persisted.
export function useSettings() {
  const [settings, setSettings] = useState(loadSettings);
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);
  const update = useCallback((patch) => setSettings((prev) => normalizeSettings({ ...prev, ...patch })), []);
  return [settings, update];
}
