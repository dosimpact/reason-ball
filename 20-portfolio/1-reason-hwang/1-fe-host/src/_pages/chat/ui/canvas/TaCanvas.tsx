"use client";
import { useCallback, useMemo, useState } from "react";
import { autoClose, createParser } from "@openuidev/lang-core";
import { OpenuiSystemPromptSpec as spec } from "@/shared/config";
import { Button } from "@/shared/ui/button";
import { OutputView } from "@/shared/ui/intelligent-ui";
import { useChat } from "../../model/context/useChat";
import type { CanvasReport } from "../../model/canvas";
// Disposable parser projection; never changes streamed source or the ready program.
function previewProgram(program: string): string | null {
  if (!program) return null;
  if (/(^|\n)\s*root\s*=/.test(program)) return program;
  if (!/(^|\n)\s*taLayout\s*=/.test(program)) return null;
  const projected = `${autoClose(program).text}\nroot = Col([taLayout])`;
  try {
    const parsed = createParser(spec.schema, spec.root).parse(projected);
    return parsed.root ? projected : null;
  } catch {
    return null;
  }
}
function ReportView({ report }: { report: CanvasReport }) {
  const { runtime, saveCanvasState, saveCanvasQuery, reanalyzeCanvas, status } = useChat();
  const [renderError, setRenderError] = useState(false);
  const onRenderError = useCallback(() => setRenderError(true), []);
  const [initialState] = useState(() => ({ ...report.reactiveState, $chart_refresh_seconds: 0 }));
  const onState = useCallback((state: Record<string, unknown>) => saveCanvasState(report.id, state), [report.id, saveCanvasState]);
  const onQuery = useCallback((args: Record<string, unknown>) => saveCanvasQuery(report.id, args), [report.id, saveCanvasQuery]);
  const displayProgram = useMemo(() => report.status === "ready" ? report.program : previewProgram(report.program), [report.program, report.status]);
  const busy = ["streaming", "creating_thread", "loading_history"].includes(status);
  return <><div className="ta-canvas-report-notice"><p>해석은 보고서 생성 시점의 스냅샷입니다. 조회 조건·새로고침은 모델 호출 없이 차트만 바꿉니다.</p><p>기준 {report.asOf ?? "—"}{report.successfulArgs ? ` · 마지막 조회 성공: ${report.successfulArgs.ticker} / ${report.successfulArgs.interval} / ${report.successfulArgs.count}봉` : " · 아직 성공한 차트 조회가 없습니다."}</p><Button variant="outline" disabled={busy || report.status !== "ready" || !report.successfulArgs} onClick={() => void reanalyzeCanvas(report.id)}>성공한 조회 조건으로 재분석</Button></div>
    {renderError && <p role="alert" className="p-4 text-sm text-destructive">검증된 보고서를 화면에 표시하지 못했습니다. 분석 설명과 조회 조건을 확인하세요.</p>}
    {report.status === "error" ? <div role="alert" className="p-4"><p>{report.error}</p>{report.fallbackText && <p className="mt-2 whitespace-pre-wrap">{report.fallbackText}</p>}</div> : <div className="ta-canvas-report-body"><p role="status" className="mb-3 text-xs text-muted-foreground">{report.status === "ready" ? "검증 완료" : report.status === "validating" ? "프로그램 검증 중… 조회와 액션은 잠겨 있습니다." : "보고서 생성 중… 조회와 액션은 잠겨 있습니다."}</p>{displayProgram ? <OutputView queryEndpoint={runtime.chartEndpoint} key={report.id} program={displayProgram} active={report.status === "ready"} provisional={report.status !== "ready"} initialState={initialState} onStateUpdate={report.status === "ready" ? onState : undefined} onQuerySuccess={onQuery} onError={report.status === "ready" ? onRenderError : undefined} /> : <p>차트 데이터와 분석 레이아웃을 구성하고 있습니다. 검증된 보고서가 도착하면 조회를 사용할 수 있습니다.</p>}</div>}
  </>;
}
export function TaCanvas() {
  const { canvas, selectCanvas, closeCanvas, collapseCanvas } = useChat();
  const selected = canvas.reports.find(report => report.id === canvas.selectedId);
  return <section className="ta-canvas-panel" aria-label="기술적 분석 Canvas"><header className="ta-canvas-heading"><h2>분석 Canvas</h2><Button variant="ghost" onClick={() => collapseCanvas(true)}>접기</Button></header><div role="tablist" aria-label="분석 보고서" className="ta-canvas-tabs">{canvas.reports.map(report => <div key={report.id} className="ta-canvas-tab"><button role="tab" tabIndex={report.id === canvas.selectedId ? 0 : -1} onKeyDown={event => { const index = canvas.reports.findIndex(item => item.id === report.id); let next = index; if (event.key === "ArrowLeft") next = (index + canvas.reports.length - 1) % canvas.reports.length; else if (event.key === "ArrowRight") next = (index + 1) % canvas.reports.length; else if (event.key === "Home") next = 0; else if (event.key === "End") next = canvas.reports.length - 1; else return; event.preventDefault(); selectCanvas(canvas.reports[next].id); const tabs = event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('[role="tab"]'); tabs?.[next]?.focus(); }} aria-selected={report.id === canvas.selectedId} aria-controls="ta-canvas-report" onClick={() => selectCanvas(report.id)}>{report.request?.ticker ?? report.title} · {report.request?.interval ?? ""} · {report.ordinal}</button><button type="button" aria-label={`${report.title} ${report.ordinal} 탭 닫기`} onClick={() => closeCanvas(report.id)}>×</button></div>)}</div><div role="tabpanel" id="ta-canvas-report" className="ta-canvas-report">{selected && <ReportView key={selected.id} report={selected} />}</div></section>;
}
