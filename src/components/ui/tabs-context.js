import { createContext, useContext } from "react";

export const TabsContext = createContext();

// The current tab value and a way to change it, for custom tab buttons.
export const useTabs = () => useContext(TabsContext);
