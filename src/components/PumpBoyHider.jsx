import { useMemo } from "react";
import pumpboy from "../assets/pumpboy.png";
import { dayKey } from "../lib/dates.js";
import { VIEW_IDS } from "../lib/nav.js";
import { emptyFinds, findMessage, foundToday, hidingPlaces, recordFind } from "../lib/pumpboy.js";
import { useToast } from "../lib/toastContext.js";
import { usePersistentState } from "../lib/usePersistentState.js";

// Where he sits for each hiding spot: most of him is off the edge of the screen.
const SPOT_CLASS = {
  "bottom-right": "bottom-0 right-6 translate-y-[45%] hover:translate-y-[15%] focus-visible:translate-y-[15%]",
  "bottom-left": "bottom-0 left-6 translate-y-[45%] hover:translate-y-[15%] focus-visible:translate-y-[15%]",
  right: "right-0 top-1/2 translate-x-[45%] hover:translate-x-[15%] focus-visible:translate-x-[15%]",
  left: "left-0 top-[60%] -translate-x-[45%] hover:-translate-x-[15%] focus-visible:-translate-x-[15%]",
};

// PumpBoy, hiding on today's chosen screens until you click him. Switch him off in Settings.
export function PumpBoyHider({ view, enabled = true }) {
  const toast = useToast();
  const [finds, setFinds] = usePersistentState("pumpboy.finds", emptyFinds());
  const day = dayKey(new Date());
  const places = useMemo(() => hidingPlaces(day, VIEW_IDS), [day]);
  const spot = places[view];
  if (!enabled || !spot || foundToday(finds, day, view)) return null;

  const find = () => {
    const next = recordFind(finds, day, view);
    setFinds(next);
    toast(findMessage(next.total), { kind: "success" });
  };

  return (
    <button
      type="button"
      onClick={find}
      aria-label="PumpBoy is hiding here. Press to find him."
      title="Psst…"
      className={`fixed z-30 rounded-2xl p-0 opacity-90 motion-safe:transition-transform motion-safe:duration-200 ${SPOT_CLASS[spot]}`}
    >
      <img src={pumpboy} alt="" width={56} height={56} className="h-14 w-14 rounded-2xl" draggable={false} />
    </button>
  );
}
