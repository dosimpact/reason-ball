"use client";

import { useAgent } from "@copilotkit/react-core/v2";
import type { ReactNode } from "react";
import type { createHostCatalog } from "@/lib/a2ui/catalog";
import { LiveSurface } from "./activity-renderer";
import { isCanvasSurface, surfaceOf, SurfaceStreamProvider, useSurfaceStream } from "./surface-stream";

export type OutputTarget = "inline" | "canvas";

export function OutputWorkspace({ agentId, catalog, children }: { agentId: string; catalog: ReturnType<typeof createHostCatalog>; children: ReactNode }) {
  const { agent } = useAgent({ agentId });
  return <SurfaceStreamProvider agent={agent}>{children}{agentId === "a2ui-sec" && <Canvas agentId={agentId} catalog={catalog} />}</SurfaceStreamProvider>;
}

export function OutputTargetSelect({ value, onChange }: { value: OutputTarget; onChange: (value: OutputTarget) => void }) {
  const { agent } = useAgent({ agentId: "a2ui-sec" });
  return <label className="mb-4 flex items-center gap-3 text-sm">결과 표시 위치
    <select aria-label="결과 표시 위치" className="rounded-md border bg-background px-3 py-2" value={value} disabled={agent.isRunning} onChange={event => onChange(event.target.value as OutputTarget)}>
      <option value="inline">채팅 · 결과를 새 메시지에 남기기</option>
      <option value="canvas">Canvas · 작업 화면 계속 갱신하기</option>
    </select>
  </label>;
}

function Canvas({ agentId, catalog }: { agentId: string; catalog: ReturnType<typeof createHostCatalog> }) {
  const { agent } = useAgent({ agentId });
  const envelopes = useSurfaceStream();
  const created = envelopes.flatMap(envelope => envelope.operations.filter(operation => operation.createSurface)
    .map(operation => ({ id: surfaceOf(operation), initial: envelope.operations })))
    .find(item => item.id && isCanvasSurface(item.id));
  return <section aria-label="SEC Canvas" className="mt-6 rounded-xl border bg-background p-4 lg:sticky lg:top-4 lg:max-h-[85vh] lg:overflow-auto">
    <h2 className="mb-3 text-lg font-semibold">Canvas</h2>
    {created?.id ? <LiveSurface surfaceId={created.id} initial={created.initial} agent={agent} catalog={catalog} /> : <p className="text-sm text-muted-foreground">표시 위치를 Canvas로 선택하면 결과가 이 작업 화면에 표시됩니다.</p>}
  </section>;
}
