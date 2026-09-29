import React from "react";
const Ctx = React.createContext();

// Uncontrolled by default (pass defaultValue). Pass `value` + `onValueChange` to
// control it, e.g. so a button elsewhere can switch tabs.
export function Tabs({ defaultValue, value, onValueChange, children }) {
  const [inner, setInner] = React.useState(defaultValue);
  const val = value ?? inner;
  const setVal = (next) => {
    onValueChange?.(next);
    if (value === undefined) setInner(next);
  };
  return <Ctx.Provider value={{ val, setVal }}>{children}</Ctx.Provider>;
}
export function TabsList({ className = "", ...p }) {
  return <div role="tablist" {...p} className={"grid gap-3 rounded-xl bg-gray-200/50 dark:bg-white/10 " + className} />;
}
export function TabsTrigger({ value, children }) {
  const { val, setVal } = React.useContext(Ctx);
  const active = val === value;
  const borderCls = active ? "border-red-600 ring-red-600" : "border-zinc-600 ring-zinc-600";
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={() => setVal(value)}
      className={`px-3 py-2 text-sm rounded-xl border-4 ${borderCls} ${active ? "bg-white dark:bg-black shadow" : "opacity-80"} ring-4 ring-offset-0`}
    >
      {children}
    </button>
  );
}
export function TabsContent({ value, className = "", children }) {
  const { val } = React.useContext(Ctx);
  return val === value ? <div role="tabpanel" className={className}>{children}</div> : null;
}
