import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "./ui/button.jsx";
import { KnifeIcon } from "./KnifeIcon.jsx";

export function StarRating({ value = 0, onChange, iconClass = "h-5 w-5", showClear = true }) {
  const [hover, setHover] = useState(null);
  const display = hover ?? value;
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-0 flex-nowrap whitespace-nowrap shrink-0" aria-label="Star rating">
      {stars.map((s) => {
        const full = display >= s;
        const half = !full && display >= s - 0.5;
        return (
          <button
            key={s}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(null)}
            onClick={() => { onChange?.(s); try { if (window.navigator?.vibrate) window.navigator.vibrate(10); } catch {} }}
            onContextMenu={(e) => {
              e.preventDefault();
              onChange?.(s - 0.5);
              try { if (window.navigator?.vibrate) window.navigator.vibrate(5); } catch {}
            }}
            className="p-0"
            title="Right-click for halves"
          >
            {full ? (
              <KnifeIcon className={`${iconClass} text-rose-500`} />
            ) : half ? (
              <KnifeIcon className={`${iconClass} text-rose-500 opacity-60`} />
            ) : (
              <KnifeIcon className={`${iconClass} text-zinc-500/40`} />
            )}
          </button>
        );
      })}
      {showClear ? (
        <Button size="icon" variant="ghost" onClick={() => onChange?.(0)} title="Clear rating">
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
