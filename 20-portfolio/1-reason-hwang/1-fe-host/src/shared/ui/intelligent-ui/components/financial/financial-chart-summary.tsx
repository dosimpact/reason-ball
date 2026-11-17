"use client";

import { defineComponent, useStateField } from "@openuidev/react-lang";
import { z } from "zod/v4";
import { chartIndicators } from "./financial-indicators";
import { numberText, parametersText } from "./financial-format";
import { financialSnapshotSchema, type FinancialSnapshot, type IndicatorInstance } from "./financial-schema";
import { loadingSnapshot, useFinancialVisibility } from "./financial-visibility";

export function FinancialChartSummaryView({ snapshot: value, visible = [], selectionError, onVisibilityChange }: { snapshot?: FinancialSnapshot | null; visible?: IndicatorInstance[]; selectionError?: string; onVisibilityChange?: (id: string, checked: boolean) => void }) {
  const snapshot = value ?? loadingSnapshot;
  const indicators = chartIndicators(snapshot);
  if (!indicators.length) return null;
  return <details className="iui-indicator-summary">
    <summary>지표 요약 · {indicators.length}개</summary>
    <section aria-label="지표 요약과 표시 설정">
      {onVisibilityChange && <p>하위 패널은 최대 4개입니다. 표시 선택은 조회·모델 호출 없이 화면만 바꿉니다. 각 패널은 단위별로 분리됩니다.</p>}
      {selectionError && <p role="alert">{selectionError}</p>}
      {indicators.map(indicator => <details key={indicator.instanceId} className="iui-indicator-summary-item"><summary>{indicator.label} · {indicator.status === "error" ? "계산 오류" : indicator.series.every(series => series.values.at(-1) == null) ? "준비 구간 / 값 없음" : indicator.series.map(series => `${series.label}: ${numberText(series.values.at(-1))} ${series.unit}`).join(" · ")}{indicator.signal ? ` · ${indicator.signal.state}${indicator.signal.cross ? ` / ${indicator.signal.cross}` : ""}` : ""}</summary>
        {onVisibilityChange && <label className="iui-indicator-toggle"><input type="checkbox" checked={visible.some(item => item.instanceId === indicator.instanceId)} onChange={event => onVisibilityChange?.(indicator.instanceId, event.target.checked)} />{indicator.panel === "price" ? "가격 위에 표시" : "하위 패널 표시"}</label>}
        <p>설정: {parametersText(indicator.parameters) || "없음"}</p>{indicator.signal && <p>서버 시그널 근거: {parametersText(indicator.signal)}</p>}<p>인스턴스: {indicator.instanceId}</p>
        {indicator.error && <p role="alert">{indicator.error}{indicator.errorCode ? ` (${indicator.errorCode})` : ""}</p>}{indicator.warnings?.map(warning => <p key={warning}>{warning}</p>)}
        <p>최신 표시 봉: {snapshot.bars.at(-1)?.time ?? "—"}. 값 없음은 0을 의미하지 않습니다.</p>
        <ul>{indicator.series.map(series => <li key={series.key}>{series.label}: {numberText(series.values.at(-1))} {series.unit}{series.bandGroup ? ` · ${series.bandGroup} ${series.role ?? ""} 경계` : ""}</li>)}</ul>
      </details>)}
    </section>
  </details>;
}

export const FinancialChartSummary = defineComponent({
  name: "FinancialChartSummary", props: z.object({ snapshot: financialSnapshotSchema, visibilityKey: z.string().optional() }),
  description: "Collapsed verified indicator summary with latest values, units, settings, signals and errors. Compose separately from FinancialChartPlot when useful.",
  component: function FinancialChartSummaryComponent({ props, statementId }) {
    const field = useStateField<Record<string, boolean>>(`${props.visibilityKey ?? statementId ?? "financial-chart-summary"}.visibility`, {});
    const state = useFinancialVisibility({ snapshot: props.snapshot, visibility: field.value, onVisibilityChange: value => field.setValue(value) });
    return <FinancialChartSummaryView snapshot={state.snapshot} visible={state.visible} selectionError={state.selectionError} onVisibilityChange={state.toggle} />;
  },
});
