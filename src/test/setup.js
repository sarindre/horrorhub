// Shared test setup (see vite.config.js)

// jsdom does not implement the modal <dialog> methods
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal ||= function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ||= function close() {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

// findBy* and waitFor give up after 1 second by default, which is too tight for a busy machine
// or a cold CI runner when a screen loads lazily. (Tests that need longer still pass their own.)
if (typeof document !== "undefined") {
  const { configure } = await import("@testing-library/react");
  configure({ asyncUtilTimeout: 4000 });
}
