"use client";

export type ChatGraph = { id: string; name: string };

export function GraphSelector({ graphs, value, disabled, onChange }: {
  graphs: ChatGraph[]; value: string; disabled: boolean; onChange: (value: string) => void;
}) {
  return <label className="mt-4 flex max-w-md flex-col gap-2 text-sm">
    LangGraph 에이전트
    <select aria-label="LangGraph 에이전트" className="rounded-md border bg-background p-2" value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
      {graphs.map(graph => <option key={graph.id} value={graph.id}>{graph.name}</option>)}
    </select>
  </label>;
}
