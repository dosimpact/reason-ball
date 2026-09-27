"use client";

import { Moon, Sun } from "lucide-react";
import { applyTheme, useTheme } from "@/shared/lib/theme";
import { Button } from "./button";

export function ThemeToggle() {
  const theme = useTheme();
  const dark = theme === "dark";
  return <Button className="theme-toggle" variant="secondary" onClick={() => applyTheme(dark ? "light" : "dark")} aria-label={dark ? "라이트 모드로 전환" : "다크 모드로 전환"}>
    {dark ? <Sun size={16} /> : <Moon size={16} />}
    <span>{dark ? "라이트 모드" : "다크 모드"}</span>
  </Button>;
}
