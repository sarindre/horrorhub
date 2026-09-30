import { useCallback, useEffect, useState } from "react";

const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);

// Installing HorrorHub as an app (Chrome, Edge and Android offer a prompt the
// page can trigger; Safari and Firefox only offer it from their own menus).
// Also reports whether the browser has agreed to keep this site's data.
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [persisted, setPersisted] = useState(null); // null = unknown

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault(); // keep it for our own button
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return "unavailable";
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome; // "accepted" | "dismissed"
  }, [deferred]);

  // Ask the browser not to clear this site's data when space runs low. Chrome and
  // Edge decide from how much you use the site; Firefox asks you.
  const protectStorage = useCallback(async () => {
    try {
      const granted = await navigator.storage.persist();
      setPersisted(granted);
      return granted;
    } catch {
      return false;
    }
  }, []);

  return { canInstall: !!deferred, installed, install, persisted, canProtect: typeof navigator !== "undefined" && !!navigator.storage?.persist, protectStorage };
}
