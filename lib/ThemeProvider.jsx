"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

const ThemeContext = createContext(null);
export const THEMES = [
  { id: "classic", label: "Classic", swatch: "#0E2A52" },
  { id: "dark", label: "Dark", swatch: "#121826" },
  { id: "gold", label: "Gold", swatch: "#B8860B" },
];

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("classic");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("acknet-theme") : null;
    const valid = THEMES.some((t) => t.id === stored);
    const initial = valid ? stored : "classic";
    setThemeState(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const setTheme = useCallback((next) => {
    if (!THEMES.some((t) => t.id === next)) return;
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem("acknet-theme", next);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
