import { useEffect, useState } from "react";
import { readJSON, writeJSON } from "./storage.js";

// useState that remembers its value in localStorage (per-viewer UI preferences).
export function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => readJSON(key, initial));
  useEffect(() => {
    writeJSON(key, value);
  }, [key, value]);
  return [value, setValue];
}
