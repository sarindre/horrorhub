import React from "react";
export function Calendar({ mode="single", selected, onSelect, initialFocus }){
  const iso = selected ? new Date(selected).toISOString().slice(0,10) : "";
  return (
    <input type="date"
      value={iso}
      onChange={e=> onSelect?.(new Date(e.target.value))}
      className="rounded-xl border px-3 py-2 text-sm"/>
  );
}

