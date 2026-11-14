"use client";

import { createTheme, ThemeContext } from "@grafana/data";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Mode = "light" | "dark";
const ModeContext = createContext<{ mode: Mode; toggleTheme: () => void }>({ mode: "dark", toggleTheme: () => {} });

export function SagaThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("dark");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("openui-saga:theme");
      if (saved === "light" || saved === "dark") {
        // Browser preference is unavailable during server rendering.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMode(saved);
      }
    } catch { /* Use the default when browser storage is unavailable. */ }
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = mode; }, [mode]);
  const theme = useMemo(() => createTheme({ colors: { mode } }), [mode]);
  function toggleTheme() {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    try { window.localStorage.setItem("openui-saga:theme", next); } catch { /* Theme remains available for this session. */ }
  }
  return <ModeContext.Provider value={{ mode, toggleTheme }}><ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider></ModeContext.Provider>;
}
export const useSagaTheme = () => useContext(ModeContext);
