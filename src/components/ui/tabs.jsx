import { useState } from "react";
import { TabsContext, useTabs } from "./tabs-context.js";

// Panels for a set of views. Uncontrolled by default (pass defaultValue), or
// control it with `value` + `onValueChange`. The clickable tabs live elsewhere
// (see components/MainNav); custom buttons can use useTabs() from ./tabs-context.js.
export function Tabs({ defaultValue, value, onValueChange, children }) {
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const setValue = (next) => {
    onValueChange?.(next);
    if (value === undefined) setInner(next);
  };
  return <TabsContext.Provider value={{ value: current, setValue }}>{children}</TabsContext.Provider>;
}

export function TabsContent({ value, className = "", children }) {
  const { value: current } = useTabs();
  return current === value ? (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  ) : null;
}
