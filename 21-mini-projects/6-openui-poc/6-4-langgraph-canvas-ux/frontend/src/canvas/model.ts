import { z } from "zod";

export const STORAGE_KEY = "canvas64:workspace:v2";
const row = z.record(z.string(), z.union([z.string(), z.number(), z.null()]));
export const snapshotSchema = z
  .object({
    columns: z.array(z.object({ name: z.string(), type: z.string() })),
    rows: z.array(row).max(500),
    rowCount: z.number(),
    truncated: z.boolean(),
    fetchedAt: z.string(),
    expiresAt: z.string(),
    sourceWatermark: z.object({
      revision: z.number(),
      ingestedAt: z.string(),
      throughDate: z.string(),
    }),
    dataVersion: z.string(),
    parametersHash: z.string(),
    queryVersion: z.literal(1),
    provenance: z.literal("synthetic"),
    resolvedRange: z.record(z.string(), z.string()),
  })
  .passthrough();
export type Snapshot = z.infer<typeof snapshotSchema>;
export const widgetSchema = z.object({
  id: z.string(),
  canvasId: z.string().optional(),
  title: z.string().max(300),
  program: z.string().max(100000),
  chartType: z.string(),
  content: z.string().optional(),
  definitionRevision: z.number().int().nonnegative(),
  rendererContractVersion: z.literal(1),
  catalogVersion: z.literal(1),
  refreshPolicy: z.enum(["snapshot", "manual", "polling"]),
  parameters: z.record(z.string(), z.string()).optional(),
  queryId: z.string().optional(),
  queryVersion: z.number().optional(),
  resultSchemaVersion: z.literal(1).optional(),
  bindingId: z.string().optional(),
  snapshot: snapshotSchema.optional(),
  layout: z.object({
    w: z.number().int().min(3).max(12),
    h: z.number().int().min(4).max(24),
  }),
  uiState: z.record(z.string(), z.unknown()),
});
export type Widget = z.infer<typeof widgetSchema>;
export const documentSchema = z.object({
  schemaVersion: z.literal(2),
  revision: z.number(),
  canvases: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        widgetIds: z.array(z.string()),
      }),
    )
    .max(30),
  widgets: z.record(z.string(), widgetSchema),
  activeCanvasId: z.string().nullable(),
  selectedWidgetId: z.string().nullable(),
});
export type CanvasDocument = z.infer<typeof documentSchema>;
export type Command =
  | { type: "createCanvas"; id: string; title: string }
  | { type: "renameCanvas"; id: string; title: string }
  | { type: "selectCanvas"; id: string }
  | { type: "removeCanvas" | "clearCanvas"; id: string }
  | { type: "reorderCanvas"; id: string; index: number }
  | { type: "select"; id: string | null }
  | { type: "add"; canvasId: string; widget: Widget }
  | { type: "replace"; widget: Widget; baseRevision: number }
  | { type: "remove"; id: string }
  | { type: "move"; id: string; canvasId: string; index?: number }
  | { type: "layout"; id: string; w: number; h: number }
  | { type: "policy"; id: string; policy: Widget["refreshPolicy"] }
  | { type: "uiState"; id: string; value: Record<string, unknown> };

export function emptyDocument(): CanvasDocument {
  return {
    schemaVersion: 2,
    revision: 0,
    canvases: [{ id: "default", title: "내 대시보드", widgetIds: [] }],
    widgets: {},
    activeCanvasId: "default",
    selectedWidgetId: null,
  };
}
export const clampLayout = (w: number, h: number) => ({
  w: Math.min(12, Math.max(3, Math.round(w))),
  h: Math.min(24, Math.max(4, Math.round(h))),
});
function reorder<T>(items: T[], from: number, to: number) {
  const out = [...items];
  const [item] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(to, out.length)), 0, item);
  return out;
}

