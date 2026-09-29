import React from "react";
export function Dialog({ open, onOpenChange, children }) {
  return React.Children.map(children, ch => {
    if (ch?.type?.displayName==="DialogContent") return React.cloneElement(ch, {open, onOpenChange});
    if (ch?.type?.displayName==="DialogTrigger") return React.cloneElement(ch, {onOpenChange});
    return ch;
  });
}
export function DialogTrigger({ asChild: _asChild, onOpenChange, children }) {
  const child = React.Children.only(children);
  return React.cloneElement(child, { onClick:()=>onOpenChange?.(true) });
}
DialogTrigger.displayName="DialogTrigger";

export function DialogContent({ open, onOpenChange, className="", children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={()=>onOpenChange?.(false)} />
      <div className={"relative z-10 max-w-lg w-[92vw] rounded-2xl bg-white dark:bg-neutral-900 p-4 "+className}>
        {children}
      </div>
    </div>
  );
}
DialogContent.displayName="DialogContent";
export function DialogHeader({ children }){ return <div className="mb-2">{children}</div>; }
export function DialogTitle({ children }){ return <div className="text-lg font-semibold">{children}</div>; }
