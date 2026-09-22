"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AbstractAgent } from "@ag-ui/client";

import { surfaceContentSchema, type Operations } from "./surface-operations";
export { surfaceContentSchema, surfaceOf, isCanvasSurface, type Operations } from "./surface-operations";
type Envelope = { key: string; operations: Operations };
const SurfaceStream = createContext<{ envelopes: Envelope[]; running: boolean }>({ envelopes: [], running: false });

export const useSurfaceStream = () => useContext(SurfaceStream).envelopes;
export const useSurfaceRunning = () => useContext(SurfaceStream).running;

/** Subscribe before a run starts: AG-UI snapshots subscribers for each run. */
export function SurfaceStreamProvider({ agent, children }: { agent: AbstractAgent; children: ReactNode }) {
  const [running, setRunning] = useState(agent.isRunning);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  useEffect(() => {
    const consume = (messages: ReadonlyArray<Readonly<AbstractAgent["messages"][number]>>) => {
      const received: Envelope[] = [];
      for (const message of messages) {
        let content: unknown;
        let key: string;
        if (message.role === "tool" && typeof message.content === "string") {
          try { content = JSON.parse(message.content); } catch { continue; }
          key = message.toolCallId;
        } else if (message.role === "activity" && message.activityType === "a2ui-surface") {
          content = message.content;
          key = message.id.replace(/^a2ui-surface-/, "");
        } else continue;
        const parsed = surfaceContentSchema.safeParse(content);
        if (parsed.success && parsed.data.a2ui_operations?.length) received.push({ key, operations: parsed.data.a2ui_operations });
      }
      if (!received.length) return;
      setEnvelopes(previous => {
        const known = new Set(previous.map(item => item.key));
        const added = received.filter(item => {
          if (known.has(item.key)) return false;
          known.add(item.key);
          return true;
        });
        return added.length ? [...previous, ...added] : previous;
      });
    };
    consume(agent.messages);
    const subscription = agent.subscribe({
      onMessagesChanged: ({ messages }) => consume(messages),
      onRunInitialized: () => { setRunning(true); },
      onRunFinalized: () => { setRunning(false); },
    });
    return () => subscription.unsubscribe();
  }, [agent]);
  return <SurfaceStream.Provider value={{ envelopes, running }}>{children}</SurfaceStream.Provider>;
}
