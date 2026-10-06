import { useStream } from "@langchain/langgraph-sdk/react";
import { useCallback, useMemo } from "react";
import { createClientId, langGraphApiUrl } from "../../lib/langgraphClient";
import { ApprovalState, payloadFromInterrupt } from "./data";
import { useHumanInTheLoopReactHookState } from "./useHumanInTheLoopReactHookState";

export function useHumanInTheLoopReactHook() {
  const {
    action,
    setAction,
    editText,
    setEditText,
    threadId,
    setThreadId,
    events,
    setEvents,
    status,
    setStatus,
  } = useHumanInTheLoopReactHookState();

  const addEvent = useCallback(
    (event: string, data: unknown, runId?: string) => {
      setEvents((current) =>
        [
          {
            id: createClientId("stream"),
            event,
            runId,
            data,
            receivedAt: new Date().toLocaleTimeString(),
          },
          ...current,
        ].slice(0, 80),
      );
    },
    [],
  );

  const stream = useStream<ApprovalState>({
    apiUrl: langGraphApiUrl,
    assistantId: "06_human_in_the_loop_interrupt",
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
      addEvent("updates", data);
    },
    onCustomEvent(data) {
      addEvent("custom", data);
    },
    onFinish(state, run) {
      addEvent("finish", state.values, run?.run_id);
      setStatus("Run complete");
    },
    onError(error, run) {
      addEvent("error", error, run?.run_id);
      setStatus("Run failed");
    },
  });

  const interruptPayload = useMemo(
    () => payloadFromInterrupt(stream.interrupt),
    [stream.interrupt],
  );

  const values = stream.values;

  const resultText = String(values.final ?? values.execution_result ?? "");

  const busy = stream.isLoading;

  async function startRun() {
    const trimmed = action.trim();
    if (!trimmed) return;

    setEvents([]);
    setStatus("Running until approval interrupt");
    await stream.submit(
      { action: trimmed },
      {
        streamMode: ["updates"],
      },
    );
    if (stream.interrupt) setStatus("Interrupted");
  }

  async function resumeRun(resumeValue: unknown) {
    setStatus("Resuming approval run");
    await stream.submit(null, {
      command: { resume: resumeValue },
      streamMode: ["updates"],
    });
  }

  function resetView() {
    stream.switchThread(null);
    setThreadId(null);
    setEvents([]);
    setStatus("Idle");
  }
  return {
    action,
    setAction,
    editText,
    setEditText,
    threadId,
    events,
    status,
    interruptPayload,
    values,
    resultText,
    busy,
    startRun,
    resumeRun,
    resetView,
  };
}
