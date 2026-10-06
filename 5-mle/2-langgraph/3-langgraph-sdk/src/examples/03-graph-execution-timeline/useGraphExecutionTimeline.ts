import { useMemo } from "react";
import {
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import {
  getNodePayload,
  initialNodes,
  markNextRunning,
  nodeOrder,
} from "./data";
import { useGraphExecutionTimelineState } from "./useGraphExecutionTimelineState";

export function useGraphExecutionTimeline() {
  const {
    prepareRunTimeline,
    topic,
    setTopic,
    threadId,
    setThreadId,
    status,
    setStatus,
    nodes,
    setNodes,
    finalState,
    setFinalState,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    resetView,
  } = useGraphExecutionTimelineState();

  const client = useMemo(() => createLangGraphClient(), []);

  async function runTimeline() {
    const trimmed = topic.trim();
    if (!trimmed) return;

    prepareRunTimeline();
    setNodes(markNextRunning(initialNodes()));
    setStatus("Creating thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "03-graph-execution-timeline", topic: trimmed },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming graph updates");

      // node_updates는 langgraph의 상태값이며 이는 직접 정의된다.
      const stream = await client.runs.stream(
        nextThreadId,
        "03_graph_execution_timeline",
        {
          input: { topic: trimmed, steps: [], node_updates: [] },
          streamMode: "updates",
        },
      );

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 50));

        setNodes((current) => {
          let next = current;
          for (const node of nodeOrder) {
            const payload = getNodePayload(logEntry.data, node.name);
            if (payload !== undefined) {
              next = next.map((item) =>
                item.name === node.name
                  ? { ...item, status: "done", update: payload }
                  : item,
              );
            }
          }
          return markNextRunning(next);
        });
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      setFinalState(state.values ?? state);
      setNodes((current) =>
        current.map((node) =>
          node.status === "running" ? { ...node, status: "done" } : node,
        ),
      );
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setNodes((current) =>
        current.map((node) =>
          node.status === "running" ? { ...node, status: "error" } : node,
        ),
      );
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }
  return {
    topic,
    setTopic,
    threadId,
    status,
    nodes,
    finalState,
    events,
    error,
    busy,
    resetView,
    runTimeline,
  };
}
