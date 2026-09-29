import React from "react";
export function Popover({ children }){ return <div>{children}</div>; }
export function PopoverTrigger({ asChild: _asChild, children }){ return children; }
export function PopoverContent({ className="", align: _align, children }){ return <div className={"mt-1 rounded-xl border bg-white dark:bg-neutral-900 p-2 "+className}>{children}</div>; }
