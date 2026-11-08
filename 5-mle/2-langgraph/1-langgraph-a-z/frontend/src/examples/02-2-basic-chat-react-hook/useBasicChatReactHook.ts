import { find } from "remeda";
import { useStream } from "@langchain/langgraph-sdk/react";
import { useMemo } from "react";
import {
  ChatMessageRecord,
  langGraphApiUrl,
  normalizeMessages,
} from "../../lib/langgraphClient";
import { BasicChatState } from "./data";
import { useBasicChatReactHookState } from "./useBasicChatReactHookState";

export function useBasicChatReactHook() {
  const {
    conversations,
    setConversations,
    threadId,
    setThreadId,
    input,
    setInput,
    status,
    setStatus,
    events,
    setEvents,
    addEvent,
  } = useBasicChatReactHookState();

  function rememberThread(nextThreadId: string) {
    setThreadId(nextThreadId);
    setConversations((current) => {
      if (find(current, (conversation) => conversation.id === nextThreadId))
        return current;
      return [
        {
          id: nextThreadId,
          title: current.length === 0 ? "Memory check" : "New conversation",
          createdAt: new Date().toLocaleTimeString(),
        },
        ...current,
      ];
    });
  }

  const stream = useStream<BasicChatState>({
    apiUrl: langGraphApiUrl,
    assistantId: "02_basic_chat",
    threadId,
    onThreadId: rememberThread,
    onCreated(run) {
      setStatus("Run created");
      addEvent("created", run, run.run_id);
    },
    onMetadataEvent(data) {
      addEvent("metadata", data, data.run_id);
    },
    onUpdateEvent(data) {
      setStatus("Streaming: updates");
      addEvent("updates", data);
    },
    onFinish(state, run) {
      setStatus("Run complete");
      addEvent("finish", state.values, run?.run_id);
    },
    onError(error, run) {
      setStatus("Run failed");
      addEvent("error", error, run?.run_id);
    },
  });

  const messages = useMemo<ChatMessageRecord[]>(
    () => normalizeMessages({ values: stream.values }),
    [stream.values],
  );

  const busy = stream.isLoading;

  function startConversation() {
    stream.switchThread(null);
    setThreadId(null);
    setEvents([]);
    setStatus("New conversation ready");
  }

  function selectConversation(id: string) {
    stream.switchThread(id);
    setThreadId(id);
    setEvents([]);
    setStatus("Conversation selected");
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed) return;

    setInput("");
    setEvents([]);
    setStatus("Submitting with useStream");
    await stream.submit(
      {
        messages: [{ type: "human", content: trimmed }],
      },
      {
        streamMode: ["updates"],
      },
    );
  }
  return {
    conversations,
    threadId,
    input,
    setInput,
    status,
    events,
    stream,
    messages,
    busy,
    startConversation,
    selectConversation,
    sendMessage,
  };
}
