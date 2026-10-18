import { describe, it, expect } from "vitest";
import {
  applyCommand,
  decodeDocument,
  emptyDocument,
  clampLayout,
  acceptsSnapshot,
  type Widget,
  type Snapshot,
} from "./model";
import { readFrames, type Frame } from "./stream";
const widget: Widget = {
  id: "w1",
  canvasId: "default",
  title: "매출",
  program: 'root = Col([Text("test")])',
  chartType: "bar",
  definitionRevision: 1,
  rendererContractVersion: 1,
  catalogVersion: 1,
  refreshPolicy: "manual",
  layout: { w: 6, h: 9 },
  uiState: { $count: 7 },
  queryId: "q_test",
  queryVersion: 1,
  parameters: { region: "KR", period: "last_3_months" },
};
function populated() {
  let d = applyCommand(emptyDocument(), {
    type: "add",
    canvasId: "default",
    widget,
  });
  d = applyCommand(d, {
    type: "add",
    canvasId: "default",
    widget: { ...widget, id: "w2", title: "광고비" },
  });
  return d;
}

describe("Canvas independent state and compatibility", () => {
  it("copies a chat preview; modifying a canvas widget never changes the source", () => {
    const d = populated();
    const next = applyCommand(d, {
      type: "uiState",
      id: "w1",
      value: { $count: 10 },
    });
    expect(widget.uiState).toEqual({ $count: 7 });
    expect(next.widgets.w2.uiState).toEqual({ $count: 7 });
  });
  it("moves and reorders while preserving data, layout and state", () => {
    let d = populated();
    d = applyCommand(d, {
      type: "move",
      id: "w2",
      canvasId: "default",
      index: 0,
    });
    expect(d.canvases[0].widgetIds).toEqual(["w2", "w1"]);
    d = applyCommand(d, {
      type: "createCanvas",
      id: "other",
      title: "다른 Canvas",
    });
    d = applyCommand(d, { type: "move", id: "w1", canvasId: "other" });
    expect(d.canvases[0].widgetIds).toEqual(["w2"]);
    expect(d.widgets.w1.uiState).toEqual({ $count: 7 });
    expect(d.widgets.w1.canvasId).toBe("other");
  });
  it("deletes only the requested canvas and its widgets", () => {
    let d = populated();
    d = applyCommand(d, {
      type: "createCanvas",
      id: "other",
      title: "다른 Canvas",
    });
    d = applyCommand(d, { type: "move", id: "w2", canvasId: "other" });
    d = applyCommand(d, { type: "removeCanvas", id: "default" });
    expect(Object.keys(d.widgets)).toEqual(["w2"]);
    expect(d.activeCanvasId).toBe("other");
  });
  it("rejects stale definition replacements and preserves both widgets", () => {
    const d = populated();
    expect(() =>
      applyCommand(d, {
        type: "replace",
        widget: { ...widget, title: "old" },
        baseRevision: 0,
      }),
    ).toThrow();
    expect(d.widgets.w1.title).toBe("매출");
  });
  it("keeps layout and live input changes when a model edit commits", () => {
    let d = populated();
    d = applyCommand(d, { type: "layout", id: "w1", w: 8, h: 12 });
    d = applyCommand(d, { type: "uiState", id: "w1", value: { $count: 99 } });
    d = applyCommand(d, {
      type: "replace",
      widget: { ...widget, title: "new", definitionRevision: 2 },
      baseRevision: 1,
    });
    expect(d.widgets.w1.layout).toEqual({ w: 8, h: 12 });
    expect(d.widgets.w1.uiState).toEqual({ $count: 99 });
  });
  it("deduplicates repeated completed widgets", () => {
    const d = populated();
    expect(applyCommand(d, { type: "add", canvasId: "default", widget })).toBe(
      d,
    );
  });
  it("clamps grid resizing", () => {
    expect(clampLayout(100, -2)).toEqual({ w: 12, h: 4 });
    expect(clampLayout(5.8, 9.1)).toEqual({ w: 6, h: 9 });
  });
  it("roundtrips completed documents and migrates supported v1", () => {
    const d = populated();
    expect(decodeDocument(JSON.stringify(d))).toEqual(d);
    expect(
      decodeDocument(
        JSON.stringify({ ...d, schemaVersion: 1, selectedWidgetId: undefined }),
      ).schemaVersion,
    ).toBe(2);
  });
  it.each(["document", "renderer", "catalog", "result-schema", "references"])(
    "rejects unsupported %s without mutating source",
    (kind) => {
      const d = populated();
      if (kind === "document") Object.assign(d, { schemaVersion: 99 });
      if (kind === "renderer")
        Object.assign(d.widgets.w1, { rendererContractVersion: 99 });
      if (kind === "catalog")
        Object.assign(d.widgets.w1, { catalogVersion: 99 });
      if (kind === "result-schema")
        Object.assign(d.widgets.w1, { resultSchemaVersion: 99 });
      if (kind === "references") d.canvases[0].widgetIds.push("missing");
      const raw = JSON.stringify(d);
      expect(() => decodeDocument(raw)).toThrow();
      expect(JSON.stringify(d)).toBe(raw);
    },
  );
  it("rejects late data after filter or version changes", () => {
    const cap = {
      revision: 1,
      queryId: widget.queryId,
      queryVersion: 1,
      parameters: JSON.stringify(widget.parameters),
    };
    const snap = { queryVersion: 1 } as Snapshot;
    expect(acceptsSnapshot(widget, cap, snap)).toBe(true);
    expect(
      acceptsSnapshot({ ...widget, definitionRevision: 2 }, cap, snap),
    ).toBe(false);
    expect(
      acceptsSnapshot({ ...widget, parameters: { region: "US" } }, cap, snap),
    ).toBe(false);
    expect(acceptsSnapshot(widget, cap, { queryVersion: 2 } as unknown as Snapshot)).toBe(
      false,
    );
  });
});

describe("incremental mixed-channel SSE", () => {
  function response(frames: object[], end = true) {
    const text = frames.map((f) => `data: ${JSON.stringify(f)}\n\n`).join("");
    const bytes = new TextEncoder().encode(text);
    return new Response(
      new ReadableStream({
        start(controller) {
          for (let i = 0; i < bytes.length; i += 3)
            controller.enqueue(bytes.slice(i, i + 3));
          if (end) controller.close();
        },
      }),
    );
  }
  it("decodes Korean chunks, keeps channels separate and ignores duplicate/reordered events", async () => {
    const got: Frame[] = [];
    const f = (sequence: number, channel: string, widgetId: string) => ({
      type: "delta",
      runId: "r",
      sequence,
      channel,
      widgetId,
      delta: "매출",
    });
    await readFrames(
      response([
        f(1, "chat", "a"),
        f(2, "canvas", "b"),
        f(2, "canvas", "b"),
        f(3, "canvas", "c"),
        { type: "done", runId: "r", sequence: 4 },
      ]),
      new AbortController().signal,
      (e) => got.push(e),
    );
    expect(got.map((f) => f.widgetId)).toEqual(["a", "b", "c", undefined]);
    expect(got[0].delta).toBe("매출");
  });
  it("reports connection loss instead of silently completing", async () => {
    await expect(
      readFrames(
        response([{ type: "start", runId: "r", sequence: 1 }]),
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toThrow("중단");
  });
  it("ignores all frames from an aborted request", async () => {
    const controller = new AbortController();
    controller.abort();
    const got: Frame[] = [];
    await readFrames(
      response([{ type: "done", runId: "r", sequence: 1 }]),
      controller.signal,
      (e) => got.push(e),
    );
    expect(got).toEqual([]);
  });
});
