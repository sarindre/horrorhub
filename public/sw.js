// HorrorHub service worker: makes the app open and work without internet.
//
// - Everything the build produced is stored when the worker installs (the list
//   below is filled in by the build, see vite.config.js), so even screens you
//   haven't opened yet work offline.
// - Opening the app tries the network first (so updates arrive) and falls back
//   to the stored copy.
// - Posters from TMDb are stored as you see them, up to a limit.
// - Everything else (the TMDb API, OMDb...) is left alone: no network, no data,
//   and the app already explains that.
// Your library is not stored here; it lives in localStorage.

const BUILD = "__BUILD__";
const PRECACHE = /*__PRECACHE__*/[];

const SHELL_PREFIX = "horrorhub-shell-";
const SHELL = `${SHELL_PREFIX}${BUILD}`;
const POSTERS = "horrorhub-posters-v1";
const MAX_POSTERS = 300;
const KEEP_SHELLS = 2; // the current build and the one before, so a tab still on the old build can load its screens

// Stored files are matched without looking at the Vary header: servers often send
// "Vary: Origin", and a page's script request carries an Origin header that the
// worker's own pre-fetch did not, which would make every lookup miss.
const LOOKUP = { ignoreVary: true };

const scopeUrl = () => self.registration.scope;
const fromScope = (path) => new URL(path, scopeUrl()).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE.map(fromScope)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const shells = (await caches.keys()).filter((k) => k.startsWith(SHELL_PREFIX) && k !== SHELL);
      await Promise.all(shells.slice(0, Math.max(0, shells.length - (KEEP_SHELLS - 1))).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(request.mode === "navigate" ? openApp(request) : fromCache(request));
  } else if (url.hostname === "image.tmdb.org") {
    event.respondWith(poster(request));
  }
});

// Opening the app: the network if it answers, else the stored page.
async function openApp(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(fromScope("./"), response.clone());
    return response;
  } catch {
    return (await cache.match(fromScope("./"), LOOKUP)) || (await cache.match(fromScope("index.html"), LOOKUP)) || Response.error();
  }
}

// Built files have content hashes in their names, so a stored one is always right.
async function fromCache(request) {
  const hit = await caches.match(request, LOOKUP);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) (await caches.open(SHELL)).put(request, response.clone());
  return response;
}

async function poster(request) {
  const cache = await caches.open(POSTERS);
  const hit = await cache.match(request.url, LOOKUP);
  if (hit) return hit;
  try {
    // ask with CORS so the stored copy is a normal response, not an opaque one that counts for megabytes of quota
    const response = await fetch(request.url, { mode: "cors" });
    if (response.ok) {
      await cache.put(request.url, response.clone());
      trim(cache);
    }
    return response;
  } catch {
    try {
      return await fetch(request); // CORS refused: still show it, just don't keep it
    } catch {
      return Response.error(); // offline and never seen: the card shows its placeholder
    }
  }
}

async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_POSTERS)).map((k) => cache.delete(k)));
}
