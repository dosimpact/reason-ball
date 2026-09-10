"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  const dark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      className="grid size-10 place-items-center rounded-xl border border-black/8 bg-white text-neutral-700 shadow-sm transition hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
      aria-label={dark ? "라이트 테마로 전환" : "다크 테마로 전환"}
      aria-pressed={dark}
      onClick={() => setTheme(dark ? "light" : "dark")}
      data-testid="theme-toggle"
    >
      {dark ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
    </button>
  );
}
