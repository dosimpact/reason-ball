"use client";

import { Moon, Sun } from "lucide-react";
import { useHostTheme } from "@/shared/lib/theme";

export function ThemeToggle() {
  const { mode, toggle } = useHostTheme();
  const label = mode === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환";
  return <button type="button" onClick={toggle} aria-label={label} title={label}
    className="ml-auto inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
    {mode === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
  </button>;
}
