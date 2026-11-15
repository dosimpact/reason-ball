"use client";

import { useId } from "react";

export type ChatGraph = { id: string; name: string; mode?: "chat" | "json"; description?: string };

export function GraphSelector({ graphs, value, disabled, onChange }: {
  graphs: ChatGraph[]; value: string; disabled: boolean; onChange: (value: string) => void;
}) {
  const descriptionId = useId();
  const selected = graphs.find(graph => graph.id === value);
  return <div className="agent-conversation__graph-selector">
    <label className="sr-only" htmlFor={`${descriptionId}-select`}>LangGraph 에이전트</label>
    <select id={`${descriptionId}-select`} aria-describedby={descriptionId} className="h-9 w-full min-w-0 rounded-lg border bg-background px-2 text-sm" value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
      {graphs.map(graph => <option key={graph.id} value={graph.id}>{graph.name}{graph.mode === "json" ? " · JSON 테스트" : ""}</option>)}
    </select>
    <p id={descriptionId} className="mt-1 text-xs leading-snug text-muted-foreground">{selected?.description ?? "선택한 그래프의 설명이 없습니다."}</p>
  </div>;
}
