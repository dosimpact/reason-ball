"use client";
import { create } from "zustand";
import {
  acceptsSnapshot,
  applyCommand,
  decodeDocument,
  emptyDocument,
  snapshotSchema,
  STORAGE_KEY,
  type CanvasDocument,
  type Command,
} from "./model";

type Runtime = {
  status: "loading" | "error" | "ready";
  error?: string;
  lastAttemptAt?: string;
};
type Store = {
  doc: CanvasDocument;
  loaded: boolean;
  error: string | null;
  recoveryRaw: string | null;
  runtime: Record<string, Runtime>;
  dispatch: (command: Command) => void;
  hydrate: () => void;
  resetRecovery: () => void;
  setError: (error: string | null) => void;
};
export const useCanvas = create<Store>((set, get) => ({
  doc: emptyDocument(),
  loaded: false,
  error: null,
  recoveryRaw: null,
  runtime: {},
  setError: (error) => set({ error }),
  hydrate: () => {
    if (get().loaded) return;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      set({ doc: raw ? decodeDocument(raw) : emptyDocument(), loaded: true });
    } catch {
      set({
        loaded: true,
        recoveryRaw: raw,
        error:
          "이 저장 문서는 지원하지 않거나 손상되었습니다. 원본을 보존했습니다. 내려받은 뒤 새 Canvas를 시작할 수 있습니다.",
      });
    }
  },
  resetRecovery: () => {
    const raw = get().recoveryRaw;
    try {
      if (raw) localStorage.setItem(`${STORAGE_KEY}:backup:${Date.now()}`, raw);
    } catch {
      set({ error: "백업을 저장하지 못했습니다. 원본을 먼저 내려받으세요." });
      return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
      set({ doc: emptyDocument(), recoveryRaw: null, error: null });
    } catch {
      set({ error: "저장 문서를 초기화하지 못했습니다. 원본은 유지됩니다." });
    }
  },
  dispatch: (command) => {
    if (get().recoveryRaw) return;
    try {
      const doc = applyCommand(get().doc, command);
      set({ doc, error: null });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
      } catch {
        set({
          error:
            "브라우저에 저장하지 못했습니다. 저장 공간 또는 접근 권한을 확인하세요.",
        });
      }
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "변경을 적용하지 못했습니다.",
      });
    }
  },
}));

const inFlight = new Map<
  string,
  { key: string; controller: AbortController; promise: Promise<void> }
>();
async function parametersHash(parameters: Record<string, string> = {}) {
  const serialized =
    "{" +
    Object.keys(parameters)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}: ${JSON.stringify(parameters[key])}`,
      )
      .join(", ") +
    "}";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(serialized),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}
export function refreshWidget(id: string): Promise<void> {
  const state = useCanvas.getState();
  const widget = state.doc.widgets[id];
  if (!widget?.queryId || !widget.queryVersion) return Promise.resolve();
  const captured = {
    revision: widget.definitionRevision,
    queryId: widget.queryId,
    queryVersion: widget.queryVersion,
    parameters: JSON.stringify(widget.parameters),
  };
  const key = JSON.stringify(captured);
  const existing = inFlight.get(id);
  if (existing?.key === key) return existing.promise;
  existing?.controller.abort();
  const controller = new AbortController();
  const requestId = crypto.randomUUID();
  const promise = (async () => {
    useCanvas.setState((s) => ({
      runtime: {
        ...s.runtime,
        [id]: { status: "loading", lastAttemptAt: new Date().toISOString() },
      },
    }));
    try {
      const expectedHash = await parametersHash(widget.parameters);
      const response = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queryId: widget.queryId,
          queryVersion: widget.queryVersion,
          parameters: widget.parameters,
          definitionRevision: captured.revision,
          requestId,
        }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "데이터 조회 실패");
      const snapshot = snapshotSchema.parse(result);
      if (snapshot.parametersHash !== expectedHash)
        throw new Error("조회 조건이 다른 결과를 적용하지 않았습니다.");
      const current = useCanvas.getState().doc.widgets[id];
      if (
        controller.signal.aborted ||
        !current ||
        result.requestId !== requestId ||
        result.definitionRevision !== captured.revision ||
        !acceptsSnapshot(current, captured, snapshot)
      )
        return;
      useCanvas.getState().dispatch({
        type: "replace",
        widget: { ...current, snapshot },
        baseRevision: captured.revision,
      });
      useCanvas.setState((s) => ({
        runtime: {
          ...s.runtime,
          [id]: { status: "ready", lastAttemptAt: new Date().toISOString() },
        },
      }));
    } catch (e) {
      if (!controller.signal.aborted)
        useCanvas.setState((s) => ({
          runtime: {
            ...s.runtime,
            [id]: {
              status: "error",
              error: e instanceof Error ? e.message : "조회 실패",
              lastAttemptAt: new Date().toISOString(),
            },
          },
        }));
    } finally {
      if (inFlight.get(id)?.controller === controller) {
        inFlight.delete(id);
        useCanvas.setState((s) =>
          s.runtime[id]?.status === "loading"
            ? {
                runtime: {
                  ...s.runtime,
                  [id]: { ...s.runtime[id], status: "ready" },
                },
              }
            : s,
        );
      }
    }
  })();
  inFlight.set(id, { key, controller, promise });
  return promise;
}

export function stopRefreshes() {
  for (const { controller } of inFlight.values()) controller.abort();
  inFlight.clear();
}
