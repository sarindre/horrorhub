import { useRef } from "react";
import { NAV, groupOf, stepIndex } from "../lib/nav.js";

const TOP = "shrink-0 whitespace-nowrap rounded-xl border-4 px-3 py-2 text-sm ring-4 ring-offset-0";
const SUB = "shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-sm";

// Arrow keys / Home / End move between tabs in a list (WAI-ARIA tabs pattern).
function handleKeys(e, index, count, activate) {
  const key = e.key;
  const next = key === "ArrowRight" ? stepIndex(index, 1, count) : key === "ArrowLeft" ? stepIndex(index, -1, count) : key === "Home" ? 0 : key === "End" ? count - 1 : null;
  if (next === null) return;
  e.preventDefault();
  activate(next);
  e.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
}

// Six sections across the top (scrolls sideways on a phone); a second row of
// pills appears for sections that hold more than one view. Choosing a section
// returns you to the view you last used in it.
export function MainNav({ view, onChange }) {
  const group = groupOf(view);
  const lastInGroup = useRef({});
  lastInGroup.current[group.id] = view;

  const goGroup = (g) => onChange(lastInGroup.current[g.id] || g.views[0].id);

  return (
    <nav aria-label="Main">
      <div role="tablist" aria-label="Sections" className="flex gap-2 overflow-x-auto rounded-xl bg-gray-200/50 p-2 dark:bg-white/10 sm:grid sm:grid-cols-6 sm:overflow-visible">
        {NAV.map((g, i) => {
          const active = g.id === group.id;
          return (
            <button
              key={g.id}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => goGroup(g)}
              onKeyDown={(e) => handleKeys(e, i, NAV.length, (n) => goGroup(NAV[n]))}
              className={`${TOP} ${active ? "border-red-600 bg-white shadow ring-red-600 dark:bg-black" : "border-zinc-600 opacity-80 ring-zinc-600"}`}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      {group.views.length > 1 ? (
        <div role="tablist" aria-label={`${group.label} views`} className="mt-3 flex gap-2 overflow-x-auto">
          {group.views.map((v, i) => {
            const active = v.id === view;
            return (
              <button
                key={v.id}
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => onChange(v.id)}
                onKeyDown={(e) => handleKeys(e, i, group.views.length, (n) => onChange(group.views[n].id))}
                className={`${SUB} ${active ? "border-red-600 bg-red-600/15" : "border-zinc-600 opacity-80 hover:opacity-100"}`}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </nav>
  );
}
