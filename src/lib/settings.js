import { readJSON, readString, writeJSON } from "./storage.js";
import { FLAG_IDS } from "./contentFlags.js";

// Settings schema versions
//   v1 (legacy): flat object under "horrorhub.settings.v1" (plus a stray
//      "horrorhub.longAgoYear" key), no defaults, no validation
//   v2: { version: 2, settings: {...} } under "horrorhub.settings.v2", always
//      complete and validated. The v1 key is left in place as a backup.
export const SETTINGS_VERSION = 2;
export const SETTINGS_KEY = "horrorhub.settings.v2";
const LEGACY_SETTINGS_KEY = "horrorhub.settings.v1";
const LEGACY_LONG_AGO_KEY = "horrorhub.longAgoYear";

export const THEMES = ["dark", "light", "system"];
export const CONTENT_MODES = ["warn", "hide"];

export const DEFAULT_SETTINGS = {
  // connections (stored only in this browser)
  apiKey: "",
  omdbKey: "",
  dddKey: "",
  externalOff: false,
  // appearance
  theme: "dark",
  spookyFont: true,
  flicker: true,
  fog: true,
  ambientAudio: false,
  lightsOut: false,
  highContrast: false,
  dyslexic: false,
  // catalog + comfort
  autoTag: true,
  showWarnings: true,
  avoidFlags: [],
  maxScares: 10,
  contentMode: "warn",
  // behavior
  releaseRadar: true,
  nudgeDays: 7,
  longAgoYear: 1900,
  // subgenre mixer weights, 0-2
  mixerGhosts: 1,
  mixerOccult: 1,
  mixerSlasher: 1,
  mixerFolk: 1,
  // weekly watch plan (0 = Sunday)
  planDays: [5, 6],
  planTime: "20:00",
};

const clampInt = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const bool = (value, fallback) => (typeof value === "boolean" ? value : fallback);
const text = (value, fallback = "") => (typeof value === "string" ? value.trim() : fallback);

// Coerces anything settings-shaped into a complete, valid settings object.
// Unknown keys are dropped; invalid values fall back to the default.
export function normalizeSettings(raw) {
  const s = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  const thisYear = new Date().getFullYear();
  const days = Array.isArray(s.planDays) ? s.planDays.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6) : d.planDays;
  return {
    apiKey: text(s.apiKey),
    omdbKey: text(s.omdbKey),
    dddKey: text(s.dddKey),
    externalOff: bool(s.externalOff, d.externalOff),
    theme: THEMES.includes(s.theme) ? s.theme : d.theme,
    spookyFont: bool(s.spookyFont, d.spookyFont),
    flicker: bool(s.flicker, d.flicker),
    fog: bool(s.fog, d.fog),
    ambientAudio: bool(s.ambientAudio, d.ambientAudio),
    lightsOut: bool(s.lightsOut, d.lightsOut),
    highContrast: bool(s.highContrast, d.highContrast),
    dyslexic: bool(s.dyslexic, d.dyslexic),
    autoTag: bool(s.autoTag, d.autoTag),
    showWarnings: bool(s.showWarnings, d.showWarnings),
    avoidFlags: Array.isArray(s.avoidFlags) ? [...new Set(s.avoidFlags.filter((f) => FLAG_IDS.includes(f)))] : d.avoidFlags,
    maxScares: clampInt(s.maxScares, 0, 10, d.maxScares),
    contentMode: CONTENT_MODES.includes(s.contentMode) ? s.contentMode : d.contentMode,
    releaseRadar: bool(s.releaseRadar, d.releaseRadar),
    nudgeDays: clampInt(s.nudgeDays, 3, 14, d.nudgeDays),
    longAgoYear: clampInt(s.longAgoYear, 1800, thisYear, d.longAgoYear),
    mixerGhosts: clampInt(s.mixerGhosts, 0, 2, d.mixerGhosts),
    mixerOccult: clampInt(s.mixerOccult, 0, 2, d.mixerOccult),
    mixerSlasher: clampInt(s.mixerSlasher, 0, 2, d.mixerSlasher),
    mixerFolk: clampInt(s.mixerFolk, 0, 2, d.mixerFolk),
    planDays: [...new Set(days)].sort((a, b) => a - b),
    planTime: typeof s.planTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s.planTime) ? s.planTime : d.planTime,
  };
}

// The content limits, in the shape lib/contentFlags.js expects.
export const getContentPrefs = (settings) => ({ avoidFlags: settings.avoidFlags, maxScares: settings.maxScares });

export function getMixer(settings) {
  return { ghosts: settings.mixerGhosts, occult: settings.mixerOccult, slasher: settings.mixerSlasher, folk: settings.mixerFolk };
}

export function saveSettings(settings) {
  return writeJSON(SETTINGS_KEY, { version: SETTINGS_VERSION, settings });
}

export function loadSettings() {
  const stored = readJSON(SETTINGS_KEY);
  if (stored && typeof stored.settings === "object") return normalizeSettings(stored.settings);

  const legacy = readJSON(LEGACY_SETTINGS_KEY);
  if (legacy && typeof legacy === "object") {
    // longAgoYear used to live in its own key; fold it in when v1 didn't have it
    const legacyYear = Number(readString(LEGACY_LONG_AGO_KEY));
    const migrated = normalizeSettings(legacy.longAgoYear === undefined && legacyYear ? { ...legacy, longAgoYear: legacyYear } : legacy);
    saveSettings(migrated);
    return migrated;
  }
  return normalizeSettings({});
}
