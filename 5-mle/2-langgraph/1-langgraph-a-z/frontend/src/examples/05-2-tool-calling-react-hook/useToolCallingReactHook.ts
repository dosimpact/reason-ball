import { useStream } from "@langchain/langgraph-sdk/react";
import { useMemo } from "react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import {
  ToolCallingState,
  extractMessages,
  projectMessages,
  projectToolCards,
} from "./data";
import { useToolCallingReactHookState } from "./useToolCallingReactHookState";

export function useToolCallingReactHook() {
  const {
    threadId,
    setThreadId,
    prompt,
    setPrompt,
    status,
    setStatus,
    events,
    setEvents,
    addEvent,
  } = useToolCallingReactHookState();

  const stream = useStream<ToolCallingState>({
    apiUrl: langGraphApiUrl,
    assistantId: "05_tool_calling_react",
    threadId,
    onThreadId: setThreadId,
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

  const streamMessages = useMemo(
    () => extractMessages(stream.values.messages),
    [stream.values.messages],
  );

  const messages = useMemo(
    () => projectMessages(streamMessages),
    [streamMessages],
  );

  const toolCards = useMemo(
    () => projectToolCards(streamMessages),
    [streamMessages],
  );

  const busy = stream.isLoading;

  async function sendMessage() {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setEvents([]);
    setStatus("Submitting with useStream");
    await stream.submit(
      { messages: [{ type: "human", content: trimmed }] },
      { streamMode: ["updates"] },
    );
  }

  function resetView() {
    stream.switchThread(null);
    setThreadId(null);
    setEvents([]);
    setStatus("Idle");
  }
  return {
    threadId,
    prompt,
    setPrompt,
    status,
    events,
    stream,
    messages,
    toolCards,
    busy,
    sendMessage,
    resetView,
  };
}
