"use client";
import { create } from "zustand";
import {
  dashboardSchema,
  EMPTY,
  type Dashboard,
  type Panel,
  validateProgram,
} from "@/entities/dashboard";

export type DashboardMutation = (
  action: string,
  id?: string | null,
  payload?: Record<string, unknown>,
) => Promise<void>;

type State = {
  documents: Record<string, Dashboard>;
  errors: Record<string, string>;
  accept: (threadId: string, raw: unknown) => void;
  notice: (threadId: string, message: string) => void;
};
export const useDashboard = create<State>((set, get) => ({
  documents: {},
  errors: {},
  accept: (threadId, raw) => {
    const result = dashboardSchema.safeParse(raw);
    if (!result.success) {
      get().notice(
        threadId,
        "대시보드 형식이 올바르지 않아 이전 상태를 유지합니다.",
      );
      return;
    }
    const previous = get().documents[threadId];
    if (previous && result.data.revision < previous.revision) return;
    set((state) => ({
      documents: { ...state.documents, [threadId]: result.data },
    }));
  },
  notice: (threadId, message) =>
    set((state) => ({ errors: { ...state.errors, [threadId]: message } })),
}));
export async function loadDashboard(threadId: string) {
  const response = await fetch(`/api/dashboard/state/${threadId}`);
  if (!response.ok) throw new Error("대시보드를 불러오지 못했습니다.");
  useDashboard.getState().accept(threadId, await response.json());
}
async function executeCommand(
  threadId: string,
  action: string,
  panelId: string | null = null,
  payload: Record<string, unknown> = {},
) {
  const store = useDashboard.getState();
  const state = store.documents[threadId] ?? EMPTY;
  store.notice(threadId, "");
  const response = await fetch(`/api/dashboard/state/${threadId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operation_id: crypto.randomUUID(),
      base_revision: state.revision,
      action,
      panel_id: panelId,
      payload,
    }),
  });
  if (!response.ok) {
    if (response.status === 409) await loadDashboard(threadId);
    const message =
      response.status === 409
        ? "다른 변경이 먼저 저장되었습니다. 현재 화면을 확인하고 다시 시도해 주세요."
        : response.status === 400
          ? "대시보드 형식이나 패널 내용을 확인하지 못했습니다. 기존 결과는 보존됩니다."
          : ((await response.json()).error ?? "변경을 저장하지 못했습니다.");
    store.notice(threadId, message);
    throw new Error(message);
  }
  const result = await response.json();
  store.accept(threadId, result);
  return dashboardSchema.parse(result);
}
// Serialize this browser's writes per conversation; external writers still use 409 checks.
const pendingCommands = new Map<string, Promise<unknown>>();
export function command(
  threadId: string,
  action: string,
  panelId: string | null = null,
  payload: Record<string, unknown> = {},
) {
  const previous = pendingCommands.get(threadId) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(() => executeCommand(threadId, action, panelId, payload));
  pendingCommands.set(threadId, next);
  const cleanup = () => {
    if (pendingCommands.get(threadId) === next)
      pendingCommands.delete(threadId);
  };
  void next.then(cleanup, cleanup);
  return next;
}

export function addArtifact(
  threadId: string,
  panel: Panel,
  target?: { tabId?: string; position?: { x: number; y: number } },
) {
  if (panel.kind === "openui") validateProgram(panel.program);
  const state = useDashboard.getState().documents[threadId] ?? EMPTY;
  return command(threadId, "add", crypto.randomUUID(), {
    ...panel,
    source_artifact_id: panel.id,
    tab_id: target?.tabId ?? state.active_tab_id,
    layout: { ...panel.layout, ...target?.position },
  });
}
