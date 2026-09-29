import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ToastContext } from "../lib/toastContext.js";

const KIND_STYLES = {
  info: "border-white/15 bg-black/80",
  success: "border-emerald-500/40 bg-emerald-950/80",
  error: "border-red-500/40 bg-red-950/80",
};

// Non-blocking replacement for alert(): stacks up to 4 messages, auto-dismisses.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, { kind = "info", ms = 5000 } = {}) => {
      const id = ++nextId.current;
      setToasts((list) => [...list.slice(-3), { id, message, kind }]);
      timers.current.set(id, setTimeout(() => dismiss(id), ms));
    },
    [dismiss]
  );

  useEffect(() => {
    const active = timers.current;
    return () => active.forEach(clearTimeout);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(92vw,22rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm text-white shadow-lg ${KIND_STYLES[t.kind] || KIND_STYLES.info}`}
          >
            <span className="flex-1">{t.message}</span>
            <button type="button" aria-label="Dismiss" className="opacity-70 hover:opacity-100" onClick={() => dismiss(t.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
