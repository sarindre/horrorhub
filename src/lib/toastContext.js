import { createContext, useContext } from "react";

// Default is a no-op so components still render (e.g. in tests) without a provider.
export const ToastContext = createContext({ toast: () => {} });

// toast(message, { kind: "info" | "error" | "success", ms })
export function useToast() {
  return useContext(ToastContext).toast;
}
