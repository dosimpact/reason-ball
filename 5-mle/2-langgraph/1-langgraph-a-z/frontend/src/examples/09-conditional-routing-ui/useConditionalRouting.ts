import { useMemo } from "react";
import {
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";
import { branchOrder, nodePayload, valuesOf } from "./data";
import { useConditionalRoutingState } from "./useConditionalRoutingState";

export function useConditionalRouting() {
  const {
    prepareRunRoute,
    request,
    setRequest,
    threadId,
    setThreadId,
    status,
    setStatus,
    selectedBranch,
    setSelectedBranch,
    routeReason,
    setRouteReason,
    skippedBranches,
    setSkippedBranches,
    branches,
    setBranches,
    branchResult,
    setBranchResult,
    finalState,
    setFinalState,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    resetView,
    applyValues,
  } = useConditionalRoutingState();

  const client = useMemo(() => createLangGraphClient(), []);

  async function runRoute() {
    const trimmed = request.trim();
    if (!trimmed) return;

    prepareRunRoute();
    setBranches(branchOrder);
    setBranchResult("");
    setFinalState(null);
    setStatus("Creating route thread");

    try {
      const thread = await client.threads.create({
        metadata: { example: "09-conditional-routing-ui", request: trimmed },
      });
      const nextThreadId = String(thread.thread_id);
      setThreadId(nextThreadId);
      setStatus("Streaming route decision");

      const stream = await client.runs.stream(
        nextThreadId,
        "09_conditional_routing",
        {
          input: { request: trimmed },
          streamMode: "updates",
        },
      );

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 100));
        for (const nodeName of [
          "route_request",
          "translation_branch",
          "summary_branch",
          "support_branch",
          "finalize",
        ]) {
          const payload = nodePayload(logEntry.data, nodeName);
          if (payload) applyValues(payload);
        }
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      const values = valuesOf(state);
      setFinalState(values);
      applyValues(values);
      setStatus("Run complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("Run failed");
    } finally {
      setBusy(false);
    }
  }
  return {
    request,
    setRequest,
    threadId,
    status,
    selectedBranch,
    routeReason,
    skippedBranches,
    branches,
    branchResult,
    finalState,
    events,
    error,
    busy,
    resetView,
    runRoute,
  };
}
