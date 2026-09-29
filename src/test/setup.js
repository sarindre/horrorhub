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
