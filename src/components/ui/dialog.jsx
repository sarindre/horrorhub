import { Children, cloneElement, createContext, useContext, useEffect, useId, useRef } from "react";

// A modal dialog built on the browser's own <dialog> element: it traps focus
// (the page behind is inert), closes on Escape, and returns focus to whatever
// opened it, with no extra library. Controlled: pass `open` and `onOpenChange`.
const DialogContext = createContext(null);
const useDialog = () => useContext(DialogContext) ?? {};

export function Dialog({ open, onOpenChange, children }) {
  const titleId = useId();
  return <DialogContext.Provider value={{ open, onOpenChange, titleId }}>{children}</DialogContext.Provider>;
}

// Wraps the element that opens the dialog (usually a Button) and adds the open behaviour to it.
export function DialogTrigger({ children }) {
  const { onOpenChange } = useDialog();
  const child = Children.only(children);
  return cloneElement(child, {
    "aria-haspopup": "dialog",
    onClick: (e) => {
      child.props.onClick?.(e);
      onOpenChange?.(true);
    },
  });
}

function DialogPanel({ className, children }) {
  const { onOpenChange, titleId } = useDialog();
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    return () => {
      if (el.open) el.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault(); // Escape: let the parent decide, so state and DOM never disagree
        onOpenChange?.(false);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange?.(false); // a click on the dimmed backdrop
      }}
      className={
        "m-auto w-[92vw] max-w-lg rounded-2xl border bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-black/50 dark:bg-neutral-900 dark:text-white " +
        className
      }
    >
      <div className="p-4">{children}</div>
    </dialog>
  );
}

export function DialogContent({ className = "", children }) {
  const { open } = useDialog();
  return open ? <DialogPanel className={className}>{children}</DialogPanel> : null;
}

export function DialogHeader({ children }) {
  return <div className="mb-2">{children}</div>;
}

export function DialogTitle({ children }) {
  const { titleId } = useDialog();
  return (
    <h2 id={titleId} className="text-lg font-semibold">
      {children}
    </h2>
  );
}
