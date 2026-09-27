"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CircleCheck, LockKeyhole, Target, Shield, Flag } from "lucide-react";
import type { Candle, TradePlan } from "@/entities/tutorial";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import styles from "./monitoring-fields.module.css";

export type DecisionReasons = { wave: string; fibonacci: string; entry: string; stopLoss: string; target: string; invalidation: string; exit: string };
export type PlanInput = { waveIndices: [number, number, number]; entry: number; stopLoss: number; target: number; rationale: string; decisionReasons: DecisionReasons; exitStrategy: string; monitoring?: { policy: "auto-abort" | "warn-only"; rule?: { kind: "price-level"; level: number } | { kind: "wave4-overlap"; wave3Index: number } } };
const reasonFields: { key: keyof DecisionReasons; label: string; prompt: string }[] = [
  { key: "wave", label: "파동 카운팅 근거", prompt: "왜 이 구간이 1파와 2파인가요?" },
  { key: "fibonacci", label: "Fibonacci 근거", prompt: "되돌림과 확장 목표를 어떻게 사용하나요?" },
  { key: "entry", label: "진입 이유", prompt: "어느 가격에서 추세를 확인하나요?" },
  { key: "stopLoss", label: "손절 이유", prompt: "포지션 위험은 어디서 제한하나요?" },
  { key: "target", label: "목표 이유", prompt: "청산 목표를 왜 이 가격에 두나요?" },
  { key: "invalidation", label: "카운팅 무효화 기준", prompt: "어떤 움직임에서 파동 해석이 깨지나요?" },
  { key: "exit", label: "청산 판단 이유", prompt: "목표 또는 구조 변화에 어떻게 대응하나요?" },
];
function PriceField({ label, icon, value, onChange, disabled }: { label: string; icon: React.ReactNode; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <label className="price-field"><span className="field-title">{icon}{label}</span><div className="price-input-wrap"><Input type="number" inputMode="decimal" step="any" min="0" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} required /><span>USD</span></div></label>;
}
export function TradePlanPanel({ waveIndices, plan, onConfirm, onRevise, pending, error, defaultEntry = 114, defaultStopLoss = 99, defaultTarget = 142.36, visibleCount = 0, visibleCandles = [] }: {
  waveIndices: number[]; plan: TradePlan | null; onConfirm: (input: PlanInput) => void; onRevise?: () => void; pending: boolean; error?: string; defaultEntry?: number; defaultStopLoss?: number; defaultTarget?: number; visibleCount?: number; visibleCandles?: Candle[];
}) {
  const [entry, setEntry] = useState(String(defaultEntry));
  const [stopLoss, setStopLoss] = useState(String(defaultStopLoss));
  const [target, setTarget] = useState(String(defaultTarget));
  const [rationale, setRationale] = useState("2파 저점을 확인한 뒤 3파 상승을 기대합니다. 시작점 아래를 손절 기준으로 둡니다.");
  const [decisions, setDecisions] = useState<DecisionReasons>({ wave:"1파 상승 뒤 2파 조정으로 해석했습니다.", fibonacci:"1파 길이의 1.618 확장을 참고합니다.", entry:"상승 재개를 확인한 뒤 진입합니다.", stopLoss:"위험을 제한하는 청산 가격입니다.", target:"확장 목표를 참고합니다.", invalidation:"시작점 이탈 시 카운팅을 다시 검토합니다.", exit:"목표 도달 또는 구조 변화 시 청산합니다." });
  const [exitStrategy, setExitStrategy] = useState("목표가 도달 시 청산하고, 무효화 시 즉시 재검토합니다.");
  const [validation, setValidation] = useState("");
  const [monitoringPolicy, setMonitoringPolicy] = useState<"auto-abort" | "warn-only">("auto-abort");
  const [ruleKind, setRuleKind] = useState<"default" | "price-level" | "wave4-overlap">("default");
  const [rulePrice, setRulePrice] = useState("");
  const [wave3Candle, setWave3Candle] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (waveIndices.length !== 3) { setValidation("먼저 차트에서 세 파동 지점을 선택하세요."); return; }
    if (!rationale.trim() || !exitStrategy.trim() || Object.values(decisions).some((value) => !value.trim())) { setValidation("판단 이유와 청산 전략을 모두 입력하세요."); return; }
    const prices = [Number(entry), Number(stopLoss), Number(target)];
    if (prices.some((price) => !Number.isFinite(price) || price <= 0) || !(prices[1] < prices[0] && prices[0] < prices[2])) { setValidation("가격은 0보다 커야 하고 손절가 < 진입가 < 목표가 순서여야 합니다."); return; }
    if (ruleKind === "price-level" && (!Number.isFinite(Number(rulePrice)) || Number(rulePrice) <= 0 || !rulePrice)) { setValidation("별도 무효화 가격은 0보다 큰 숫자로 입력하세요."); return; }
    const wave3Index = Number(wave3Candle) - 1;
    if (ruleKind === "wave4-overlap" && (!Number.isInteger(wave3Index) || wave3Index <= waveIndices[2] || wave3Index >= visibleCount)) { setValidation("Wave 3 끝점은 공개된 캔들 중 Wave 2 뒤에서 선택하세요."); return; }
    if (ruleKind === "wave4-overlap" && visibleCandles.length && visibleCandles[wave3Index].high <= visibleCandles[waveIndices[1]].high) { setValidation("확인한 Wave 3 고점은 Wave 1 고점보다 높아야 합니다."); return; }
    setValidation("");
    const rule = ruleKind === "price-level" ? { kind: "price-level" as const, level: Number(rulePrice) } : ruleKind === "wave4-overlap" ? { kind: "wave4-overlap" as const, wave3Index } : undefined;
    onConfirm({ waveIndices: waveIndices as [number, number, number], entry: prices[0], stopLoss: prices[1], target: prices[2], rationale: rationale.trim(), decisionReasons: decisions, exitStrategy: exitStrategy.trim(), monitoring: { policy: monitoringPolicy, ...(rule ? { rule } : {}) } });
  }
  if (plan) return <Card className="plan-card"><div className="panel-heading"><span className="eyebrow">YOUR TRADE PLAN · REV {plan.revision}</span><div className="confirmed-badge"><CircleCheck size={14} /> 확정됨</div></div><h2>매매 계획</h2><p className="panel-description">판단 당시의 계획을 그대로 보존합니다.</p>
    <div className="locked-note"><LockKeyhole size={17} /><span>계획은 수정할 수 없습니다. 새 시점에서 개정하세요.</span></div>
    <div className="confirmed-values"><div><span>진입가</span><strong>{plan.entry.toFixed(2)}</strong></div><div><span>손절가</span><strong>{plan.stopLoss.toFixed(2)}</strong></div><div><span>카운팅 무효화</span><strong>{plan.invalidationPrice?.toFixed(2) ?? "—"}</strong></div><div><span>목표가</span><strong>{plan.target.toFixed(2)}</strong></div></div>
    <div className="plan-rationale"><span>판단 근거</span><p>{plan.rationale}</p></div><div className="plan-fibonacci"><span>Fibonacci 근거</span><div><small>되돌림 비율</small><strong>{(plan.fibonacci.retracement * 100).toFixed(1)}%</strong></div><div><small>1.618 확장</small><strong>{plan.fibonacci.extension1618.toFixed(2)}</strong></div></div>
    <div className="plan-rationale"><span>청산 전략</span><p>{plan.exitStrategy}</p></div><div className="plan-meta">기준 캔들 · {new Date(plan.asOf * 1000).toLocaleString("ko-KR", { timeZone: "UTC" })} UTC</div>
    {onRevise && <Button variant="secondary" className="confirm-button" onClick={onRevise} disabled={pending}>새 계획 만들기</Button>}
  </Card>;
  return <Card className="plan-card"><div className="panel-heading"><span className="eyebrow">YOUR TRADE PLAN</span><span className="draft-badge">작성 중</span></div><h2>매매 계획</h2><p className="panel-description">다음 캔들을 보기 전에 판단을 기록하세요.</p>
    <div className="plan-steps"><span className={waveIndices.length === 3 ? "step-complete" : "step-active"}>01 <b>파동 선택</b></span><span className={waveIndices.length === 3 ? "step-active" : ""}>02 <b>계획 확정</b></span></div>
    <form onSubmit={submit} className="plan-form"><PriceField label="진입가" icon={<Target size={15} />} value={entry} onChange={setEntry} disabled={pending} /><PriceField label="손절가" icon={<Shield size={15} />} value={stopLoss} onChange={setStopLoss} disabled={pending} /><PriceField label="목표가" icon={<Flag size={15} />} value={target} onChange={setTarget} disabled={pending} />
      <p className="form-footnote">카운팅 무효화 가격은 선택한 파동에서 계산됩니다. 손절가는 별도의 매매 판단입니다.</p>
      <div className={styles.fields}><strong>전략 실행 모니터링</strong><p>교육용 모의 실행이며 실제 주문이나 틱 가격을 사용하지 않습니다.</p><label>무효화 처리<select aria-label="무효화 처리" value={monitoringPolicy} onChange={(event) => setMonitoringPolicy(event.target.value as "auto-abort" | "warn-only")} disabled={pending}><option value="auto-abort">자동 중단 · auto-abort</option><option value="warn-only">경고만 · warn-only</option></select></label><label>파동 무효화 규칙<select aria-label="파동 무효화 규칙" value={ruleKind} onChange={(event) => setRuleKind(event.target.value as typeof ruleKind)} disabled={pending}><option value="default">기본 Wave 0 가격 경계</option><option value="price-level">별도 가격 경계</option><option value="wave4-overlap">Wave 4와 Wave 1 겹침</option></select></label>{ruleKind === "price-level" && <label>별도 무효화 가격<input aria-label="별도 무효화 가격" type="number" min="0" step="any" value={rulePrice} onChange={(event) => setRulePrice(event.target.value)} disabled={pending} required /></label>}{ruleKind === "wave4-overlap" && <label>확인한 Wave 3 끝 캔들 번호<input aria-label="확인한 Wave 3 끝 캔들 번호" type="number" min={(waveIndices[2] ?? 0) + 2} max={visibleCount} step="1" value={wave3Candle} onChange={(event) => setWave3Candle(event.target.value)} disabled={pending} required /><small>현재 공개된 {visibleCount}개 캔들 중 실제 확인한 Wave 3 끝점을 적으세요.</small></label>}</div>
      <label className="rationale-field"><span className="field-title">판단 근거 <small>필수 입력</small></span><textarea rows={3} value={rationale} onChange={(event) => setRationale(event.target.value)} disabled={pending} required maxLength={2000} /></label>
      {reasonFields.map(({ key, label, prompt }) => <label className="rationale-field" key={key}><span className="field-title">{label}</span><textarea rows={2} value={decisions[key]} onChange={(event) => setDecisions((current) => ({ ...current, [key]: event.target.value }))} placeholder={prompt} disabled={pending} required maxLength={2000} /></label>)}
      <label className="rationale-field"><span className="field-title">청산 전략</span><textarea rows={2} value={exitStrategy} onChange={(event) => setExitStrategy(event.target.value)} disabled={pending} required maxLength={2000} /></label>
      {(validation || error) && <p role="alert" className="form-error">{validation || error}</p>}
      <Button type="submit" className="confirm-button" disabled={pending || waveIndices.length !== 3}>{pending ? "계획을 저장하는 중…" : "계획 확정하기"}<ArrowRight size={17} /></Button>
      <p className="form-footnote"><LockKeyhole size={12} /> 확정 계획은 변경할 수 없고 개정은 새 버전으로 보존됩니다.</p>
    </form>
  </Card>;
}
