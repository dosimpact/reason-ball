"use client";

import { useState, type FormEvent } from "react";
import type { StrategyConfirmInput, StrategyView } from "@/entities/strategy";
import { Button } from "@/shared/ui/button";
import styles from "./strategy-workspace.module.css";

type Reasons = NonNullable<StrategyConfirmInput["decisionReasons"]>;
const reasonLabels: { key: keyof Reasons; label: string }[] = [
  { key:"wave", label:"파동 카운팅 근거" }, { key:"fibonacci", label:"Fibonacci 기준" },
  { key:"entry", label:"진입 이유" }, { key:"stopLoss", label:"손절 이유" },
  { key:"target", label:"목표 이유" }, { key:"invalidation", label:"무효화 이유" },
  { key:"exit", label:"청산 판단 이유" },
];
const emptyReasons: Reasons = { wave:"", fibonacci:"", entry:"", stopLoss:"", target:"", invalidation:"", exit:"" };

export function PlanDraftForm({ view, selectedIndices, onSave, onConfirm, pending, error }: {
  view: StrategyView; selectedIndices: number[];
  onSave: (draft: StrategyView["draftPlan"]) => void;
  onConfirm: (input: Omit<StrategyConfirmInput, "expectedVersion">) => void;
  pending: boolean; error?: string;
}) {
  const saved = view.draftPlan;
  const close = view.visibleCandles.at(-1)?.close ?? 100;
  const [entry, setEntry] = useState(String(saved.entry ?? Number((close * 1.015).toFixed(2))));
  const [stopLoss, setStopLoss] = useState(String(saved.stopLoss ?? Number((close * .975).toFixed(2))));
  const [target, setTarget] = useState(String(saved.target ?? Number((close * 1.08).toFixed(2))));
  const [rationale, setRationale] = useState(saved.rationale ?? "");
  const [reasons, setReasons] = useState<Reasons>({ ...emptyReasons, ...saved.decisionReasons });
  const [exitStrategy, setExitStrategy] = useState(saved.exitStrategy ?? "");
  const [policy, setPolicy] = useState<"auto-abort" | "warn-only">(saved.monitoring?.policy ?? "auto-abort");
  const [ruleKind, setRuleKind] = useState<"default" | "price-level" | "wave4-overlap">(saved.monitoring?.rule?.kind ?? "default");
  const [boundary, setBoundary] = useState(saved.monitoring?.rule?.kind === "price-level" ? String(saved.monitoring.rule.level) : "");
  const [wave3Number, setWave3Number] = useState(saved.monitoring?.rule?.kind === "wave4-overlap" ? String(saved.monitoring.rule.wave3Index + 1) : "");
  const [localError, setLocalError] = useState("");
  function draft(): StrategyView["draftPlan"] {
    const rule = ruleKind === "price-level" && Number(boundary) > 0 ? { kind:"price-level" as const, level:Number(boundary) } : ruleKind === "wave4-overlap" && Number(wave3Number) > 0 ? { kind:"wave4-overlap" as const, wave3Index:Number(wave3Number) - 1 } : undefined;
    return {
      waveIndices:selectedIndices,
      entry:entry === "" ? null : Number(entry),
      stopLoss:stopLoss === "" ? null : Number(stopLoss),
      target:target === "" ? null : Number(target),
      rationale, decisionReasons:reasons, exitStrategy,
      monitoring:{ policy, ...(rule ? { rule } : {}) },
    };
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedIndices.length !== 3) { setLocalError("공개된 차트에서 시작점·1파·2파 세 지점을 시간순으로 선택하세요."); return; }
    const prices = [Number(entry), Number(stopLoss), Number(target)];
    if (prices.some((value) => !Number.isFinite(value) || value <= 0) || !(prices[1] < prices[0] && prices[0] < prices[2])) { setLocalError("손절가 < 진입가 < 목표가 순서로 양의 가격을 입력하세요."); return; }
    if (!rationale.trim() || !exitStrategy.trim() || Object.values(reasons).some((value) => !value.trim())) { setLocalError("판단 근거와 일곱 가지 결정 이유, 청산 전략을 모두 입력하세요."); return; }
    if (ruleKind === "price-level" && !(Number(boundary) > 0)) { setLocalError("별도 무효화 가격을 입력하세요."); return; }
    if (ruleKind === "wave4-overlap" && !(Number.isInteger(Number(wave3Number)) && Number(wave3Number) - 1 > selectedIndices[2] && Number(wave3Number) <= view.visibleCandles.length)) { setLocalError("3파 끝 캔들은 선택한 2파 뒤의 공개된 봉이어야 합니다."); return; }
    setLocalError("");
    const savedDraft = draft();
    onConfirm({ waveIndices:selectedIndices as [number,number,number], entry:prices[0], stopLoss:prices[1], target:prices[2], rationale:rationale.trim(), decisionReasons:reasons, exitStrategy:exitStrategy.trim(), monitoring:savedDraft.monitoring });
  }
  return <section className={styles.card} aria-label="전략 계획 초안"><h2>2. 파동과 계획 작성</h2><p className={styles.hint}>공개된 차트에서 세 지점을 선택하세요. 초안은 저장 후 다시 열 수 있으며 확정 시 현재 기준 봉의 계획이 고정됩니다.</p>
    <form className={styles.form} onSubmit={submit}>
      <p className={styles.notice}>파동 지점 {selectedIndices.length} / 3 {selectedIndices.length > 0 && `· 선택한 봉 ${selectedIndices.map((index) => index + 1).join(" → ")}`}</p>
      <div className={styles.formRow}><label>진입가<input type="number" step="any" min="0" value={entry} onChange={(event) => setEntry(event.target.value)} required /></label><label>손절가<input type="number" step="any" min="0" value={stopLoss} onChange={(event) => setStopLoss(event.target.value)} required /></label></div>
      <div className={styles.formRow}><label>목표가<input type="number" step="any" min="0" value={target} onChange={(event) => setTarget(event.target.value)} required /></label><label>무효화 처리<select aria-label="무효화 처리" value={policy} onChange={(event) => setPolicy(event.target.value as typeof policy)}><option value="auto-abort">자동 중단</option><option value="warn-only">경고만</option></select></label></div>
      <label>파동 무효화 규칙<select aria-label="파동 무효화 규칙" value={ruleKind} onChange={(event) => setRuleKind(event.target.value as typeof ruleKind)}><option value="default">시작점 가격 이탈</option><option value="price-level">별도 가격 경계</option><option value="wave4-overlap">4파가 1파 영역 침범</option></select></label>
      {ruleKind === "price-level" && <label>별도 무효화 가격<input type="number" step="any" min="0" value={boundary} onChange={(event) => setBoundary(event.target.value)} required /></label>}
      {ruleKind === "wave4-overlap" && <label>확인한 3파 끝 캔들 번호<input type="number" min={(selectedIndices[2] ?? 0) + 2} max={view.visibleCandles.length} value={wave3Number} onChange={(event) => setWave3Number(event.target.value)} required /></label>}
      <label>계획 요약<textarea value={rationale} onChange={(event) => setRationale(event.target.value)} maxLength={2000} required placeholder="파동 구조와 매매 계획을 요약하세요." /></label>
      <details><summary>결정별 근거 7개 <span className={styles.hint}>확정 시 필수</span></summary><div className={styles.form} style={{ marginTop:12 }}>{reasonLabels.map(({ key,label }) => <label key={key}>{label}<textarea value={reasons[key]} onChange={(event) => setReasons((current) => ({ ...current, [key]:event.target.value }))} maxLength={2000} placeholder={`${label}를 기록하세요.`} /></label>)}</div></details>
      <label>청산 전략<textarea value={exitStrategy} onChange={(event) => setExitStrategy(event.target.value)} maxLength={2000} required placeholder="목표 도달·무효화·시간 경과에 어떻게 대응하나요?" /></label>
      {(localError || error) && <p className={styles.error} role="alert">{localError || error}</p>}
      <div className={styles.formActions}><Button type="button" variant="secondary" disabled={pending} onClick={() => { setLocalError(""); onSave(draft()); }}>{pending ? "저장 중…" : "초안 저장"}</Button><Button type="submit" disabled={pending || selectedIndices.length !== 3}>계획 확정</Button></div>
    </form>
  </section>;
}
