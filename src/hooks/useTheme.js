import { useEffect } from "react";

// Applies the theme setting: toggles the `dark` class Tailwind's dark: variant
// keys off (see index.css) and follows the OS when the setting is "system".
export function useTheme(theme) {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && !!media?.matches);
      root.classList.toggle("dark", dark);
      root.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    if (theme !== "system" || !media) return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}
