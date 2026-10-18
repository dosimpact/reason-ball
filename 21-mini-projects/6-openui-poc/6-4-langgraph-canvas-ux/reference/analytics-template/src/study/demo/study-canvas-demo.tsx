"use client";

import {
  applyCanvasPatch,
  buildCanvasSnapshot,
  createSampleCanvasPatch,
} from "@/study/bridge/canvas-bridge";
import { useStudyCanvasStore } from "@/study/canvas/canvas-storage";
import { StudyComponentsCanvas } from "@/study/canvas/study-components-canvas";
import { StudyChatPanel } from "@/study/chat/study-chat-panel";
import { cn } from "@/study/utils";
import { BotIcon, RefreshCwIcon } from "lucide-react";
import * as React from "react";

function StudyBridgePanel() {
  const { canvases, activeCanvasId } = useStudyCanvasStore();
  void canvases;
  void activeCanvasId;
  const snapshot = buildCanvasSnapshot();
  const activeComponents = snapshot.activeCanvas?.components ?? [];
  const hasComponents = activeComponents.length > 0;

  const applySamplePatch = React.useCallback(() => {
    const patch = createSampleCanvasPatch(buildCanvasSnapshot());
    if (!patch) return;
    applyCanvasPatch(patch);
  }, []);

  return (
    <div className="border-t border-border bg-background" data-testid="ai-canvas-bridge">
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BotIcon className="h-4 w-4" />
            <span>AI Canvas Bridge</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Snapshot and patch application pipeline
          </p>
        </div>
        <button
          onClick={applySamplePatch}
          disabled={!hasComponents}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm",
            hasComponents
              ? "hover:bg-muted"
              : "opacity-50 cursor-not-allowed",
          )}
          title="Apply sample patch"
          data-testid="ai-canvas-bridge-patch"
        >
          <RefreshCwIcon className="h-4 w-4" />
          <span>Patch</span>
        </button>
      </div>
      <pre
        className="mx-4 mb-4 max-h-48 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed"
        data-testid="ai-canvas-bridge-snapshot"
      >
        {JSON.stringify(snapshot, null, 2)}
      </pre>
    </div>
  );
}

export function StudyCanvasDemo() {
  return (
    <main
      className="min-h-dvh overflow-y-auto bg-container text-foreground lg:h-screen lg:overflow-hidden"
      data-testid="dashboard-canvas-shell"
    >
      <div className="grid min-h-dvh grid-cols-1 lg:h-full lg:min-h-0 lg:grid-cols-[440px_1fr]">
        <StudyChatPanel />

        <section className="flex min-h-[80dvh] flex-col lg:h-full lg:min-h-0">
          <div className="h-[72dvh] min-h-[360px] border-b border-border lg:h-[min(72vh,720px)] lg:min-h-[420px]">
            <StudyComponentsCanvas className="h-full" />
          </div>
          <div className="min-h-0 flex-1 overflow-visible lg:overflow-auto">
            <StudyBridgePanel />
          </div>
        </section>
      </div>
    </main>
  );
}
