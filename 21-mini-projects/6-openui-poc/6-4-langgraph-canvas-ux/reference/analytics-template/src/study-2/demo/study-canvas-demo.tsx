"use client";

import { StudyComponentsCanvas } from "@/study/canvas/study-components-canvas";
import { generateId, useStudyCanvasStore } from "@/study/canvas/canvas-storage";
import {
  applyCanvasPatch,
  buildCanvasSnapshot,
  createSampleCanvasPatch,
} from "@/study/bridge/canvas-bridge";
import { sampleArtifacts } from "@/study/demo/sample-artifacts";
import {
  getStudyComponentLabel,
  renderStudyComponent,
  type StudyComponentArtifact,
} from "@/study/renderers/component-registry";
import { cn } from "@/study/utils";
import { BotIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import * as React from "react";

function cloneArtifactProps<T>(props: T): T {
  return structuredClone(props);
}

function getArtifactTitle(artifact: StudyComponentArtifact) {
  return "title" in artifact.props && typeof artifact.props.title === "string"
    ? artifact.props.title
    : getStudyComponentLabel(artifact.component);
}

function ArtifactPreview({ artifact }: { artifact: StudyComponentArtifact }) {
  const { activeCanvasId, addComponent, createCanvas } = useStudyCanvasStore();
  const componentLabel = getStudyComponentLabel(artifact.component);

  const addToDashboard = React.useCallback(() => {
    let targetCanvasId = activeCanvasId;
    if (!targetCanvasId) {
      const newCanvas = createCanvas();
      targetCanvasId = newCanvas.id;
    }

    addComponent(targetCanvasId, {
      ...cloneArtifactProps(artifact.props),
      componentId: generateId(),
      _inCanvas: true,
      _componentType: artifact.component,
    });
  }, [activeCanvasId, addComponent, artifact, createCanvas]);

  const handleDragStart = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const dragData = {
        component: artifact.component,
        props: {
          ...cloneArtifactProps(artifact.props),
          componentId: generateId(),
          _inCanvas: false,
          _componentType: artifact.component,
        },
      };
      e.dataTransfer.setData("application/json", JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = "copy";
    },
    [artifact],
  );

  return (
    <div
      className="border border-border rounded-md bg-background overflow-hidden"
      data-testid="artifact-preview"
      data-component-type={artifact.component}
      data-artifact-title={getArtifactTitle(artifact)}
    >
      <div
        draggable
        onDragStart={handleDragStart}
        className="cursor-grab active:cursor-grabbing"
        data-testid={`artifact-preview-drag-${artifact.component.toLowerCase()}`}
      >
        {renderStudyComponent(artifact.component, artifact.props)}
      </div>
      <div className="border-t border-border p-2 flex justify-end">
        <button
          onClick={addToDashboard}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted"
          title={`Add ${componentLabel} to dashboard`}
          data-testid={`artifact-preview-add-${artifact.component.toLowerCase()}`}
        >
          <PlusIcon className="h-4 w-4" />
          <span>Add</span>
        </button>
      </div>
    </div>
  );
}

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
      className="h-screen overflow-hidden bg-container text-foreground"
      data-testid="dashboard-canvas-shell"
    >
      <div className="h-full grid grid-cols-1 lg:grid-cols-[420px_1fr]">
        <section className="h-full overflow-auto border-r border-border bg-background">
          <div className="p-4 border-b border-border">
            <h1 className="text-xl font-semibold">Dashboard Canvas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Generated component preview
            </p>
          </div>
          <div className="p-4 grid gap-4">
            {sampleArtifacts.map((artifact) => (
              <ArtifactPreview
                key={`${artifact.component}-${getArtifactTitle(artifact)}`}
                artifact={artifact}
              />
            ))}
          </div>
        </section>

        <section className="h-full min-h-0 flex flex-col">
          <div className="h-[min(72vh,720px)] min-h-[420px] border-b border-border">
            <StudyComponentsCanvas className="h-full" />
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <StudyBridgePanel />
          </div>
        </section>
      </div>
    </main>
  );
}
