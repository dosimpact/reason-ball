import type { CanvasComponent, CanvasState } from "@/study/canvas/canvas-storage";
import { useStudyCanvasStore } from "@/study/canvas/canvas-storage";
import { z } from "zod/v3";

export type StudyChartType = "bar" | "line" | "pie";

export type CanvasSnapshotComponent =
  | {
      id: string;
      componentType: "Graph";
      title: string;
      chartType: StudyChartType;
      order: number;
    }
  | {
      id: string;
      componentType: "Markdown";
      title: string;
      contentPreview: string;
      order: number;
    };

export type CanvasSnapshot = {
  activeCanvasId: string | null;
  canvases: Array<{
    id: string;
    name: string;
    isActive: boolean;
  }>;
  activeCanvas: {
    id: string;
    name: string;
    components: CanvasSnapshotComponent[];
  } | null;
};

const graphPatchSchema = z.object({
  componentType: z.literal("Graph"),
  id: z.string().min(1),
  title: z.string(),
  chartType: z.enum(["bar", "line", "pie"]),
});

const markdownPatchSchema = z.object({
  componentType: z.literal("Markdown"),
  id: z.string().min(1),
  title: z.string().optional(),
  content: z.string().optional(),
});

export const canvasPatchSchema = z
  .object({
    components: z.array(
      z.discriminatedUnion("componentType", [
        graphPatchSchema,
        markdownPatchSchema,
      ]),
    ),
  })
  .superRefine((patch, ctx) => {
    const seen = new Set<string>();
    patch.components.forEach((component, index) => {
      if (seen.has(component.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate component id",
          path: ["components", index, "id"],
        });
      }
      seen.add(component.id);
    });
  });

export type CanvasPatch = z.infer<typeof canvasPatchSchema>;

const isStudyChartType = (value: unknown): value is StudyChartType =>
  value === "bar" || value === "line" || value === "pie";

function getTitle(component: CanvasComponent) {
  const data = component.data as { title?: unknown } | undefined;
  if (typeof component.title === "string") return component.title;
  if (typeof data?.title === "string") return data.title;
  return "";
}

function getMarkdownContentPreview(component: CanvasComponent) {
  const content = typeof component.content === "string" ? component.content : "";
  return content.length > 240 ? `${content.slice(0, 237)}...` : content;
}

function toSnapshotComponent(
  component: CanvasComponent,
  order: number,
): CanvasSnapshotComponent | null {
  if (component._componentType === "Graph") {
    const data = component.data as { type?: unknown } | undefined;
    const chartType = isStudyChartType(data?.type) ? data.type : "bar";

    return {
      id: component.componentId,
      componentType: "Graph",
      title: getTitle(component),
      chartType,
      order,
    };
  }

  if (component._componentType === "Markdown") {
    return {
      id: component.componentId,
      componentType: "Markdown",
      title: getTitle(component),
      contentPreview: getMarkdownContentPreview(component),
      order,
    };
  }

  return null;
}

export function buildCanvasSnapshot(
  state: CanvasState = useStudyCanvasStore.getState(),
): CanvasSnapshot {
  const activeCanvas = state.activeCanvasId
    ? state.canvases.find((canvas) => canvas.id === state.activeCanvasId)
    : undefined;

  return {
    activeCanvasId: state.activeCanvasId,
    canvases: state.canvases.map((canvas) => ({
      id: canvas.id,
      name: canvas.name,
      isActive: canvas.id === state.activeCanvasId,
    })),
    activeCanvas: activeCanvas
      ? {
          id: activeCanvas.id,
          name: activeCanvas.name,
          components: activeCanvas.components
            .map((component, order) => toSnapshotComponent(component, order))
            .filter((component): component is CanvasSnapshotComponent =>
              Boolean(component),
            ),
        }
      : null,
  };
}

export function createSampleCanvasPatch(
  snapshot: CanvasSnapshot,
): CanvasPatch | null {
  const activeCanvas = snapshot.activeCanvas;
  if (!activeCanvas || activeCanvas.components.length === 0) return null;

  const nextType: Record<StudyChartType, StudyChartType> = {
    bar: "line",
    line: "pie",
    pie: "bar",
  };

  return {
    components: [...activeCanvas.components].reverse().map((component, index) => {
      if (component.componentType === "Graph") {
        return {
          componentType: "Graph",
          id: component.id,
          title: `${component.title || "Untitled chart"} (${index + 1})`,
          chartType: nextType[component.chartType],
        };
      }

      return {
        componentType: "Markdown",
        id: component.id,
        title: component.title || "Dashboard note",
        content: `${component.contentPreview}\n\n> Updated through the canvas bridge.`,
      };
    }),
  };
}

export function validateCanvasPatch(patch: unknown): CanvasPatch | null {
  const parsed = canvasPatchSchema.safeParse(patch);
  if (!parsed.success) return null;
  return parsed.data;
}

export function applyCanvasPatch(patch: unknown): boolean {
  const safePatch = validateCanvasPatch(patch);
  if (!safePatch) return false;

  const store = useStudyCanvasStore.getState();
  const activeId = store.activeCanvasId;
  if (!activeId) return false;

  const activeComponents = useStudyCanvasStore.getState().getComponents(activeId);
  const componentsById = new Map(
    activeComponents.map((component) => [component.componentId, component]),
  );

  const allPatchTargetsAreAllowed = safePatch.components.every((component) => {
    const current = componentsById.get(component.id);
    return current?._componentType === component.componentType;
  });

  if (!allPatchTargetsAreAllowed) return false;

  safePatch.components.forEach((component) => {
    const current = componentsById.get(component.id) as
      | (CanvasComponent & { data?: Record<string, unknown> })
      | undefined;

    if (!current) return;

    if (component.componentType === "Graph") {
      useStudyCanvasStore.getState().updateComponent(activeId, component.id, {
        title: component.title,
        data: {
          ...(typeof current.data === "object" && current.data
            ? current.data
            : {}),
          type: component.chartType,
          title: component.title,
        },
      });
      return;
    }

    useStudyCanvasStore.getState().updateComponent(activeId, component.id, {
      ...(component.title !== undefined ? { title: component.title } : {}),
      ...(component.content !== undefined ? { content: component.content } : {}),
    });
  });

  safePatch.components.forEach((component, targetIndex) => {
    useStudyCanvasStore
      .getState()
      .reorderComponent(activeId, component.id, targetIndex);
  });

  return true;
}
