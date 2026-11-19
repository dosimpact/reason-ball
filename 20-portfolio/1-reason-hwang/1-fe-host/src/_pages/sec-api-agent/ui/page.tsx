"use client";

import { agUIAdapter, fetchLLM, useThread, useThreadList } from "@openuidev/react-ui";
import { AgentChatFrame } from "@/shared/ui/agent-conversation";
import { useEffect, useState } from "react";
import { createSessionStorage } from "../model/session-storage";
import { secApiAgentStarterGroups } from "../model/starters";
import { library, runLibraryAction } from "@/shared/ui/intelligent-ui";

const llm = fetchLLM({ url: "/api/sec-api-agent", streamAdapter: agUIAdapter() });

function SaveMessages({ session }: { session: ReturnType<typeof createSessionStorage> }) {
  const messages = useThread((state) => state.messages);
  const loading = useThread((state) => state.isLoadingMessages);
  const threadId = useThreadList((state) => state.selectedThreadId);
  useEffect(() => {
    if (threadId && !loading && messages.length) session.save(threadId, messages);
  }, [threadId, messages, loading, session]);
  return null;
}

export default function SecApiAgentPage() {
  const [session] = useState(createSessionStorage);
  return <AgentChatFrame title="SEC API Agent" llm={llm} storage={session.storage}
    componentLibrary={library} onAction={event => { void runLibraryAction(event); }}
    starterGroups={secApiAgentStarterGroups} history welcomeTitle="SEC 데이터로 무엇을 할까요?"
    description="기업과 공시를 찾고, 원문을 분석하거나 데이터를 수집하세요."
    placeholder="메시지를 입력하세요">
    <SaveMessages session={session} />
  </AgentChatFrame>;
}
