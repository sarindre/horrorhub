// Minimal date picker built on the native date input.
export function Calendar({ selected, onSelect }){
  const iso = selected ? new Date(selected).toISOString().slice(0,10) : "";
  return (
    <input type="date"
      value={iso}
      onChange={e=> onSelect?.(new Date(e.target.value))}
      className="rounded-xl border px-3 py-2 text-sm"/>
  );
}
