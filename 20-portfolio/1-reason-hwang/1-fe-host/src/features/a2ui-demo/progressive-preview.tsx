"use client";

import { useEffect, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { A2UIProvider, A2UIRenderer, useA2UIActions } from "@copilotkit/a2ui-renderer";
import { z } from "zod";
import { createHostCatalog } from "@/lib/a2ui/catalog";

export type RenderMode = "batch" | "progressive";
const previewSchema = z.object({ operations: z.array(z.record(z.unknown())) });
type Operations = z.infer<typeof previewSchema>["operations"];

export function RenderModeSelect({ value, onChange }: { value: RenderMode; onChange: (value: RenderMode) => void }) {
  const { agent } = useAgent({ agentId: "a2ui-dynamic" });
  return <label className="mb-4 flex items-center gap-3 text-sm">화면 표시 방식<select aria-label="렌더링 방식" className="rounded-md border bg-background px-3 py-2" value={value} disabled={agent.isRunning} onChange={event => onChange(event.target.value as RenderMode)}><option value="batch">일괄 · 완성 후 표시</option><option value="progressive">점진 · 생성 중 미리보기</option></select></label>;
}

export function ProgressivePreview({ catalog }: { catalog: ReturnType<typeof createHostCatalog> }) {
  const { agent } = useAgent({ agentId: "a2ui-dynamic" });
  const [operations, setOperations] = useState<Operations>([]);
  useEffect(() => {
    const clear = () => setOperations([]);
    const subscription = agent.subscribe({
      onRunInitialized: clear,
      onRunFinishedEvent: clear,
      onRunErrorEvent: clear,
      onRunFailed: clear,
      onRunFinalized: clear,
      onCustomEvent: ({ event }) => {
        if (event.name !== "a2ui.preview") return;
        const parsed = previewSchema.safeParse(event.value);
        if (parsed.success) setOperations(parsed.data.operations);
      },
    });
    return () => subscription.unsubscribe();
  }, [agent]);
  const create = operations.find(operation => operation.createSurface)?.createSurface;
  const surfaceId = create && typeof create === "object" && "surfaceId" in create ? create.surfaceId : null;
  if (typeof surfaceId !== "string") return null;
  return <section aria-label="생성 중 화면 미리보기" aria-busy="true" className="mb-4 rounded-xl border p-4"><p role="status" className="mb-3 text-sm text-muted-foreground">화면을 만드는 중입니다. 완성되면 대화에 표시됩니다.</p><A2UIProvider key={surfaceId} catalog={catalog} onAction={() => {}}><PreviewOperations surfaceId={surfaceId} operations={operations} /><A2UIRenderer surfaceId={surfaceId} /></A2UIProvider></section>;
}

function PreviewOperations({ surfaceId, operations }: { surfaceId: string; operations: Operations }) {
  const { processMessages, getSurface } = useA2UIActions();
  useEffect(() => {
    processMessages(getSurface(surfaceId) ? operations.filter(operation => !operation.createSurface) : operations);
  }, [operations, surfaceId, processMessages, getSurface]);
  return null;
}
