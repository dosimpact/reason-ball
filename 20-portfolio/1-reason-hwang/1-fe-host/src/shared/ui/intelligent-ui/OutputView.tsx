"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchTechnicalAnalysisChart } from "./query-tools";
import { BuiltinActionType, Renderer, type ActionEvent } from "@openuidev/react-lang";
import { library } from "./library";
import { BusinessAction, runLibraryAction } from "./actions";

export type BusinessRequest = { name: string; context: Record<string, unknown> };

export function OutputView({ program, busy = false, onMessage, onBusinessAction, onError, active = false, provisional = false, initialState, onStateUpdate, onQuerySuccess, queryEndpoint }: {
  program: string;
  queryEndpoint?: string;
  active?: boolean;
  provisional?: boolean;
  initialState?: Record<string, unknown>;
  onStateUpdate?: (state: Record<string, unknown>) => void;
  onQuerySuccess?: (args: Record<string, unknown>) => void;
  busy?: boolean;
  onMessage?: (message: string) => void;
  onBusinessAction?: (action: BusinessRequest) => void;
  onError?: () => void;
}) {
  const callbacks = useRef({ onQuerySuccess }); callbacks.current = { onQuerySuccess };
  const [live, setLive] = useState(false);
  const supportsLive = program.includes("$chart_refresh_seconds = 0");
  const controllers = useMemo(() => new Set<AbortController>(), [program, queryEndpoint]);
  useEffect(() => () => { controllers.forEach(controller => controller.abort()); controllers.clear(); }, [controllers]);
  useEffect(() => { if (!active) setLive(false); }, [active]);
  const toolProvider = useMemo(() => ({
    technical_analysis_chart: async (args: Record<string, unknown>) => {
      const controller = new AbortController();
      controllers.add(controller);
      try {
        const snapshot = await fetchTechnicalAnalysisChart(args, controller.signal, queryEndpoint);
        if (!controller.signal.aborted && !snapshot.error && snapshot.bars.length > 0) callbacks.current.onQuerySuccess?.(args);
        return snapshot;
      }
      catch (error) { return { bars: [], error: error instanceof Error ? error.message : "가격 조회에 실패했습니다." }; }
      finally { controllers.delete(controller); }
    },
  }), [controllers, queryEndpoint]);
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
  return <div inert={provisional || undefined} style={provisional ? { pointerEvents: "none" } : undefined}>{supportsLive && active && !provisional && <label style={{ display: "block", marginBottom: 8 }}><input type="checkbox" checked={live} onChange={event => setLive(event.target.checked)} /> 30초마다 차트 갱신 (분석 본문 유지)</label>}<Renderer initialState={initialState} onStateUpdate={onStateUpdate} toolProvider={provisional ? undefined : toolProvider} response={response} library={library} isStreaming={busy || provisional} onAction={handleAction} onError={errors => { if (errors.length) onError?.(); }} /></div>;
}
