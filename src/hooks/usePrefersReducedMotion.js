import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
const read = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(QUERY).matches : false);

// True when the device asks for reduced motion. Follows changes live.
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(read);
  useEffect(() => {
    const media = window.matchMedia?.(QUERY);
    if (!media) return;
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}
