"use client";

import { useEffect, useRef, useState } from "react";
import { requestAssistance } from "@/entities/learning-assistance/api/client";
import type { AssistanceRequest, AssistanceResponse } from "@/entities/learning-assistance/model/assistance";
import { ensureBrowserSession } from "@/shared/api/auth/browser-session";

type HelpState = { text: string; request: AssistanceRequest; pending: boolean; result?: AssistanceResponse; error?: string };

export function MessageLearningHelp({ text, role, disabled, makeRequest, onUse }: {
  text: string;
  role: "user" | "assistant";
  disabled: boolean;
  makeRequest: (mode: AssistanceRequest["mode"]) => AssistanceRequest;
  onUse: (suggestion: string) => void;
}) {
  const [state, setState] = useState<HelpState>();
  const [inputError, setInputError] = useState<string>();
  const active = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => { active.current?.abort(); }, [text]);
  const visible = state?.text === text ? state : undefined;

  async function run(request: AssistanceRequest) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setState({ text, request, pending: true });
    try {
      if (!request.demo) await ensureBrowserSession();
      if (controller.signal.aborted) return;
      const result = await requestAssistance(request, controller.signal);
      if (result.targetText !== text.trim()) throw new Error("메시지가 변경됐어요. 대화를 다시 불러온 후 요청해 주세요.");
      if (!controller.signal.aborted) setState({ text, request, pending: false, result });
    } catch (error) {
      if (!controller.signal.aborted) setState({ text, request, pending: false, error: error instanceof Error ? error.message : "학습 도움말을 가져오지 못했어요." });
    }
  }

  function start(mode: AssistanceRequest["mode"]) {
    setInputError(undefined);
    try { void run(makeRequest(mode)); }
    catch { setInputError("학습 설정이나 메시지를 읽지 못했어요. 기존 데이터를 초기화하지 않았습니다. 확인 후 다시 요청해 주세요."); }
  }

  return <details className="mt-2 w-full rounded-xl border border-indigo-100 bg-white p-2 text-left text-xs" data-testid="message-learning-help">
    <summary className="cursor-pointer font-bold text-indigo-700">학습 도움</summary>
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" disabled={disabled || visible?.pending} onClick={() => start("rephrase")} className="rounded-lg border px-2 py-1.5 disabled:opacity-40">쉽게 바꾸기</button>
      <button type="button" disabled={disabled || visible?.pending} onClick={() => start(role === "user" ? "correction" : "reply")} className="rounded-lg border px-2 py-1.5 disabled:opacity-40">{role === "user" ? "문장 교정" : "답변 추천"}</button>
    </div>
    {inputError ? <p role="alert" className="mt-2 text-red-700">{inputError}</p> : null}
    {visible?.pending ? <p role="status" className="mt-2">학습 도움말을 만들고 있어요…</p> : null}
    {visible?.error ? <div role="alert" className="mt-2 text-red-700"><p>{visible.error}</p><p>원래 메시지와 입력창은 유지됩니다.</p><button type="button" disabled={disabled} onClick={() => void run(visible.request)} className="mt-2 underline">학습 도움 다시 시도</button></div> : null}
    {visible?.result ? <div className="mt-3 space-y-2" data-testid="learning-help-result">
      <p className="font-bold">{visible.result.result.brief}</p>
      <p className="whitespace-pre-wrap break-words text-sm">{visible.result.result.suggestion}</p>
      <details><summary className="cursor-pointer underline">자세한 설명</summary><p className="mt-2 whitespace-pre-wrap break-words">{visible.result.result.explanation}</p></details>
      <button type="button" disabled={disabled} onClick={() => onUse(visible.result!.result.suggestion)} className="rounded-lg bg-indigo-700 px-3 py-2 font-bold text-white disabled:opacity-40">도움 문장을 입력창에 덧붙이기</button>
      <p className="text-neutral-500">{visible.result.source === "mock" ? "데모 예시" : "AI 생성 도움말"} · 원문을 바꾸지 않으며 대화 기록에는 저장되지 않습니다. 새로고침 후 다시 요청할 수 있어요.</p>
    </div> : null}
  </details>;
}
