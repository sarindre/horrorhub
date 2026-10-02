// Registers the service worker (public/sw.js) so the app works offline. Only in
// the built app: during development a worker would serve stale files.
import { isDesktopApp } from "./lib/desktop.js";

export function registerServiceWorker() {
  if (isDesktopApp()) return; // the desktop app ships its files, so it needs no offline cache
  if (!import.meta.env.PROD || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support is a bonus; the app works without it */
    });
  });
}
