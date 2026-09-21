"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { AbstractAgent } from "@ag-ui/client";
import { A2UIProvider, A2UIRenderer, useA2UIActions, useA2UIError } from "@copilotkit/a2ui-renderer";
import { useCopilotKit, type ReactActivityMessageRenderer } from "@copilotkit/react-core/v2";
import { createHostCatalog } from "@/lib/a2ui/catalog";

const contentSchema = z.object({ a2ui_operations: z.array(z.record(z.unknown())).optional() }).passthrough();
type Operations = Record<string, unknown>[];

function surfaceOf(operation: Record<string, unknown>): string | undefined {
  for (const key of ["createSurface", "updateComponents", "updateDataModel", "deleteSurface"]) {
    const value = operation[key];
    if (value && typeof value === "object" && "surfaceId" in value && typeof value.surfaceId === "string") return value.surfaceId;
  }
}

export function createDemoActivityRenderer(catalog: ReturnType<typeof createHostCatalog>): ReactActivityMessageRenderer<z.infer<typeof contentSchema>> {
  return {
    activityType: "a2ui-surface",
    content: contentSchema,
    render: function DemoActivity({ content, agent }) {
      const operations = content.a2ui_operations ?? [];
      const ids = operations.filter(operation => operation.createSurface).map(surfaceOf).filter((id): id is string => Boolean(id));
      return <>{agent && ids.map(id => <LiveSurface key={id} surfaceId={id} initial={operations} agent={agent} catalog={catalog} />)}</>;
    },
  };
}

function LiveSurface({ surfaceId, initial, agent, catalog }: { surfaceId: string; initial: Operations; agent: AbstractAgent; catalog: ReturnType<typeof createHostCatalog> }) {
  const { copilotkit } = useCopilotKit();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <A2UIProvider catalog={catalog} onAction={async message => {
    if (busy.current || agent.isRunning) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      copilotkit.setProperties({ ...copilotkit.properties, a2uiAction: message });
      await copilotkit.runAgent({ agent });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "화면 반영에 실패했습니다");
    } finally {
      const properties = { ...copilotkit.properties };
      delete properties.a2uiAction;
      copilotkit.setProperties(properties);
      busy.current = false;
      setPending(false);
    }
  }}><fieldset disabled={pending} aria-busy={pending} className="min-w-0 border-0 p-0"><SurfaceMessages surfaceId={surfaceId} initial={initial} agent={agent} /><A2UIRenderer surfaceId={surfaceId} /></fieldset>{pending && <p role="status">반영 중…</p>}{error && <p role="alert">{error}</p>}</A2UIProvider>;
}

function SurfaceMessages({ surfaceId, initial, agent }: { surfaceId: string; initial: Operations; agent: AbstractAgent }) {
  const { processMessages, getSurface } = useA2UIActions();
  const error = useA2UIError();
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const apply = (operations: Operations, key: string) => {
      const relevant = operations.filter(operation => surfaceOf(operation) === surfaceId);
      if (!relevant.length) return;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      const updates = getSurface(surfaceId) ? relevant.filter(operation => !operation.createSurface) : relevant;
      if (updates.length) processMessages(updates);
    };
    apply(initial, "initial");
    const consume = () => {
      for (const message of agent.messages) {
        if (message.role !== "tool" || typeof message.content !== "string") continue;
        let parsed: unknown;
        try { parsed = JSON.parse(message.content); } catch { continue; }
        const result = contentSchema.safeParse(parsed);
        if (result.success && result.data.a2ui_operations) apply(result.data.a2ui_operations, `${message.id}:${message.content}`);
      }
    };
    consume();
    const subscription = agent.subscribe({ onMessagesChanged: consume });
    return () => subscription.unsubscribe();
  }, [agent, surfaceId, initial, processMessages, getSurface]);
  return error ? <p role="alert">{error}</p> : null;
}
