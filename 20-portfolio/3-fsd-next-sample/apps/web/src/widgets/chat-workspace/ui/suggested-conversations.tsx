/** @jsxImportSource react */
"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createDraftStorage, httpChatRepository, mockChatRepository, usesRemoteChatData, type CreateConversationInput } from "@/entities/chat";
import { ensureBrowserSession } from "@/shared/api/auth/browser-session";
import { learningQueryKeys } from "@/shared/api/learning";
import { createUuid } from "@/shared/lib/uuid";
import { conversationUrl } from "../model/conversation-url";

const pendingSchema = z.object({
  version: z.literal(1), id: z.uuid(), text: z.string().trim().min(1).max(4000), characterId: z.string().min(1).max(200),
  // Legacy records may already have an edited or deliberately cleared draft.
  // Treat an absent marker as prepared rather than overwrite unknown user work.
  draftPrepared: z.boolean().default(true),
}).strict();
type PendingConversation = z.infer<typeof pendingSchema>;

export function SuggestedConversations({ context, prompts, ownerId, sourceConversationId, disabled }: {
  context: CreateConversationInput;
  prompts: readonly string[];
  ownerId?: string;
  sourceConversationId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pending = useRef<PendingConversation | undefined>(undefined);
  const lifecycle = useRef(0);
  const [ready, setReady] = useState(false);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const storageKey = ownerId ? `lingua:suggested-conversation:v1:${ownerId}:${sourceConversationId}` : undefined;
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const epoch = ++lifecycle.current;
    queueMicrotask(() => {
      if (epoch !== lifecycle.current) return;
      pending.current = undefined;
      running.current = false;
      setBusy(false);
      setError(undefined);
      try {
        if (usesRemoteChatData()) {
          if (!storageKey) throw new Error("계정을 확인하지 못했어요. 페이지를 새로고침해 주세요.");
          const raw = window.localStorage.getItem(storageKey);
          if (raw !== null) {
            const stored = pendingSchema.parse(JSON.parse(raw));
            if (stored.characterId !== context.characterId || stored.id === sourceConversationId) throw new Error("Invalid pending conversation");
            pending.current = stored;
            setError("이전에 시작한 추천 대화가 있어요. 다시 시도하면 같은 대화를 이어서 엽니다.");
          }
        }
        setReady(true);
      } catch {
        setReady(false);
        setError("추천 대화의 복구 기록을 읽지 못했어요. 브라우저 저장소 설정을 확인한 뒤 다시 불러와 주세요.");
      }
    });
    return () => { lifecycle.current += 1; };
  }, [storageKey, sourceConversationId, context.characterId, restoreAttempt]);

  async function start(text: string) {
    if (running.current || disabled || !ready) return;
    const epoch = lifecycle.current;
    const isCurrent = () => epoch === lifecycle.current;
    running.current = true;
    setBusy(true);
    setError(undefined);
    let attempt = pending.current ?? { version: 1 as const, id: createUuid(), text, characterId: context.characterId, draftPrepared: false };
    pending.current = attempt;
    try {
      let id: string;
      if (usesRemoteChatData()) {
        const user = await ensureBrowserSession();
        if (!isCurrent()) return;
        if (user.id !== ownerId) throw new Error("계정이 변경됐어요. 페이지를 새로고침해 주세요.");
        // Prepare the new draft once, before POST. A replay must preserve later
        // edits, including an intentionally empty draft opened through history.
        if (!storageKey) throw new Error("추천 대화 복구 기록을 저장할 수 없어요.");
        window.localStorage.setItem(storageKey, JSON.stringify(pendingSchema.parse(attempt)));
        if (!attempt.draftPrepared) {
          createDraftStorage(window.localStorage).write(user.id, attempt.id, attempt.text);
          attempt = { ...attempt, draftPrepared: true };
          pending.current = attempt;
          // Persist before POST: any committed row is always paired with this marker.
          window.localStorage.setItem(storageKey, JSON.stringify(pendingSchema.parse(attempt)));
        }
        const created = await httpChatRepository.createConversation(context, attempt.id);
        id = created.id;
      } else {
        const created = mockChatRepository.createConversation(context);
        mockChatRepository.updateConversation(created.id, { draft: attempt.text });
        id = created.id;
      }
      if (!isCurrent()) return;
      if (usesRemoteChatData() && storageKey) window.localStorage.removeItem(storageKey);
      void queryClient.invalidateQueries({ queryKey: learningQueryKeys.snapshot() });
      router.push(conversationUrl({ characterId: context.characterId, conversationId: id }));
      // Keep the single-flight guard until navigation unmounts this component.
    } catch (cause) {
      if (!isCurrent()) return;
      setError(cause instanceof Error ? cause.message : "추천 질문으로 대화를 시작하지 못했어요.");
      running.current = false;
      setBusy(false);
    }
  }

  return <section aria-label="추천 질문으로 새 대화" className="border-b border-black/6 px-4 py-3 text-xs">
    <p className="mb-2 font-bold">추천 질문으로 새 대화 시작</p>
    <div className="flex gap-2 overflow-x-auto">{prompts.map((text) => <button key={text} type="button" disabled={disabled || !ready || busy || Boolean(error)} onClick={() => void start(text)} className="shrink-0 rounded-xl border px-3 py-2 text-left disabled:opacity-40">{text}</button>)}</div>
    <p className="mt-2 text-neutral-500">새 대화의 입력창에 질문을 준비해요. 확인한 뒤 보내 주세요.</p>
    {!ready && !error ? <p role="status">추천 대화 복구 기록을 확인하고 있어요.</p> : null}
    {busy ? <p role="status">추천 질문으로 새 대화를 준비하고 있어요.</p> : null}
    {error ? <div role="alert" className="mt-2 text-red-700"><p>{error}</p>{ready ? <button type="button" disabled={disabled || busy} onClick={() => pending.current && void start(pending.current.text)} className="mt-1 underline">추천 대화 시작 다시 시도</button> : <button type="button" disabled={busy} onClick={() => setRestoreAttempt((value) => value + 1)} className="mt-1 underline">추천 대화 복구 기록 다시 불러오기</button>}</div> : null}
  </section>;
}
