import { useCallback, useEffect, useState } from "react";
import { DEFAULT_VIEW, isView } from "../lib/nav.js";

const readHash = () => {
  if (typeof window === "undefined") return DEFAULT_VIEW;
  const id = window.location.hash.replace(/^#\/?/, "");
  return isView(id) ? id : DEFAULT_VIEW;
};

// The current view, kept in the URL hash (#library, #plan...) so the browser's
// Back and Forward buttons move between views instead of leaving the app, and
// a view can be bookmarked. Changing the view adds a history entry.
export function useHashTab() {
  const [view, setViewState] = useState(readHash);

  useEffect(() => {
    const onChange = () => setViewState(readHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const setView = useCallback((next) => {
    if (!isView(next)) return;
    if (window.location.hash !== `#${next}`) window.location.hash = next; // fires hashchange
    setViewState(next);
  }, []);

  return [view, setView];
}
