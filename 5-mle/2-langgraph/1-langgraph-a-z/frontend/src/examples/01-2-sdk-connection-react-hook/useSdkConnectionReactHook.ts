import { useStream } from "@langchain/langgraph-sdk/react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { SdkConnectionState, latestAssistantText } from "./data";
import { useSdkConnectionReactHookState } from "./useSdkConnectionReactHookState";

export function useSdkConnectionReactHook() {
  const {
    prepareResetView,
    threadId,
    setThreadId,
    prompt,
    setPrompt,
    status,
    setStatus,
    runId,
    setRunId,
    events,
    setEvents,
    addEvent,
  } = useSdkConnectionReactHookState();

  const stream = useStream<SdkConnectionState>({
    apiUrl: langGraphApiUrl,
    assistantId: "01_sdk_connection",
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

  const answer =
    latestAssistantText(stream.values.messages) ||
    String(stream.values.final ?? stream.values.answer ?? "");

  async function runAssistant() {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setEvents([]);
    setRunId("");
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

  function resetView() {
    stream.switchThread(null);
    prepareResetView();
  }
  return {
    threadId,
    prompt,
    setPrompt,
    status,
    runId,
    events,
    stream,
    answer,
    runAssistant,
    resetView,
  };
}
