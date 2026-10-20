"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useThemeModePreference } from "@openuidev/react-ui";
import { Moon, Sun } from "lucide-react";

const ThemeContext = createContext({ mode: "light", toggle: () => {} });

export function WorkspaceTheme({ children }: { children: ReactNode }) {
  const { mode, setPreference } = useThemeModePreference("lite-canvas:theme");
  useEffect(() => {
    const root = document.documentElement;
    const printMedia = window.matchMedia("print");
    // 인쇄 중에는 DOM 테마만 밝게 바꾸고 저장된 선호는 유지하여 종료 후 원래 테마로 복원합니다.
    const apply = (printing = printMedia.matches) => {
      root.setAttribute("data-openui-theme", printing ? "light" : mode);
      root.style.colorScheme = printing ? "light" : mode;
    };
    const beforePrint = () => apply(true);
    const afterPrint = () => apply(false);
    const mediaChanged = () => apply();
    apply();
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    printMedia.addEventListener("change", mediaChanged);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
      printMedia.removeEventListener("change", mediaChanged);
    };
  }, [mode]);
  return <ThemeContext.Provider value={{ mode, toggle: () => setPreference(mode === "dark" ? "light" : "dark") }}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const { mode, toggle } = useContext(ThemeContext);
  const label = mode === "dark" ? "라이트 테마로 전환" : "다크 테마로 전환";
  return <button type="button" className="theme-toggle no-print" onClick={toggle} aria-label={label} title={label}>
    {mode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
  </button>;
}
