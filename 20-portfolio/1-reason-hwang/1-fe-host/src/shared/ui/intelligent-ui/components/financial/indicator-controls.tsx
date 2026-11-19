"use client";
import { defineComponent, reactive, useIsStreaming, useStateField } from "@openuidev/react-lang";
import { useEffect, useId, useState } from "react";
import { z } from "zod/v4";
import { indicatorCatalogSchema, type IndicatorCatalog } from "./financial-schema";

type InstanceDraft = { instanceId?: string; name: string; parameters?: Record<string, number | string>; showSignal?: boolean };
const parseInstances = (value: unknown): InstanceDraft[] => {
  try { const parsed = JSON.parse(String(value ?? "[]")); return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === "object" && typeof item.name === "string") : []; }
  catch { return []; }
};
const withId = (instance: InstanceDraft): InstanceDraft => ({ ...instance, instanceId: instance.instanceId ?? `ui-${crypto.randomUUID()}` });

export function IndicatorControlsView({ catalog, value, onApply, disabled = false }: { catalog?: IndicatorCatalog | null; value: string; onApply: (value: string) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState<InstanceDraft[]>(() => parseInstances(value));
  const [selected, setSelected] = useState("SMA");
  const [error, setError] = useState("");
  const id = useId();
  useEffect(() => { setDraft(parseInstances(value)); setError(""); }, [value]);
  const maxInstances = Math.min(40, catalog?.maxInstances ?? 40);
  const dirty = JSON.stringify(draft) !== JSON.stringify(parseInstances(value));
  const replace = (instances: InstanceDraft[]) => { setError(""); setDraft(instances.map(withId)); };
  function apply() {
    if (!catalog) return;
    try {
      if (draft.length > maxInstances) throw new Error(`지표는 최대 ${maxInstances}개입니다.`);
      const normalized = draft.map(instance => {
        const definition = catalog!.indicators.find(item => item.name === instance.name);
        if (!definition) throw new Error(`카탈로그에 없는 지표: ${instance.name}`);
        const parameters = Object.fromEntries(Object.entries(definition.parameters).map(([key, constraint]) => {
          const raw = instance.parameters?.[key] ?? constraint.default;
          const number = typeof raw === "string" && !raw.trim() ? NaN : Number(raw);
          if (!Number.isFinite(number) || number < constraint.min || number > constraint.max || (constraint.type === "integer" && !Number.isInteger(number))) throw new Error(`${instance.name} ${key}: ${constraint.min}~${constraint.max}${constraint.type === "integer" ? " 정수" : ""}를 입력하세요.`);
          return [key, number];
        }));
        return { ...withId(instance), parameters, ...(definition.supportsSignal ? { showSignal: instance.showSignal ?? Number(parameters.signal_period ?? 0) > 0 } : {}) };
      });
      onApply(JSON.stringify(normalized)); setError("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "지표 설정을 확인하세요."); }
  }
  return <section className="iui-indicator-controls" aria-label="지표 설정">
    <h3>지표 설정 · {draft.length}/{maxInstances}</h3>
    <p>초안을 편집한 뒤 적용하면 차트만 다시 조회합니다. 새로고침은 마지막 적용 설정을 사용하며 분석 본문은 바뀌지 않습니다.</p>
    {!catalog ? <p role="status">지표 카탈로그를 불러오는 중…</p> : <fieldset disabled={disabled}>
      <div className="iui-indicator-controls-toolbar"><label htmlFor={`${id}-name`}>추가할 지표</label><select id={`${id}-name`} className="iui-input" value={selected} onChange={event => setSelected(event.target.value)}>{catalog.indicators.map(item => <option key={item.name} value={item.name}>{item.label} ({item.name})</option>)}</select>
        <button type="button" className="iui-indicator-button" disabled={draft.length >= maxInstances} onClick={() => { const definition = catalog.indicators.find(item => item.name === selected); if (definition) setDraft(previous => [...previous, withId({ name: definition.name, parameters: { ...definition.defaults } })]); }}>지표 추가</button>
        <button type="button" className="iui-indicator-button" onClick={() => replace(catalog.defaultInstances)}>기본 3개로 바꾸기</button>
        <button type="button" className="iui-indicator-button" onClick={() => replace(catalog.indicators.map(item => ({ name: item.name, parameters: { ...item.defaults } })))}>전체 20개 기본 구성</button>
      </div>
      <ol className="iui-indicator-drafts">{draft.map((instance, index) => {
        const definition = catalog.indicators.find(item => item.name === instance.name);
        return <li key={instance.instanceId ?? `${instance.name}-${index}`}><details><summary>{definition?.label ?? instance.name} · {Object.entries(instance.parameters ?? {}).map(([key, number]) => `${key}=${number}`).join(", ") || "기본 설정"}</summary>
          <div className="iui-indicator-parameters">{definition && Object.entries(definition.parameters).map(([key, constraint]) => <label key={key}>{key}<input type="number" className="iui-input" min={constraint.min} max={constraint.max} step={constraint.type === "integer" ? 1 : "any"} value={instance.parameters?.[key] ?? constraint.default} onChange={event => setDraft(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, parameters: { ...item.parameters, [key]: event.target.value }, ...(key === "signal_period" ? { showSignal: Number(event.target.value) > 0 } : {}) } : item))} /><small>{constraint.min}~{constraint.max}{constraint.type === "integer" ? " · 정수" : ""}</small></label>)}</div>
          {definition?.supportsSignal && <label><input type="checkbox" checked={instance.showSignal ?? Number(instance.parameters?.signal_period ?? 0) > 0} onChange={event => setDraft(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, showSignal: event.target.checked, parameters: { ...item.parameters, signal_period: event.target.checked ? Number(item.parameters?.signal_period ?? 0) || 9 : 0 } } : item))} />보조 signal 선 포함 (기본은 주 지표만)</label>}
          <button type="button" className="iui-indicator-button" aria-label={`${instance.name} ${index + 1} 설정 복제`} disabled={draft.length >= maxInstances} onClick={() => setDraft(previous => [...previous, withId({ ...instance, instanceId: undefined, parameters: { ...instance.parameters } })])}>설정 복제</button>
          <button type="button" className="iui-indicator-button" aria-label={`${instance.name} ${index + 1} 제거`} onClick={() => setDraft(previous => previous.filter((_, itemIndex) => itemIndex !== index))}>제거</button>
        </details></li>;
      })}</ol>
      <div className="iui-indicator-controls-toolbar"><button type="button" className="iui-indicator-button" onClick={apply}>지표 설정 적용 · 차트 조회</button><button type="button" className="iui-indicator-button" disabled={!dirty} onClick={() => { setDraft(parseInstances(value)); setError(""); }}>초안 되돌리기</button><span role="status">{dirty ? "적용하지 않은 초안" : "적용된 설정"}</span></div>
    </fieldset>}
    {error && <p role="alert">{error}</p>}
  </section>;
}

export const IndicatorControls = defineComponent({
  name: "IndicatorControls",
  props: z.object({ value: reactive(z.string()), catalog: indicatorCatalogSchema.nullable() }),
  description: "Edit technical indicator instances from the trusted catalog. Bind value to $chart_instances JSON string and pass the catalog Query result. Supports repeated names with independent instanceIds, parameter drafts, optional signal and explicit model-free Apply. Keep inside the chart QueryPanel.",
  component: function IndicatorControlsComponent({ props, statementId }) {
    const field = useStateField(statementId ?? "indicator-instances", props.value);
    const streaming = useIsStreaming();
    return <IndicatorControlsView catalog={props.catalog} value={String(field.value ?? "[]")} onApply={value => field.setValue(value)} disabled={streaming} />;
  },
});
