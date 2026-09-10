"use client";

import { ChevronDown, Clock3, MessageCircle, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { messageText, mockChatRepository, usesRemoteChatData, type ChatConversation } from "@/entities/chat";
import { CharacterAvatar, useCharactersQuery } from "@/entities/character";
import { useLearningSnapshotQuery } from "@/entities/learning-session";

const PAGE_SIZE = 4;
const GROUPS = ["오늘", "어제", "이전"] as const;

function daysAgo(value: string, referenceTime: number) {
  const date = new Date(value);
  const now = new Date(referenceTime);
  if (Number.isNaN(date.getTime())) return 0;
  date.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((now.getTime() - date.getTime()) / 86_400_000));
}

function relativeDate(value: string, referenceTime: number) {
  const days = daysAgo(value, referenceTime);
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  return `${days}일 전`;
}

function dateGroup(value: string, referenceTime: number): (typeof GROUPS)[number] {
  const days = daysAgo(value, referenceTime);
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  return "이전";
}

export default function HistoryPage() {
  const { data: characters = [] } = useCharactersQuery();
  const learningQuery = useLearningSnapshotQuery();
  const { data: learning } = learningQuery;
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [deletedConversationIds, setDeletedConversationIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [referenceTime] = useState(() => usesRemoteChatData() ? Date.now() : Date.parse("2026-09-05T12:00:00.000Z"));

  useEffect(() => {
    if (usesRemoteChatData()) return;
    const refresh = () => {
      setConversations(mockChatRepository.listConversations());
      setDeletedConversationIds(mockChatRepository.listDeletedConversationIds());
    };
    refresh();
    return mockChatRepository.subscribe(refresh);
  }, []);

  const histories = useMemo(() => {
    const conversationIds = new Set(conversations.map((conversation) => conversation.id));
    const deletedIds = new Set(deletedConversationIds);
    const persisted = conversations.filter((conversation) => conversation.messages.some((message) => message.role === "user") || Boolean(conversation.draft) || conversation.artifacts.length > 0).map((conversation) => ({
      characterId: conversation.characterId,
      conversationId: conversation.id,
      id: conversation.id,
      lastActiveAt: conversation.updatedAt,
      missionId: conversation.missionId,
      preview: messageText(conversation.messages.at(-1) ?? conversation.messages[0]).slice(0, 100) || "첨부 파일이 있는 대화",
      title: conversation.title,
      turnCount: conversation.messages.length,
    }));
    const seeded = (learning?.histories ?? []).filter((history) => !conversationIds.has(history.id) && !deletedIds.has(history.id)).map((history) => ({ ...history, conversationId: usesRemoteChatData() ? history.conversationId ?? history.id : undefined }));
    return [...persisted, ...seeded].sort((left, right) => right.lastActiveAt.localeCompare(left.lastActiveAt));
  }, [conversations, deletedConversationIds, learning?.histories]);

  const filtered = useMemo(
    () =>
      histories.filter((history) =>
        `${history.title} ${history.preview}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [histories, query],
  );
  const visible = filtered.slice(0, visibleCount);
  const grouped = useMemo(() => GROUPS.map((label) => ({ label, items: visible.filter((history) => dateGroup(history.lastActiveAt, referenceTime) === label) })).filter((group) => group.items.length), [visible, referenceTime]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 pb-28 sm:px-8 lg:px-12 lg:py-16" data-testid="history-page">
      <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[#5763d7]"><Sparkles className="size-3.5" /> Conversation history</p><h1 className="mt-3 text-4xl font-black tracking-[-.045em] sm:text-6xl">말할수록 쌓이는 나의 영어</h1><p className="mt-4 max-w-2xl leading-7 text-neutral-600">지난 대화의 마지막 문장부터 다시 시작하거나, 다른 미션에서 같은 표현을 연습해 보세요.</p></div>
      <label className="relative mt-9 block"><span className="sr-only">대화 기록 검색</span><Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-neutral-400" /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="캐릭터, 미션, 지난 문장 검색" className="h-13 w-full rounded-2xl border border-black/8 bg-white pl-11 pr-4 text-sm outline-none ring-[#5763d7]/30 focus:ring-3" /></label>
      <div className="mt-7 space-y-8">{grouped.map((group) => <section key={group.label} aria-labelledby={`history-group-${group.label}`} data-testid={`history-group-${group.label}`}><h2 id={`history-group-${group.label}`} className="mb-3 text-sm font-black text-neutral-500">{group.label}</h2><div className="space-y-3">{group.items.map((history) => { const character = characters.find((item) => item.id === history.characterId); const queryItems = [history.missionId ? `mission=${encodeURIComponent(history.missionId)}` : "", history.conversationId ? `conversation=${encodeURIComponent(history.conversationId)}` : ""].filter(Boolean); const href = `/chat/${encodeURIComponent(history.characterId)}${queryItems.length ? `?${queryItems.join("&")}` : ""}`; return <article key={history.id} className="group flex flex-col gap-4 rounded-[1.4rem] border border-black/6 bg-white p-4 transition hover:border-black/15 sm:flex-row sm:items-center" data-testid={history.conversationId ? "persisted-history" : "seeded-history"}><CharacterAvatar character={character ?? { name: "대화", emoji: "💬", palette: ["#e5e7eb", "#f3f4f6"] }} size="md" className="rounded-2xl" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{history.title}</h3><span className="rounded-full bg-[#f7f4ef] px-2 py-1 text-[10px] font-bold text-neutral-400">{history.turnCount} turns</span>{history.conversationId ? <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600">저장됨</span> : null}</div><p className="mt-2 truncate text-sm text-neutral-500">“{history.preview}”</p><p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-neutral-400"><Clock3 className="size-3" /> {relativeDate(history.lastActiveAt, referenceTime)}</p></div><Link href={href} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-neutral-950 px-5 py-3 text-xs font-bold text-white transition group-hover:bg-[#5763d7]"><MessageCircle className="size-3.5" /> 이어서 대화</Link></article>; })}</div></section>)}</div>
      {visibleCount < filtered.length ? <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className="mx-auto mt-7 flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-xs font-bold" data-testid="history-load-more">더 보기 <ChevronDown className="size-3.5" /></button> : null}
      {learningQuery.isPending ? <p className="mt-6" role="status">대화 기록을 불러오고 있어요.</p> : null}
      {learningQuery.error ? <div className="mt-6 rounded-2xl border border-red-200 p-5"><p role="alert">대화 기록을 불러오지 못했어요.</p><button type="button" onClick={() => void learningQuery.refetch()} className="mt-3 rounded-full border px-4 py-2 font-bold">대화 기록 다시 불러오기</button></div> : null}
      {!learningQuery.isPending && !learningQuery.error && filtered.length === 0 ? <div className="mt-6 rounded-[1.5rem] border border-dashed py-20 text-center"><p className="font-bold">검색한 대화 기록이 없어요.</p></div> : null}
      <div className="mt-8 rounded-2xl bg-[#fff1ec] p-5 text-sm leading-6 text-neutral-600"><strong className="text-neutral-950">개인정보 안내</strong><br />대화 기록은 학습 연속성을 위해 저장됩니다. 프로필 설정에서 기록 보관과 모델 개선 제공 여부를 각각 관리할 수 있어요.</div>
    </div>
  );
}
