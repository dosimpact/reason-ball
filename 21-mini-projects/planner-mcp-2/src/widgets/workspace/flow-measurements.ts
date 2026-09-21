"use client";
import { useCallback, useState } from "react";
import type { NodeChange } from "@xyflow/react";

// Controlled nodes must retain dimensions emitted by React Flow. Replacing
// node objects without measured resets visibility during unrelated UI updates.
export function useFlowMeasurements() {
  const [measurements, setMeasurements] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const recordMeasurements = useCallback((changes: NodeChange[]) => {
    const dimensions = changes.filter(
      (change) => change.type === "dimensions" && change.dimensions,
    );
    if (!dimensions.length) return;
    setMeasurements((current) => {
      let next = current;
      for (const change of dimensions) {
        if (change.type !== "dimensions" || !change.dimensions) continue;
        const { width, height } = change.dimensions;
        if (
          width <= 0 ||
          height <= 0 ||
          (current[change.id]?.width === width &&
            current[change.id]?.height === height)
        )
          continue;
        if (next === current) next = { ...current };
        next[change.id] = { width, height };
      }
      return next;
    });
  }, []);
  return { measurements, recordMeasurements };
}
