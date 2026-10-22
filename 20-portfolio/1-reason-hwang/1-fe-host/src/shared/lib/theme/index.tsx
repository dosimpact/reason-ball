"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const key = "reason-hwang-theme";
const ThemeContext = createContext<{ mode: Theme; toggle: () => void }>({ mode: "light", toggle: () => {} });

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(key);
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* Storage can be unavailable; the system preference still works. */ }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.dataset.theme = mode;
  root.dataset.openuiTheme = mode;
  root.style.colorScheme = mode;
}

export function HostThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Theme>("light");
  useEffect(() => {
    const sync = () => { const next = readTheme(); applyTheme(next); setMode(next); };
    sync();
    const media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", sync);
    window.addEventListener("storage", sync);
    return () => { media.removeEventListener("change", sync); window.removeEventListener("storage", sync); };
  }, []);
  const toggle = () => {
    const next = mode === "dark" ? "light" : "dark";
    try { localStorage.setItem(key, next); } catch { /* Keep the in-page selection usable. */ }
    applyTheme(next);
    setMode(next);
  };
  return <ThemeContext.Provider value={{ mode, toggle }}>{children}</ThemeContext.Provider>;
}

export const useHostTheme = () => useContext(ThemeContext);
