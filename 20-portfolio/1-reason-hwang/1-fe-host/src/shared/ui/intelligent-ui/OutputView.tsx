"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchIndicatorCatalog, fetchTechnicalAnalysisChart } from "./query-tools";
import { BuiltinActionType, Renderer, type ActionEvent } from "@openuidev/react-lang";
import { library } from "./library";
import { BusinessAction, runLibraryAction } from "./actions";
import { CanvasAddContext } from "./components/canvas-item";
import { extractCanvasItems, type CanvasItemSelection } from "./canvas-item";

export type BusinessRequest = { name: string; context: Record<string, unknown> };

export function OutputView({ program, busy = false, onMessage, onBusinessAction, onCanvasAdd, onError, active = false, provisional = false, initialState, onStateUpdate, onQuerySuccess, onQueryStatusChange, queryEndpoint }: {
  program: string;
  queryEndpoint?: string;
  active?: boolean;
  provisional?: boolean;
  initialState?: Record<string, unknown>;
  onStateUpdate?: (state: Record<string, unknown>) => void;
  onQuerySuccess?: (args: Record<string, unknown>) => void;
  onQueryStatusChange?: (status: "loading" | "success" | "error") => void;
  busy?: boolean;
  onMessage?: (message: string) => void;
  onBusinessAction?: (action: BusinessRequest) => void;
  onCanvasAdd?: (item: CanvasItemSelection) => void;
  onError?: () => void;
}) {
  const callbacks = useRef({ onQuerySuccess, onQueryStatusChange }); callbacks.current = { onQuerySuccess, onQueryStatusChange };
  const currentState = useRef(initialState);
  const canvasItems = useMemo(() => new Map(extractCanvasItems(program).map(item => [item.id, item])), [program]);
  useEffect(() => { currentState.current = initialState; }, [program, initialState]);
  const [live, setLive] = useState(false);
  const supportsLive = program.includes("$chart_refresh_seconds = 0");
  const requestScope = useMemo(() => ({ active: false, latestChartRequest: 0 }), [program, queryEndpoint]);
  useEffect(() => { requestScope.active = true; return () => { requestScope.active = false; }; }, [requestScope]);
  useEffect(() => { if (!active) setLive(false); }, [active]);
  const toolProvider = useMemo(() => ({
    technical_analysis_catalog: async () => fetchIndicatorCatalog((queryEndpoint ?? "/api/langgraph/technical-analysis/chart").replace(/\/chart$/, "/catalog")),
    technical_analysis_chart: async (args: Record<string, unknown>) => {
      const requestId = ++requestScope.latestChartRequest;
      if (requestScope.active) callbacks.current.onQueryStatusChange?.("loading");
      try {
        const snapshot = await fetchTechnicalAnalysisChart(args, undefined, queryEndpoint);
        if (requestScope.active && requestId === requestScope.latestChartRequest) {
          callbacks.current.onQueryStatusChange?.(snapshot.error || snapshot.bars.length === 0 ? "error" : "success");
          if (!snapshot.error && snapshot.bars.length > 0) callbacks.current.onQuerySuccess?.(args);
        }
        return snapshot;
      }
      catch (error) { if (requestScope.active && requestId === requestScope.latestChartRequest) callbacks.current.onQueryStatusChange?.("error"); return { bars: [], error: error instanceof Error ? error.message : "가격 조회에 실패했습니다." }; }
    },
  }), [requestScope, queryEndpoint]);
  const response = supportsLive ? program.replace("$chart_refresh_seconds = 0", `$chart_refresh_seconds = ${active && live ? 30 : 0}`) : program;
  function handleAction(event: ActionEvent) {
    if (busy || provisional) return;
    if (event.type === BusinessAction.name) {
      const parsed = event.params as Partial<BusinessRequest>;
      if (typeof parsed.name === "string" && parsed.context && typeof parsed.context === "object" && !Array.isArray(parsed.context)) {
        onBusinessAction?.({ name: parsed.name, context: parsed.context });
      }
    } else if (event.type === BuiltinActionType.ContinueConversation && event.humanFriendlyMessage) {
      const values = event.formState && Object.keys(event.formState).length ? `\n입력값: ${JSON.stringify(event.formState)}` : "";
      onMessage?.(`${event.humanFriendlyMessage}${values}`.slice(0, 4000));
    } else if (event.type === BuiltinActionType.OpenUrl) {
      const url = (event.params as { url?: string }).url;
      if (url && /^https?:\/\//i.test(url)) window.open(url, "_blank", "noopener,noreferrer");
    } else void runLibraryAction(event);
  }
  const addCanvasItem = onCanvasAdd && !busy && !provisional ? (id: string) => {
    const item = canvasItems.get(id);
    if (item) onCanvasAdd({ ...item, initialState: currentState.current });
  } : null;
  return <CanvasAddContext.Provider value={addCanvasItem}><div inert={provisional || undefined} style={provisional ? { pointerEvents: "none" } : undefined}>{supportsLive && active && !provisional && <label style={{ display: "block", marginBottom: 8 }}><input type="checkbox" checked={live} onChange={event => setLive(event.target.checked)} /> 30초마다 차트 갱신 (분석 본문 유지)</label>}<Renderer initialState={initialState} onStateUpdate={state => { currentState.current = state; onStateUpdate?.(state); }} toolProvider={provisional ? undefined : toolProvider} response={response} library={library} isStreaming={busy || provisional} onAction={handleAction} onError={errors => { if (errors.some(error => error.source !== "query" && error.severity !== "warning")) onError?.(); }}><Renderer.QueryLoading><p role="status">조회 중…</p></Renderer.QueryLoading><Renderer.QueryError><div role="alert"><p>데이터 또는 지표 카탈로그 조회에 실패했습니다. 서버 연결을 확인한 뒤 다시 시도하세요.</p><Renderer.Retry className="iui-indicator-button">실패한 조회 다시 시도</Renderer.Retry></div></Renderer.QueryError><Renderer.Content /></Renderer></div></CanvasAddContext.Provider>;
}
