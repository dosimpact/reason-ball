"use client";

export type ChatGraph = { id: string; name: string; mode?: "chat" | "json" };

export function GraphSelector({ graphs, value, disabled, onChange }: {
  graphs: ChatGraph[]; value: string; disabled: boolean; onChange: (value: string) => void;
}) {
  return <label className="agent-conversation__graph-selector">
    <span className="sr-only">LangGraph 에이전트</span>
    <select aria-label="LangGraph 에이전트" className="h-9 w-full min-w-0 rounded-lg border bg-background px-2 text-sm" value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
      {graphs.map(graph => <option key={graph.id} value={graph.id}>{graph.name}{graph.mode === "json" ? " · JSON 테스트" : ""}</option>)}
    </select>
  </label>;
}
