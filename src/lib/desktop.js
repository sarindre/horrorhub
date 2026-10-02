// True when HorrorHub is running inside its desktop app (electron/preload.cjs sets this) rather than
// in a browser. The desktop app already works offline and is already installed, so the web-only
// pieces (service worker, "Install" prompt) stand down.
export const isDesktopApp = () => typeof window !== "undefined" && window.horrorhubDesktop?.isDesktop === true;
