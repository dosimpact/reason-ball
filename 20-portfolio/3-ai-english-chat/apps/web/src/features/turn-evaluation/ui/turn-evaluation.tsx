/** @jsxImportSource react */
"use client";

import { useEffect, useRef, useState } from "react";
import { ensureBrowserSession } from "@/shared/api/auth/browser-session";
import { requestTurnEvaluation } from "@/entities/mission-run/api/turn-evaluation";
import type { TurnEvaluationResponse } from "@/entities/mission-run/model/turn-evaluation";

type State = { pending: boolean; result?: TurnEvaluationResponse; error?: string };

export function TurnEvaluation({ conversationId, messageId, text, disabled }: {
  conversationId: string; messageId: string; text: string; disabled: boolean;
}) {
  const [state, setState] = useState<State>({ pending: false });
  const active = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => { active.current?.abort(); }, [conversationId, messageId, text]);

  async function evaluate() {
    if (disabled || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setState({ pending: true });
    try {
      await ensureBrowserSession();
      if (controller.signal.aborted) return;
      const result = await requestTurnEvaluation({ conversationId, messageId }, controller.signal);
      if (result.targetText !== text.trim()) throw new Error("원문이 바뀌었어요. 대화를 다시 불러온 뒤 평가해 주세요.");
      if (!controller.signal.aborted) setState({ pending: false, result });
    } catch (error) {
      if (!controller.signal.aborted) setState({ pending: false, error: error instanceof Error ? error.message : "발화를 평가하지 못했어요." });
    } finally {
      if (active.current === controller) active.current = undefined;
    }
  }

  return <div className="mt-3 border-t border-indigo-100 pt-3" data-testid="turn-evaluation">
    <button type="button" disabled={disabled || state.pending} onClick={() => void evaluate()} className="rounded-lg border px-2 py-1.5 font-bold disabled:opacity-40">이 발화 평가</button>
    <p className="mt-2 text-neutral-500">선택한 발화까지의 대화로 학습 피드백을 받아요. 미션 진행이나 보상은 바뀌지 않아요.</p>
    {state.pending ? <p role="status" className="mt-2">발화를 평가하고 있어요…</p> : null}
    {state.error ? <div role="alert" className="mt-2 text-red-700"><p>{state.error}</p><p>원문과 입력창은 유지됩니다.</p><button type="button" disabled={disabled || state.pending} onClick={() => void evaluate()} className="mt-2 underline">발화 평가 다시 시도</button></div> : null}
    {state.result ? <section className="mt-3 space-y-3" data-testid="turn-evaluation-result">
      <h4 className="font-black">이 발화의 학습 피드백</h4>
      <p>학습 지원용이며 공인 시험 점수가 아니에요. 임시 결과이므로 새로고침 후 다시 요청할 수 있어요.</p>
      {state.result.axes.map(axis => <article key={axis.key} className="rounded-xl bg-indigo-50 p-3" data-testid={`turn-evaluation-axis-${axis.key}`}>
        <div className="flex justify-between gap-2"><h5 className="font-bold">{axis.label}</h5><span>{axis.score}</span></div>
        <p className="mt-2 leading-5" data-testid="turn-evaluation-axis-feedback">{axis.feedback}</p>
        {axis.evidence.map(item => <blockquote key={item.messageId} className="mt-2 border-l-2 border-indigo-200 pl-2"><p lang="en">{item.quote}</p><footer className="mt-1 text-neutral-600">{item.rationale}</footer></blockquote>)}
      </article>)}
    </section> : null}
  </div>;
}
