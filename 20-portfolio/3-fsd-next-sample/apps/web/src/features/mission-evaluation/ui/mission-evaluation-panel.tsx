"use client";

import { CheckCircle2, Circle, LoaderCircle, RotateCcw } from "lucide-react";
import { useState } from "react";

import {
  type MissionCompletionResponse,
  type MissionEvaluationMessage,
  type MissionEvaluationResponse,
  useCompleteMissionRunMutation,
  useEvaluateMissionMutation,
  useMissionRunQuery,
} from "@/entities/mission-run";
import { MissionResultPanel } from "@/features/mission-reward";
import { restoreEvaluationResult } from "../model/evaluation-result";

export function MissionEvaluationPanel({
  runId,
  messages,
  onEvaluated,
  onCompleted,
  onRetake,
}: {
  runId: string;
  messages: MissionEvaluationMessage[];
  onEvaluated?: (result: MissionEvaluationResponse) => void;
  onCompleted?: (result: MissionCompletionResponse) => void;
  onRetake?: () => void;
}) {
  const runQuery = useMissionRunQuery(runId);
  const evaluate = useEvaluateMissionMutation();
  const complete = useCompleteMissionRunMutation();
  const [dismissedEvaluationId, setDismissedEvaluationId] = useState<string>();
  const restored = restoreEvaluationResult(runQuery.data);
  const result = restored ?? evaluate.data;
  const pending = evaluate.isPending || complete.isPending;

  async function confirmReward(evaluated: MissionEvaluationResponse) {
    if (!evaluated.evaluation.passed || !evaluated.rewardId) return;
    const completed = await complete.mutateAsync({
      runId,
      evaluationId: evaluated.evaluation.id,
      rewardId: evaluated.rewardId,
    });
    onCompleted?.(completed);
  }

  async function retryCompletion() {
    if (!result) return;
    try {
      await confirmReward(result);
    } catch {
      // Keep the persisted evaluation visible while the learner retries saving.
    }
  }

  async function handleEvaluate() {
    try {
      const evaluated = await evaluate.mutateAsync({ runId, messages });
      onEvaluated?.(evaluated);
      await confirmReward(evaluated);
    } catch {
      // Mutation state drives the retryable error panel below.
    }
  }

  if (result && result.evaluation.id !== dismissedEvaluationId) {
    const completion = runQuery.data?.completion ?? complete.data?.result;
    return <div className="space-y-3">
      <MissionResultPanel result={result} completion={completion} />
      {result.evaluation.passed && !completion ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p role={complete.error ? "alert" : "status"} className="text-sm">
          {complete.error ? "보상 저장에 실패했어요. 평가 결과는 보존되어 있으니 다시 시도해 주세요." : "평가는 통과했어요. 보상 저장을 확인해 주세요."}
        </p>
        <button type="button" disabled={pending} onClick={() => void (result.rewardId ? retryCompletion() : handleEvaluate())} className="mt-3 rounded-full bg-neutral-950 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
          {pending ? "보상 확정 중…" : "보상 저장 다시 시도"}
        </button>
      </div> : null}
      {!result.evaluation.passed ? <button type="button" onClick={() => { setDismissedEvaluationId(result.evaluation.id); evaluate.reset(); }} className="rounded-full border px-4 py-2 text-sm font-bold">대화 이어서 연습하기</button> : null}
      {completion && onRetake ? <button type="button" onClick={onRetake} className="rounded-full border px-4 py-2 text-sm font-bold">새 시도로 다시 도전</button> : null}
    </div>;
  }

  const run = runQuery.data;
  const required = run?.steps.filter((step) => step.required) ?? [];
  const completeCount = required.filter((step) => step.status === "completed").length;

  return (
    <section className="rounded-[1.5rem] border border-black/8 bg-white p-5" data-testid="mission-evaluation-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#5763d7]">Mission progress</p>
          <h2 className="mt-1 text-xl font-black">학습 목표 확인</h2>
          <p className="mt-1 text-xs text-neutral-500">필수 단계 {completeCount}/{required.length || "-"} · 대화 {messages.filter((message) => message.role === "user").length}턴</p>
          {run?.best ? <p className="mt-1 text-xs text-neutral-500">시도 {run.attemptNumber} · 최고 {run.best.score}점</p> : null}
        </div>
        <button
          type="button"
          onClick={() => void handleEvaluate()}
          disabled={pending || messages.length < 2}
          className="inline-flex items-center gap-2 rounded-full bg-[#5763d7] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          {evaluate.isPending ? "근거 평가 중…" : complete.isPending ? "보상 확정 중…" : "미션 마치고 평가받기"}
        </button>
      </div>
      {run ? (
        <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {run.steps.map((step) => (
            <li key={step.id} className="flex items-start gap-2 rounded-xl bg-neutral-50 p-3 text-xs">
              {step.status === "completed" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 size-4 shrink-0 text-neutral-300" />}
              <span><strong className="block text-neutral-800">{step.label}</strong><span className="text-neutral-400">{step.required ? "필수" : "선택"}</span></span>
            </li>
          ))}
        </ol>
      ) : null}
      {evaluate.error || complete.error ? (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
          <RotateCcw className="mt-0.5 size-4 shrink-0" />
          {evaluate.error?.message ?? complete.error?.message}
        </div>
      ) : null}
    </section>
  );
}
