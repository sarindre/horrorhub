// The desktop app's rules about which addresses it will load and open. Pure, so they can be
// tested without starting Electron (see src/desktop/policy.test.js).

const path = require("node:path");

const APP_SCHEME = "app";
const APP_HOST = "horrorhub";

// where the app lives while it's running: app://horrorhub/
const appUrl = (suffix = "") => `${APP_SCHEME}://${APP_HOST}/${suffix}`;

// Is this one of the app's own pages? (anything else must not be loaded inside the window)
function isAppUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === `${APP_SCHEME}:` && u.host === APP_HOST;
  } catch {
    return false;
  }
}

// Links that may be handed to the user's browser: ordinary web addresses only. Never file:,
// app:, javascript: or anything else a page could try to launch.
function isSafeExternal(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

// The file on disk for a request to the app, or null if it would leave the app's folder.
function resolveAppFile(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(String(pathname || "/"));
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const relative = decoded.replace(/^\/+/, "") || "index.html";
  const resolved = path.resolve(root, relative);
  const base = path.resolve(root);
  return resolved === base || resolved.startsWith(base + path.sep) ? resolved : null;
}

// Permissions the app's pages may use. Everything else is refused.
const ALLOWED_PERMISSIONS = new Set(["clipboard-sanitized-write", "notifications", "fileSystem"]);
const permissionAllowed = (permission, requestingUrl) => ALLOWED_PERMISSIONS.has(permission) && isAppUrl(requestingUrl);

module.exports = { APP_SCHEME, APP_HOST, appUrl, isAppUrl, isSafeExternal, resolveAppFile, ALLOWED_PERMISSIONS, permissionAllowed };
