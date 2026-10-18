"use client";
import { useEffect } from "react";
import { useNodesInitialized, useReactFlow } from "@xyflow/react";

export function FitDocumentFlow({ structure }: { structure: string }) {
  const initialized = useNodesInitialized();
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (!initialized) return;
    const frame = requestAnimationFrame(
      () => void fitView({ padding: 0.2, maxZoom: 1 }),
    );
    return () => cancelAnimationFrame(frame);
  }, [initialized, structure, fitView]);
  return null;
}
