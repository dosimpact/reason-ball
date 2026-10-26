"use client";
import { useCallback, useSyncExternalStore } from "react";
const EVENT = "orot-shortlist";
const empty: string[] = [];
const cache = new Map<string, { raw: string | null; value: string[] }>();
const volatileKeys = new Set<string>();
const session = new Map<string, string[]>();
function read(key: string): string[] {
  if (volatileKeys.has(key)) return session.get(key) ?? empty;
  try {
    const raw = window.localStorage.getItem(key);
    const previous = cache.get(key);
    if (previous?.raw === raw) return previous.value;
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const value = Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
    cache.set(key, { raw, value });
    return value;
  } catch {
    return session.get(key) ?? empty;
  }
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(EVENT, listener);
  };
}
export function useShortlist(key: string, limit = Infinity) {
  const ids = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => empty,
  );
  const update = useCallback(
    (next: string[]) => {
      const value = next.slice(0, limit);
      session.set(key, value);
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        volatileKeys.delete(key);
      } catch {
        volatileKeys.add(key);
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key, limit],
  );
  const toggle = useCallback(
    (id: string) => {
      const current = read(key);
      if (!current.includes(id) && current.length >= limit) return false;
      update(
        current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id],
      );
      return true;
    },
    [key, limit, update],
  );
  return { ids, toggle, clear: () => update([]) };
}
