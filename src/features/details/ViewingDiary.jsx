import { X } from "lucide-react";
import { companyLabel, whenLabel, withoutDiaryEntry } from "../../lib/diary.js";
import { parseDay } from "../../lib/dates.js";

const dayText = (day) => parseDay(day).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

// Your notes on each watch of this film: how scared you were, who with, and when.
// Entries come from the "How was it?" part of logging a watch.
export function ViewingDiary({ item, onUpdate }) {
  const entries = [...(item?.diary || [])].reverse(); // newest first
  if (!entries.length) return null;
  return (
    <section aria-label="Viewing diary" className="w-full space-y-1">
      <h4 className="text-xs uppercase tracking-wide opacity-70">Viewing diary</h4>
      <ul className="space-y-1 text-sm">
        {entries.map((e) => {
          const bits = [Number.isFinite(e.scared) ? `Scared ${e.scared}/10` : "", companyLabel(e.company), whenLabel(e.when)].filter(Boolean);
          return (
            <li key={e.day} className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-1.5">
              <span className="min-w-0">
                <span className="opacity-70">{dayText(e.day)}</span> · {bits.join(" · ")}
              </span>
              <button type="button" aria-label={`Remove diary entry for ${dayText(e.day)}`} className="shrink-0 rounded p-1 opacity-60 hover:opacity-100" onClick={() => onUpdate({ ...item, diary: withoutDiaryEntry(item.diary, e.day) })}>
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
