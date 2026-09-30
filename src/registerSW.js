// Registers the service worker (public/sw.js) so the app works offline. Only in
// the built app: during development a worker would serve stale files.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support is a bonus; the app works without it */
    });
  });
}
