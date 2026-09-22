"use client";

import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import type { AbstractAgent } from "@ag-ui/client";
import { A2UIProvider, A2UIRenderer, useA2UIActions, useA2UIError } from "@copilotkit/a2ui-renderer";
import { useCopilotKit, type ReactActivityMessageRenderer } from "@copilotkit/react-core/v2";
import { createHostCatalog } from "@/lib/a2ui/catalog";

import { SurfaceReadOnly } from "@/lib/a2ui/readonly";
import { secSurfaceTitle } from "./surface-title";
import { SurfaceFrame } from "./surface-frame";
import { surfaceContentSchema as contentSchema, surfaceOf, isCanvasSurface, useSurfaceStream, useSurfaceRunning, type Operations } from "./surface-stream";

export function createDemoActivityRenderer(catalog: ReturnType<typeof createHostCatalog>): ReactActivityMessageRenderer<z.infer<typeof contentSchema>> {
  return {
    activityType: "a2ui-surface",
    content: contentSchema,
    render: function DemoActivity({ content, agent }) {
      const operations = content.a2ui_operations ?? [];
      const ids = operations.filter(operation => operation.createSurface).map(surfaceOf).filter((id): id is string => Boolean(id) && !isCanvasSurface(id!));
      return <>{agent && ids.map(id => <LiveSurface key={id} surfaceId={id} initial={operations} agent={agent} catalog={catalog} />)}</>;
    },
  };
}

export function LiveSurface({ surfaceId, initial, agent, catalog }: { surfaceId: string; initial: Operations; agent: AbstractAgent; catalog: ReturnType<typeof createHostCatalog> }) {
  const { copilotkit } = useCopilotKit();
  const running = useSurfaceRunning();
  const envelopes = useSurfaceStream();
  const latestInline = envelopes.flatMap(item => item.operations).filter(item => item.createSurface)
    .map(surfaceOf).filter(id => id?.startsWith("sec-inline-")).at(-1);
  const historical = surfaceId.startsWith("sec-inline-") && Boolean(latestInline && latestInline !== surfaceId);
  const batches = [initial, ...envelopes.map(item => item.operations)];
  const title = secSurfaceTitle(surfaceId, batches, historical);
  const sec = surfaceId.startsWith("sec-");
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const screen = <SurfaceReadOnly.Provider value={historical}><A2UIProvider catalog={catalog} onAction={async message => {
    if (historical || busy.current || agent.isRunning) return;
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
  }}><fieldset data-surface-id={surfaceId} disabled={pending || running} aria-busy={pending} className="min-w-0 border-0 p-0"><SurfaceMessages surfaceId={surfaceId} initial={initial} /><A2UIRenderer surfaceId={surfaceId} /></fieldset>{pending && <p role="status">반영 중…</p>}{error && <p role="alert">{error}</p>}</A2UIProvider></SurfaceReadOnly.Provider>;
  return sec ? <SurfaceFrame historical={historical} canvas={isCanvasSurface(surfaceId)} title={title}>{screen}</SurfaceFrame> : screen;
}

export function SurfaceMessages({ surfaceId, initial }: { surfaceId: string; initial: Operations }) {
  const { processMessages, getSurface } = useA2UIActions();
  const error = useA2UIError();
  const envelopes = useSurfaceStream();
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const apply = (operations: Operations, key: string) => {
      if (seen.current.has(key)) return;
      const relevant = operations.filter(operation => surfaceOf(operation) === surfaceId);
      if (!relevant.length) return;
      seen.current.add(key);
      const updates = getSurface(surfaceId) ? relevant.filter(operation => !operation.createSurface) : relevant;
      if (updates.length) processMessages(updates);
    };
    // Activity content can mount after several tool results have arrived.
    // Replay the journal in wire order, then later updates, in the same provider.
    if (!getSurface(surfaceId)) processMessages(initial);
    for (const envelope of envelopes) apply(envelope.operations, envelope.key);
  }, [surfaceId, initial, envelopes, processMessages, getSurface]);
  return error ? <p role="alert">{error}</p> : null;
}
