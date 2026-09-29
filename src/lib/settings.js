import { readJSON, readString, writeJSON } from "./storage.js";

const SETTINGS_KEY = "horrorhub.settings.v1";

export function loadSettings() {
  const settings = readJSON(SETTINGS_KEY, {});
  // longAgoYear used to live in its own key; fold it into settings
  if (settings.longAgoYear === undefined) {
    const legacy = Number(readString("horrorhub.longAgoYear"));
    if (legacy) settings.longAgoYear = legacy;
  }
  return settings;
}

export function saveSettings(s) {
  writeJSON(SETTINGS_KEY, s);
}
