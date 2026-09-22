"use client";

import { useAgent } from "@copilotkit/react-core/v2";
import type { ReactNode } from "react";
import type { createHostCatalog } from "@/lib/a2ui/catalog";
import { LiveSurface } from "./activity-renderer";
import { isCanvasSurface, surfaceOf, SurfaceStreamProvider, useSurfaceStream } from "./surface-stream";

export type OutputTarget = "inline" | "canvas";

export function OutputWorkspace({ agentId, catalog, children, target = "inline" }: { target?: OutputTarget; agentId: string; catalog: ReturnType<typeof createHostCatalog>; children: ReactNode }) {
  const { agent } = useAgent({ agentId });
  return <SurfaceStreamProvider agent={agent}><WorkspaceLayout agentId={agentId} catalog={catalog} target={target}>{children}</WorkspaceLayout></SurfaceStreamProvider>;
}

export function OutputTargetSelect({ value, onChange }: { value: OutputTarget; onChange: (value: OutputTarget) => void }) {
  const { agent } = useAgent({ agentId: "a2ui-sec" });
  return <label className="mb-4 flex flex-wrap items-center gap-2 text-sm">다음 답변
    <select aria-label="결과 표시 위치" className="rounded-md border bg-background px-3 py-2" value={value} disabled={agent.isRunning} onChange={event => onChange(event.target.value as OutputTarget)}>
      <option value="inline">대화에 기록</option>
      <option value="canvas">작업 화면에서 이어가기 (Canvas)</option>
    </select><span className="text-xs text-muted-foreground">기존 결과는 그대로 유지됩니다.</span>
  </label>;
}

function WorkspaceLayout({ agentId, catalog, target, children }: { agentId: string; catalog: ReturnType<typeof createHostCatalog>; target: OutputTarget; children: ReactNode }) {
  const envelopes = useSurfaceStream();
  const populated = envelopes.some(envelope => envelope.operations.some(operation => operation.createSurface && isCanvasSurface(surfaceOf(operation) ?? "")));
  const showCanvas = agentId === "a2ui-sec" && (target === "canvas" || populated);
  return <div className={showCanvas ? "grid min-w-0 items-start gap-6 xl:grid-cols-2" : "mx-auto max-w-4xl"}>
    {children}{showCanvas && <Canvas agentId={agentId} catalog={catalog} />}
  </div>;
}

function Canvas({ agentId, catalog }: { agentId: string; catalog: ReturnType<typeof createHostCatalog> }) {
  const { agent } = useAgent({ agentId });
  const envelopes = useSurfaceStream();
  const created = envelopes.flatMap(envelope => envelope.operations.filter(operation => operation.createSurface)
    .map(operation => ({ id: surfaceOf(operation), initial: envelope.operations })))
    .find(item => item.id && isCanvasSurface(item.id));
  return <section aria-label="SEC Canvas" className="min-w-0 rounded-xl border bg-background p-4 xl:sticky xl:top-4 xl:max-h-[85vh] xl:overflow-auto">
    <h2 className="mb-3 text-lg font-semibold">작업 화면 <span className="text-sm font-normal text-muted-foreground">Canvas</span></h2>
    {created?.id ? <LiveSurface surfaceId={created.id} initial={created.initial} agent={agent} catalog={catalog} /> : <p className="text-sm text-muted-foreground">다음 요청의 결과가 여기에 표시됩니다. 대화 입력창에서 회사명이나 질문을 입력하세요.</p>}
  </section>;
}
