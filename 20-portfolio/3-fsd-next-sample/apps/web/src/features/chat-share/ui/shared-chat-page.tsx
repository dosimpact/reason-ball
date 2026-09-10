"use client";

import { LockKeyhole, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getSharedConversation, MessageContent } from "@/entities/chat";

export function SharedChatPage({ token }: { token: string }) {
  const query = useQuery({ queryKey: ["shared-conversation", token], queryFn: () => getSharedConversation(token), retry: false, staleTime: 0 });
  const conversation = query.data;

  if (query.isPending) return <main className="mx-auto max-w-3xl px-5 py-20 text-center" role="status">공유 대화를 불러오고 있어요.</main>;
  if (query.error) return <main className="mx-auto max-w-3xl px-5 py-20 text-center"><p role="alert">{query.error.message}</p><button type="button" onClick={() => void query.refetch()} className="mt-5 rounded-full border px-5 py-3 font-bold">공유 대화 다시 불러오기</button></main>;
  if (!conversation) return <main className="mx-auto max-w-3xl px-5 py-20 text-center"><h1 className="text-3xl font-black">공유 대화를 찾을 수 없어요.</h1><p className="mt-3 text-neutral-500">링크가 만료되었거나 공유가 취소된 대화예요.</p><Link href="/" className="mt-6 inline-flex rounded-full bg-neutral-950 px-5 py-3 text-sm font-bold text-white">Lingua 홈</Link></main>;

  return <main className="min-h-screen bg-[#f7f4ef] px-4 py-10" data-testid="shared-chat-page"><div className="mx-auto max-w-3xl overflow-hidden rounded-[1.7rem] border border-black/8 bg-white shadow-sm"><header className="border-b border-black/8 px-5 py-5 sm:px-8"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#5763d7]"><LockKeyhole className="size-3.5" /> Read-only conversation</div><h1 className="mt-2 text-2xl font-black">{conversation.title}</h1><p className="mt-1 text-sm text-neutral-500">{conversation.characterName} · {conversation.missionTitle ?? "자유 대화"}</p></header><section className="space-y-5 px-5 py-7 sm:px-8" aria-label="공유된 메시지">{conversation.messages.map((message) => <article key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-tr-sm bg-[#5763d7] text-white" : "rounded-tl-sm bg-[#f1eee8]"}`}><MessageContent message={message} allowPrivateFiles={false} /></div></article>)}</section><footer className="flex items-center justify-between border-t border-black/8 px-5 py-4 text-xs text-neutral-500 sm:px-8"><span className="inline-flex items-center gap-2"><MessageCircle className="size-3.5" /> 이 화면은 읽기 전용이에요.</span><Link href={`/chat/${conversation.characterId}${conversation.missionId ? `?mission=${conversation.missionId}` : ""}`} className="font-bold text-[#5763d7]">내 대화 시작</Link></footer></div></main>;
}
