"use client";

import { useEffect, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";

import { labels, ProgressView, type ProgressState, type Stage, type Status } from "./progress-view";

export function RunProgress({ agentId }: { agentId: string }) {
  const { agent } = useAgent({ agentId });
  const [progress, setProgress] = useState<ProgressState | null>(null);
  useEffect(() => {
    let terminal = false;
    const end = (status: Status) => {
      if (terminal) return;
      terminal = true;
      setProgress(previous => previous ? { ...previous, status } : null);
    };
    const subscription = agent.subscribe({
      onRunInitialized: () => {
        terminal = false;
        setProgress({ stages: ["connecting"], status: "running" });
      },
      onCustomEvent: ({ event }) => {
        if (terminal || event.name !== "a2ui.progress" || !event.value || typeof event.value !== "object") return;
        const stage: unknown = event.value.stage;
        if (typeof stage !== "string" || !Object.prototype.hasOwnProperty.call(labels, stage)) return;
        setProgress(previous => ({ stages: [...(previous?.stages ?? []), stage as Stage].slice(-12), status: "running" }));
      },
      onRunFinishedEvent: () => end("complete"),
      onRunErrorEvent: ({ event }) => end(event.code === "abort" ? "stopped" : "error"),
      onRunFailed: ({ error }) => end(error.name === "AbortError" ? "stopped" : "error"),
      onRunFinalized: () => { if (!terminal) end("stopped"); },
    });
    return () => subscription.unsubscribe();
  }, [agent]);
  return <ProgressView progress={progress} />;
}
