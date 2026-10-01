import { useCallback, useEffect, useRef, useState } from "react";
import { touchMessage } from "../lib/touch.js";
import { useToast } from "../lib/toastContext.js";

// For screens that list TMDb films with filters like "Hide already rated" or "Skip titles
// in library". Acting on a card (rating it, adding it) would normally make the filters
// drop it from the list on the spot, so the card vanishes under your hand. This keeps a
// card you've touched on screen until the list changes (`resetKey`), and tells you where
// the film went with a message. `onAdd` is the screen's own add/update function.
export function useTouchedCards({ ratingById = {}, inLibraryIds, watchlistIds, onAdd, resetKey }) {
  const toast = useToast();
  const [touched, setTouched] = useState(() => new Set());
  const said = useRef(new Set());
  const latest = useRef({});
  latest.current = { ratingById, inLibraryIds, watchlistIds };

  // a new page or search starts clean: touched cards are filtered like any other
  useEffect(() => {
    setTouched(new Set());
    said.current = new Set();
  }, [resetKey]);

  const handle = useCallback(
    (item) => {
      setTouched((prev) => (prev.has(item.id) ? prev : new Set(prev).add(item.id)));
      const { ratingById: ratings, inLibraryIds: lib, watchlistIds: list } = latest.current;
      const message = touchMessage(item, { rating: ratings?.[item.id] || 0, inLibrary: !!lib?.has(item.id), onWatchlist: !!list?.has(item.id) });
      if (message && !said.current.has(`${item.id}:${message.key}`)) {
        said.current.add(`${item.id}:${message.key}`);
        toast(message.text, { kind: "success" });
      }
      onAdd?.(item);
    },
    [onAdd, toast]
  );

  return { touched, handle };
}
