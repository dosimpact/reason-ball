"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
export const themeStorageKey = "fibonacci-lab:theme";
const themeEvent = "fibonacci-theme-change";

function subscribe(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-color-mode"] });
  const syncStorage = (event: StorageEvent) => {
    if (event.key === themeStorageKey) applyTheme(event.newValue === "dark" ? "dark" : "light", false);
  };
  window.addEventListener(themeEvent, listener);
  window.addEventListener("storage", syncStorage);
  return () => { observer.disconnect(); window.removeEventListener(themeEvent, listener); window.removeEventListener("storage", syncStorage); };
}
function snapshot(): Theme { return document.documentElement.dataset.colorMode === "dark" ? "dark" : "light"; }
export function useTheme(): Theme { return useSyncExternalStore(subscribe, snapshot, () => "light"); }
export function applyTheme(theme: Theme, persist = true) {
  document.documentElement.dataset.colorMode = theme;
  if (persist) { try { localStorage.setItem(themeStorageKey, theme); } catch { /* This tab can still switch when storage is unavailable. */ } }
  window.dispatchEvent(new Event(themeEvent));
}
