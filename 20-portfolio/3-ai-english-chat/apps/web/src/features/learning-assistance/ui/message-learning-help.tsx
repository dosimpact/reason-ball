/** @jsxImportSource react */
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useUiMessages } from "@/shared/i18n/ui-messages-provider";
import { LearningHelpResult } from "./learning-help-result";
import { requestAssistance } from "@/entities/learning-assistance/api/client";
import type { AssistanceRequest, AssistanceResponse } from "@/entities/learning-assistance/model/assistance";
import { ensureBrowserSession } from "@/shared/api/auth/browser-session";

type HelpState = { text: string; request: AssistanceRequest; pending: boolean; result?: AssistanceResponse; error?: string };

export function MessageLearningHelp({ text, role, disabled, makeRequest, onUse, children }: {
  text: string;
  role: "user" | "assistant";
  disabled: boolean;
  makeRequest: (mode: AssistanceRequest["mode"]) => AssistanceRequest;
  onUse: (suggestion: string) => void;
  children?: ReactNode;
}) {
  const { learningHelp: copy, languageTag } = useUiMessages();
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
      if (result.targetText !== text.trim()) throw new Error(copy.changedMessage);
      if (!controller.signal.aborted) setState({ text, request, pending: false, result });
    } catch (error) {
      if (!controller.signal.aborted) setState({ text, request, pending: false, error: error instanceof Error ? error.message : copy.failed });
    }
  }

  function start(mode: AssistanceRequest["mode"]) {
    setInputError(undefined);
    try { void run(makeRequest(mode)); }
    catch { setInputError(copy.invalidInput); }
  }

  return <details lang={languageTag} className="mt-2 w-full rounded-xl border border-indigo-100 bg-white p-2 text-left text-xs" data-testid="message-learning-help">
    <summary className="cursor-pointer font-bold text-indigo-700">{copy.title}</summary>
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" disabled={disabled || visible?.pending} onClick={() => start("rephrase")} className="rounded-lg border px-2 py-1.5 disabled:opacity-40">{copy.rephrase}</button>
      <button type="button" disabled={disabled || visible?.pending} onClick={() => start(role === "user" ? "correction" : "reply")} className="rounded-lg border px-2 py-1.5 disabled:opacity-40">{role === "user" ? copy.correction : copy.reply}</button>
    </div>
    {inputError ? <p role="alert" className="mt-2 text-red-700">{inputError}</p> : null}
    {visible?.pending ? <p role="status" className="mt-2">{copy.loading}</p> : null}
    {visible?.error ? <div role="alert" className="mt-2 text-red-700"><p>{visible.error}</p><p>{copy.preserved}</p><button type="button" disabled={disabled} onClick={() => void run(visible.request)} className="mt-2 underline">{copy.retry}</button></div> : null}
    {visible?.result ? <LearningHelpResult response={visible.result} disabled={disabled} onUse={onUse} /> : null}
    {children}
  </details>;
}
