import { filter } from "remeda";
import { useMemo } from "react";
import {
  ChatMessageRecord,
  createClientId,
  createLangGraphClient,
  extractLatestMessageText,
  normalizeMessages,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { Conversation } from "./data";
import { useBasicChatState } from "./useBasicChatState";

export function useBasicChat() {
  const {
    prepareSendMessage,
    conversations,
    setConversations,
    threadId,
    setThreadId,
    messages,
    setMessages,
    input,
    setInput,
    status,
    setStatus,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
  } = useBasicChatState();

  const client = useMemo(() => createLangGraphClient(), []);

  async function createConversation(title = "New conversation") {
    setBusy(true);
    setError("");
    setStatus("Creating conversation");
    try {
      const thread = await client.threads.create({
        metadata: { example: "02-basic-chat-ui", title },
      });
      const threadRecord = thread as {
        thread_id?: string;
        threadId?: string;
        id?: string;
      };
      const nextThreadId =
        threadRecord.thread_id ?? threadRecord.threadId ?? threadRecord.id;
      if (!nextThreadId)
        throw new Error("Thread creation did not return a thread id.");
      const conversation: Conversation = {
        id: String(nextThreadId),
        title,
        createdAt: new Date().toLocaleTimeString(),
      };
      setConversations((current) => [conversation, ...current]);
      setThreadId(conversation.id);
      setMessages([]);
      setEvents([]);
      setStatus("Conversation ready");
      return conversation.id;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Conversation create failed");
      return "";
    } finally {
      setBusy(false);
    }
  }

  async function selectConversation(id: string) {
    setThreadId(id);
    setError("");
    setStatus("Loading conversation state");
    try {
      const state = await client.threads.getState(id);
      setMessages(normalizeMessages(state));
      setStatus("Conversation loaded");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Conversation load failed");
    }
  }

  async function deleteConversation() {
    if (!threadId) return;
    setBusy(true);
    setError("");
    setStatus("Deleting conversation");
    try {
      await client.threads.delete(threadId);
      setConversations((current) =>
        filter(current, (conversation) => conversation.id !== threadId),
      );
      setThreadId("");
      setMessages([]);
      setEvents([]);
      setStatus("Conversation deleted");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Conversation delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed) return;

    prepareSendMessage();

    const activeThreadId =
      threadId || (await createConversation("Memory check"));
    if (!activeThreadId) {
      setBusy(false);
      return;
    }

    const humanMessage: ChatMessageRecord = {
      id: createClientId("message"),
      role: "human",
      content: trimmed,
    };
    const assistantDraftId = createClientId("message");
    setMessages((current) => [
      ...current,
      humanMessage,
      { id: assistantDraftId, role: "ai", content: "Streaming..." },
    ]);

    try {
      const stream = await client.runs.stream(activeThreadId, "02_basic_chat", {
        input: { messages: [{ type: "human", content: trimmed }] },
        streamMode: "updates",
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 40));
        const text = extractLatestMessageText(logEntry.data);
        if (text) {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantDraftId
                ? { ...message, content: text }
                : message,
            ),
          );
        }
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(activeThreadId);
      setMessages(normalizeMessages(state));
      setStatus("Run complete");
    } catch (caught) {
      setMessages((current) =>
        filter(current, (message) => message.id !== assistantDraftId),
      );
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }
  return {
    conversations,
    threadId,
    messages,
    input,
    setInput,
    status,
    events,
    error,
    busy,
    createConversation,
    selectConversation,
    deleteConversation,
    sendMessage,
  };
}
