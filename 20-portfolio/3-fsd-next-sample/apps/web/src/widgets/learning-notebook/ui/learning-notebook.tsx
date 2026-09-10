"use client";

import { useState } from "react";
import { useLearningNotebook } from "@/entities/learning-notebook/api/use-notebook";
import { AudioPlaybackButton } from "@/features/audio-playback";

const labels = { expression: "표현", word: "단어", correction: "교정" } as const;
export function LearningNotebook() {
  const query = useLearningNotebook();
  const [filter, setFilter] = useState("all");
  if (query.isError) return <section role="alert" className="mt-8 rounded-xl border p-6"><p>복습 기록을 불러오지 못했어요. 기존 기록을 지우지 않았습니다.</p><button onClick={() => void query.refetch()} className="mt-3 underline">복습 기록 다시 불러오기</button></section>;
  if (!query.data) return <p role="status" className="mt-8">복습 기록을 불러오고 있어요.</p>;
  const entries = query.data.entries.filter((entry) => filter === "all" || entry.draft.kind === filter).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  return <section className="mt-8 space-y-4" data-testid="profile-expressions">
    <h2 className="text-2xl font-black">내가 저장한 표현과 교정</h2>
    <p className="text-sm text-neutral-500">대화에서 직접 저장한 개인 복습 기록입니다. 같은 표현의 중복 메모는 기존 기록을 유지합니다.</p>
    <label className="block text-sm">복습 기록 필터<select value={filter} onChange={(event) => setFilter(event.target.value)} className="ml-3 rounded-lg border p-2"><option value="all">전체</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {!entries.length ? <p className="rounded-xl border border-dashed p-8 text-center">{query.data.entries.length ? "이 종류로 저장한 기록이 없어요." : "저장한 표현이 없어요. 대화 메시지의 복습 기록 저장 버튼을 눌러 보세요."}</p> : null}
    <div className="grid gap-4 md:grid-cols-2">{entries.map((entry) => <article key={entry.id} className="min-w-0 rounded-2xl border bg-white p-5">
      <span className="text-xs font-bold text-indigo-700">{labels[entry.draft.kind]}</span>
      {entry.draft.originalText ? <p className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-500">교정 전: {entry.draft.originalText}</p> : null}
      <p className="mt-2 whitespace-pre-wrap break-words font-bold">{entry.draft.text}</p>
      {entry.draft.meaning ? <p className="mt-2 whitespace-pre-wrap break-words text-sm">{entry.draft.meaning}</p> : null}
      <p className="my-3 text-xs text-neutral-500">저장일 {entry.createdAt.slice(0, 10)} · UTC</p>
      <AudioPlaybackButton playbackId={`notebook-${entry.id}`} text={entry.draft.text} compact />
    </article>)}</div>
  </section>;
}
