import { useMemo } from "react";
import {
  createClientId,
  createLangGraphClient,
  extractLatestMessageText,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { extractMessages, isMessageStreamData } from "./data";
import { useToolCallingReactState } from "./useToolCallingReactState";

export function useToolCallingReact() {
  const {
    threadId,
    setThreadId,
    prompt,
    setPrompt,
    messages,
    setMessages,
    toolCards,
    setToolCards,
    status,
    setStatus,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    resetView,
    handleStreamMessages,
    handleMessageStream,
  } = useToolCallingReactState();

  const client = useMemo(() => createLangGraphClient(), []);

  async function sendMessage() {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setBusy(true);
    setError("");
    setEvents([]);
    setMessages([
      { id: createClientId("message"), role: "human", content: trimmed },
    ]);
    setToolCards([]);
    setStatus("Creating tool thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "05-tool-calling-react-ui" },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming tool run");

      const stream = await client.runs.stream(
        nextThreadId,
        "05_tool_calling_react",
        {
          input: { messages: [{ type: "human", content: trimmed }] },
          streamMode: ["messages", "updates"] as ["messages", "updates"],
        },
      );

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);

        setEvents((current) => [logEntry, ...current].slice(0, 80));
        if (
          logEntry.event === "messages" ||
          logEntry.event.startsWith("messages/")
        ) {
          if (isMessageStreamData(logEntry.data)) {
            handleMessageStream(logEntry.data);
          }
        }
        if (logEntry.event === "updates") {
          handleStreamMessages(extractMessages(logEntry.data));
        }
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      const finalText = extractLatestMessageText(state.values ?? state);
      if (finalText) {
        setMessages((current) => {
          const alreadyShown = current.some(
            (item) => item.role === "assistant" && item.content === finalText,
          );
          return alreadyShown
            ? current
            : [
                ...current,
                {
                  id: createClientId("message"),
                  role: "assistant",
                  content: finalText,
                },
              ];
        });
      }
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }
  return {
    threadId,
    prompt,
    setPrompt,
    messages,
    toolCards,
    status,
    events,
    error,
    busy,
    resetView,
    sendMessage,
  };
}
