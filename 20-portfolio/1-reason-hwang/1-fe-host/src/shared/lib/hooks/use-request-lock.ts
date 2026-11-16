"use client";
import { useCallback, useRef, useState } from "react";
export function useRequestLock<Owner extends string>() {
  const current = useRef<Owner | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const acquire = useCallback((next: Owner) => { if (current.current) return false; current.current = next; setOwner(next); return true; }, []);
  const release = useCallback((previous: Owner) => { if (current.current !== previous) return; current.current = null; setOwner(null); }, []);
  return { owner, acquire, release };
}
export type RequestLock<Owner extends string = string> = ReturnType<typeof useRequestLock<Owner>>;
