import { useCallback, useRef, useState } from "react";
export type ExecutionOwner = "collection" | "api-testing";
export function useExecutionLock() {
  const ownerRef = useRef<ExecutionOwner | null>(null);
  const [owner, setOwner] = useState<ExecutionOwner | null>(null);
  const acquire = useCallback((next: ExecutionOwner) => {
    if (ownerRef.current) return false;
    ownerRef.current = next; setOwner(next); return true;
  }, []);
  const release = useCallback((current: ExecutionOwner) => {
    if (ownerRef.current !== current) return;
    ownerRef.current = null; setOwner(null);
  }, []);
  return { owner, acquire, release };
}
export type ExecutionLock = ReturnType<typeof useExecutionLock>;
