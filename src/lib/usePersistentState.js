import { useEffect, useState } from "react";
import { getPref, setPref } from "./prefs.js";

// useState that remembers its value across visits (per-viewer UI preferences).
// `name` is a dotted preference name such as "discover.hideInLibrary".
export function usePersistentState(name, initial) {
  const [value, setValue] = useState(() => getPref(name, initial));
  useEffect(() => {
    setPref(name, value);
  }, [name, value]);
  return [value, setValue];
}