/** UI, drag/drop와 AI 작업이 같은 상태 변경 규칙을 사용한다. */
export function applyCommand(
  previous: CanvasDocument,
  command: Command,
): CanvasDocument {
  const doc = structuredClone(previous);
  const canvas = (id: string) => {
    const c = doc.canvases.find((c) => c.id === id);
    if (!c) throw new Error("Canvas를 찾을 수 없습니다.");
    return c;
  };
  const widget = (id: string) => {
    const w = doc.widgets[id];
    if (!w) throw new Error("위젯을 찾을 수 없습니다.");
    return w;
  };
  const remove = (id: string) => {
    delete doc.widgets[id];
    for (const c of doc.canvases)
      c.widgetIds = c.widgetIds.filter((x) => x !== id);
    if (doc.selectedWidgetId === id) doc.selectedWidgetId = null;
  };
  switch (command.type) {
    case "createCanvas":
      if (doc.canvases.some((c) => c.id === command.id)) return previous;
      if (doc.canvases.length >= 30)
        throw new Error("Canvas는 최대 30개까지 저장할 수 있습니다.");
      doc.canvases.push({
        id: command.id,
        title: command.title.trim() || "새 Canvas",
        widgetIds: [],
      });
      doc.activeCanvasId = command.id;
      doc.selectedWidgetId = null;
      break;
    case "renameCanvas":
      canvas(command.id).title = command.title.trim() || "Canvas";
      break;
    case "selectCanvas":
      canvas(command.id);
      doc.activeCanvasId = command.id;
      doc.selectedWidgetId = null;
      break;
    case "clearCanvas":
      for (const id of [...canvas(command.id).widgetIds]) remove(id);
      break;
    case "removeCanvas":
      for (const id of [...canvas(command.id).widgetIds]) remove(id);
      doc.canvases = doc.canvases.filter((c) => c.id !== command.id);
      if (doc.activeCanvasId === command.id)
        doc.activeCanvasId = doc.canvases[0]?.id ?? null;
      break;
    case "reorderCanvas":
      canvas(command.id);
      doc.canvases = reorder(
        doc.canvases,
        doc.canvases.findIndex((c) => c.id === command.id),
        command.index,
      );
      break;
    case "select":
      if (command.id) widget(command.id);
      doc.selectedWidgetId = command.id;
      break;
    case "add": {
      const c = canvas(command.canvasId);
      if (doc.widgets[command.widget.id]) return previous;
      const w = widgetSchema.parse({ ...command.widget, canvasId: c.id });
      doc.widgets[w.id] = w;
      c.widgetIds.push(w.id);
      break;
    }
    case "replace": {
      const old = widget(command.widget.id);
      if (old.definitionRevision !== command.baseRevision)
        throw new Error(
          "이전 요청의 결과를 적용하지 않았습니다. 다시 요청하세요.",
        );
      doc.widgets[old.id] = widgetSchema.parse({
        ...command.widget,
        canvasId: old.canvasId,
        layout: old.layout,
        uiState: old.uiState,
      });
      break;
    }
    case "remove":
      widget(command.id);
      remove(command.id);
      break;
    case "move": {
      const w = widget(command.id);
      const c = canvas(command.canvasId);
      for (const source of doc.canvases)
        source.widgetIds = source.widgetIds.filter((id) => id !== w.id);
      c.widgetIds.splice(
        Math.max(
          0,
          Math.min(command.index ?? c.widgetIds.length, c.widgetIds.length),
        ),
        0,
        w.id,
      );
      w.canvasId = c.id;
      break;
    }
    case "layout":
      widget(command.id).layout = clampLayout(command.w, command.h);
      break;
    case "policy":
      widget(command.id).refreshPolicy = command.policy;
      widget(command.id).definitionRevision++;
      break;
    case "uiState":
      widget(command.id).uiState = command.value;
      break;
  }
  doc.revision++;
  return doc;
}

export function decodeDocument(raw: string): CanvasDocument {
  const value = JSON.parse(raw);
  // 우리가 지원하는 이전 문서 fixture만 명시적으로 변환한다.
  if (value.schemaVersion === 1) {
    value.schemaVersion = 2;
    value.selectedWidgetId ??= null;
    value.revision ??= 0;
  }
  const doc = documentSchema.parse(value);
  const owners = new Set<string>();
  for (const canvas of doc.canvases)
    for (const id of canvas.widgetIds) {
      if (
        !doc.widgets[id] ||
        owners.has(id) ||
        doc.widgets[id].canvasId !== canvas.id
      )
        throw new Error("저장 문서의 위젯 연결이 올바르지 않습니다.");
      owners.add(id);
    }
  if (owners.size !== Object.keys(doc.widgets).length)
    throw new Error("연결되지 않은 위젯이 있습니다.");
  if (
    doc.activeCanvasId &&
    !doc.canvases.some((c) => c.id === doc.activeCanvasId)
  )
    throw new Error("잘못된 Canvas 선택입니다.");
  if (doc.selectedWidgetId && !doc.widgets[doc.selectedWidgetId])
    doc.selectedWidgetId = null;
  return doc;
}

export function acceptsSnapshot(
  widget: Widget,
  captured: {
    revision: number;
    queryId?: string;
    queryVersion?: number;
    parameters: string;
  },
  snapshot: Snapshot,
) {
  return (
    widget.definitionRevision === captured.revision &&
    widget.queryId === captured.queryId &&
    widget.queryVersion === captured.queryVersion &&
    JSON.stringify(widget.parameters) === captured.parameters &&
    snapshot.queryVersion === captured.queryVersion
  );
}
