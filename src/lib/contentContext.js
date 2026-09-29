import { createContext, useContext } from "react";

// Your content limits, available to any card or list without threading props:
//   { showWarnings, avoidFlags, maxScares, contentMode: "warn" | "hide" }
export const DEFAULT_CONTENT_PREFS = { showWarnings: true, avoidFlags: [], maxScares: 10, contentMode: "warn" };

export const ContentPrefsContext = createContext(DEFAULT_CONTENT_PREFS);

export const useContentPrefs = () => useContext(ContentPrefsContext);
