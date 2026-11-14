"use client";
import { useEffect, useMemo, useState } from "react";
import { fetchTechnicalAnalysisChart } from "./query-tools";
import { BuiltinActionType, Renderer, type ActionEvent } from "@openuidev/react-lang";
import { library } from "./library";
import { BusinessAction, runLibraryAction } from "./actions";

export type BusinessRequest = { name: string; context: Record<string, unknown> };

export function OutputView({ program, busy = false, onMessage, onBusinessAction, onError, active = false }: {
  program: string;
  active?: boolean;
  busy?: boolean;
  onMessage?: (message: string) => void;
  onBusinessAction?: (action: BusinessRequest) => void;
  onError?: () => void;
}) {
  const [live, setLive] = useState(false);
  const supportsLive = program.includes("$chart_refresh_seconds = 0");
  const controllers = useMemo(() => new Set<AbortController>(), [program]);
  useEffect(() => () => { controllers.forEach(controller => controller.abort()); controllers.clear(); }, [controllers]);
  useEffect(() => { if (!active) setLive(false); }, [active]);
  const toolProvider = useMemo(() => ({
    technical_analysis_chart: async (args: Record<string, unknown>) => {
      const controller = new AbortController();
      controllers.add(controller);
      try {
        return await fetchTechnicalAnalysisChart(args, controller.signal);
      }
      catch (error) { return { bars: [], error: error instanceof Error ? error.message : "가격 조회에 실패했습니다." }; }
      finally { controllers.delete(controller); }
    },
  }), [controllers]);
  const response = supportsLive ? program.replace("$chart_refresh_seconds = 0", `$chart_refresh_seconds = ${active && live ? 30 : 0}`) : program;
  function handleAction(event: ActionEvent) {
    if (busy) return;
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
  return <>{supportsLive && active && <label style={{ display: "block", marginBottom: 8 }}><input type="checkbox" checked={live} onChange={event => setLive(event.target.checked)} /> 30초마다 차트 갱신 (분석 본문 유지)</label>}<Renderer toolProvider={toolProvider} response={response} library={library} isStreaming={busy} onAction={handleAction} onError={errors => { if (errors.length) onError?.(); }} /></>;
}
