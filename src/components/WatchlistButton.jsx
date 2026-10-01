import { Button } from "./ui/button.jsx";
import { useToast } from "../lib/toastContext.js";

// "+ Watchlist" for a film from TMDb. It says it worked: a message when you press it, and
// afterwards the button reads "On watchlist" (or "In library" if you already own it).
// `owned` is the library's copy of the film, if there is one.
export function WatchlistButton({ film, owned, onAdd }) {
  const toast = useToast();
  if (owned?.watchlist) return <Button size="sm" variant="ghost" className="shrink-0 whitespace-nowrap" disabled>✓ On watchlist</Button>;
  if (owned) return <Button size="sm" variant="ghost" className="shrink-0 whitespace-nowrap" disabled>✓ In library</Button>;
  return (
    <Button
      size="sm"
      variant="outline"
      className="shrink-0 whitespace-nowrap"
      onClick={() => {
        onAdd?.({ ...film, watchlist: true });
        toast(`Added ${film.title} to your watchlist.`, { kind: "success" });
      }}
    >
      + Watchlist
    </Button>
  );
}
