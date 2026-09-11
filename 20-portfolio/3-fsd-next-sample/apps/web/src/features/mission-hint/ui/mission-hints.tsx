/** @jsxImportSource react */
"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { missionHintSchema, type MissionHint, type MissionHintDepth } from "@/entities/mission-run/model/mission-hint";
import { createUuid } from "@/shared/lib/uuid";

const depths = [1, 2, 3] as const;
const labels: Record<MissionHintDepth, string> = { 1: "1. 의도 힌트", 2: "2. 핵심 표현", 3: "3. 완성 문장" };

async function readResponse(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? "힌트를 불러오지 못했어요. 다시 시도해 주세요.");
  if (!body) throw new Error("힌트 응답을 읽지 못했어요.");
  return body;
}

export function MissionHints({ runId, stepId, disabled, onInsert }: {
  runId: string;
  stepId: string;
  disabled: boolean;
  onInsert: (text: string) => void;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["mission-hints", runId];
  const history = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const body = await readResponse(await fetch(`/api/mission-runs/${encodeURIComponent(runId)}/hints`, { signal, cache: "no-store" }));
      const items = z.array(missionHintSchema).parse(body.items);
      if (items.some(item => item.runId !== runId)) throw new Error("다른 실행의 힌트가 응답에 포함되어 있어요.");
      return items;
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const [selectedDepth, setSelectedDepth] = useState<MissionHintDepth>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const attempt = useRef<{ requestId: string; depth: MissionHintDepth } | undefined>(undefined);
  const request = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => { request.current?.abort(); }, []);

  const saved = new Map<MissionHintDepth, MissionHint>();
  for (const hint of [...(history.data ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))) {
    if (hint.stepId === stepId) saved.set(hint.depth, hint);
  }
  const depth = selectedDepth ?? depths.findLast(candidate => saved.has(candidate)) ?? 1;
  const visible = saved.get(depth);

  async function reveal(nextDepth: MissionHintDepth) {
    if (disabled || request.current || history.isFetching || history.isPending || history.isError) return;
    setSelectedDepth(nextDepth);
    if (saved.has(nextDepth)) { setError(undefined); return; }
    if (nextDepth > 1 && !saved.has((nextDepth - 1) as MissionHintDepth)) return;
    const previous = attempt.current;
    const pending = previous && previous.depth === nextDepth ? previous : { requestId: createUuid(), depth: nextDepth };
    attempt.current = pending;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(undefined);
    try {
      const body = await readResponse(await fetch(`/api/mission-runs/${encodeURIComponent(runId)}/hints`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ requestId: pending.requestId, stepId, depth: nextDepth }),
      }));
      const hint = missionHintSchema.parse(body.hint);
      if (hint.id !== pending.requestId || hint.runId !== runId || hint.stepId !== stepId || hint.depth !== nextDepth) throw new Error("요청한 단계의 힌트를 확인하지 못했어요.");
      if (controller.signal.aborted) return;
      queryClient.setQueryData<MissionHint[]>(queryKey, current => [...(current ?? []).filter(item => item.id !== hint.id), hint]);
      attempt.current = undefined;
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "힌트를 준비하지 못했어요.");
    } finally {
      if (!controller.signal.aborted) { request.current = undefined; setBusy(false); }
    }
  }

  return <div data-testid="mission-hint-depths" className="space-y-3 rounded-xl bg-white p-3">
    <p className="font-bold">필요한 만큼 단계적으로 도움받기</p>
    <div className="flex flex-wrap gap-2" aria-label="힌트 깊이">{depths.map(candidate => <button key={candidate} type="button" aria-pressed={depth === candidate && Boolean(visible)} disabled={disabled || busy || history.isFetching || history.isPending || history.isError || (candidate > 1 && !saved.has((candidate - 1) as MissionHintDepth))} onClick={() => void reveal(candidate)} className="rounded-lg border border-indigo-200 px-3 py-2 font-bold text-indigo-800 disabled:opacity-40">{labels[candidate]}</button>)}</div>
    {history.isFetching || history.isPending ? <p role="status">저장된 힌트를 확인하고 있어요.</p> : null}
    {history.isError ? <div role="alert"><p>{history.error.message}</p><button type="button" onClick={() => void history.refetch()} className="mt-1 underline">저장된 힌트 다시 불러오기</button></div> : null}
    {busy ? <p role="status">선택한 단계의 힌트를 준비하고 있어요.</p> : null}
    {error ? <div role="alert"><p>{error}</p><button type="button" disabled={disabled || busy} onClick={() => attempt.current && void reveal(attempt.current.depth)} className="mt-1 underline">힌트 요청 다시 시도</button></div> : null}
    {visible && !history.isError ? <div className="space-y-2" data-depth={visible.depth}>
      <p className="font-bold">{labels[visible.depth]}</p>
      <p lang={visible.depth === 1 ? "ko" : "en"} data-testid="mission-hint-text" className="whitespace-pre-wrap break-words text-sm">{visible.result.text}</p>
      <p lang="ko" data-testid="mission-hint-explanation" className="whitespace-pre-wrap text-neutral-600">{visible.result.explanation}</p>
      {visible.depth > 1 ? <button type="button" disabled={disabled || busy} onClick={() => onInsert(visible.result.text)} className="rounded-lg bg-indigo-700 px-3 py-2 font-bold text-white disabled:opacity-40">이 힌트를 입력창에 덧붙이기</button> : null}
      <p className="text-neutral-500">AI가 이 실행의 대화 문맥으로 만든 학습 예시예요.</p>
    </div> : null}
    <p className="text-neutral-600">성공한 힌트 요청을 이 시도에 기록합니다. 힌트를 사용해도 점수와 보상이 줄어들지 않아요. 문장 전송은 직접 결정해 주세요.</p>
  </div>;
}
