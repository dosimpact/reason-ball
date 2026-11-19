"use client";

import { useMemo, useState } from "react";
import { chartIndicators } from "./financial-indicators";
import type { FinancialSnapshot } from "./financial-schema";

export type FinancialVisibilityProps = { snapshot?: FinancialSnapshot | null; visibility?: Record<string, boolean>; onVisibilityChange?: (value: Record<string, boolean>) => void };
export const loadingSnapshot: FinancialSnapshot = { bars: [], status: "loading" };

export function useFinancialVisibility({ snapshot: querySnapshot, visibility: controlledVisibility, onVisibilityChange }: FinancialVisibilityProps) {
  const snapshot = querySnapshot ?? loadingSnapshot;
  const indicators = useMemo(() => chartIndicators(snapshot), [snapshot]);
  const [localVisibility, setLocalVisibility] = useState<Record<string, boolean>>({});
  const visibility = controlledVisibility ?? localVisibility;
  const [selectionError, setSelectionError] = useState("");
  const defaults = useMemo(() => new Set(indicators.filter(item => item.panel === "oscillator").slice(0, 4).map(item => item.instanceId)), [indicators]);
  const visible = useMemo(() => {
    const explicitlyShown = indicators.filter(item => item.panel === "oscillator" && visibility[item.instanceId] === true);
    const initiallyShown = indicators.filter(item => item.panel === "oscillator" && visibility[item.instanceId] === undefined && defaults.has(item.instanceId));
    const shown = new Set([...explicitlyShown, ...initiallyShown].slice(0, 4).map(item => item.instanceId));
    return indicators.filter(item => item.panel === "price" ? visibility[item.instanceId] ?? true : shown.has(item.instanceId));
  }, [indicators, visibility, defaults]);
  function toggle(instanceId: string, checked: boolean) {
    const indicator = indicators.find(item => item.instanceId === instanceId);
    if (checked && indicator?.panel === "oscillator" && visible.filter(item => item.panel === "oscillator").length >= 4) {
      setSelectionError("하위 패널은 최대 4개까지 표시할 수 있습니다. 다른 지표를 먼저 숨겨 주세요.");
      return;
    }
    setSelectionError("");
    const next = { ...visibility, [instanceId]: checked };
    if (onVisibilityChange) onVisibilityChange(next); else setLocalVisibility(next);
  }
  return { snapshot, indicators, visible, selectionError, toggle };
}
