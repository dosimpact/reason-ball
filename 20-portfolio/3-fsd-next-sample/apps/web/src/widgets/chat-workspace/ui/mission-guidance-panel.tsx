"use client";

import { useId, useState } from "react";
import { selectGuidanceStep, type MissionGuidance } from "../model/mission-guidance";

export function MissionGuidancePanel({ guidance, open, onOpenChange, onInsert, onRetry, disabled }: {
  guidance: MissionGuidance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (hint: string) => void;
  onRetry: () => void;
  disabled: boolean;
}) {
  const id = useId();
  const [previewId, setPreviewId] = useState("");
  const selected = selectGuidanceStep(guidance, previewId);
  return <section className="mb-2 rounded-xl border border-indigo-100 bg-indigo-50/60 text-xs" data-testid="mission-guidance">
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => onOpenChange(!open)} className="w-full px-3 py-2 text-left font-bold text-indigo-800">단계별 힌트 {open ? "접기" : "열기"}</button>
    {open ? <div id={id} className="max-h-[min(13rem,20svh)] space-y-2 overflow-y-auto border-t border-indigo-100 p-3">
      {guidance.state === "loading" ? <p role="status">미션 실행 정보를 기다리고 있어요.</p> : guidance.state === "unavailable" ? <div role="alert"><p>실행 단계와 힌트를 연결하지 못했어요. 다른 단계의 힌트로 대체하지 않았습니다.</p><button type="button" disabled={disabled} onClick={onRetry} className="mt-2 underline">단계 정보 다시 불러오기</button></div> : <>
        <label className="block">연습할 단계<select value={previewId} onChange={(event) => setPreviewId(event.target.value)} className="mt-1 block w-full min-w-0 rounded-lg border bg-white p-2">
          <option value="">{guidance.state === "active" ? "현재 실행 단계" : "복습할 단계를 선택하세요"}</option>
          {guidance.steps.map((step) => <option key={step.id} value={step.id}>{step.order}. {step.label}</option>)}
        </select></label>
        {selected ? <><p className="font-bold">{previewId ? "선택한 연습 단계" : "현재 실행 단계"}: {selected.label}</p>
          <p className="whitespace-pre-wrap break-words" data-testid="mission-step-hint">{selected.hint || "이 단계에는 작성자가 제공한 힌트가 없어요."}</p>
          <button type="button" disabled={disabled || !selected.hint} onClick={() => onInsert(selected.hint)} className="rounded-lg bg-indigo-700 px-3 py-2 font-bold text-white disabled:opacity-40">힌트를 입력창에 덧붙이기</button></> : null}
        <p className="text-neutral-600">단계 선택과 힌트 사용은 목표 완료나 보상에 영향을 주지 않습니다. 작성자 힌트이므로 상황에 맞게 고쳐 말해 보세요.</p>
      </>}
    </div> : null}
  </section>;
}
