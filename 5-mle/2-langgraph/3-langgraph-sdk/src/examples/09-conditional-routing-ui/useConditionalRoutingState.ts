import { isArray, isString } from "remeda";
import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import {
  BranchCard,
  JsonRecord,
  branchOrder,
  normalizeBranchStatuses,
  samples,
} from "./data";

// Local state is separate from SDK requests and rendering.
export function useConditionalRoutingState() {
  const [request, setRequest] = useState(samples[0].value);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [routeReason, setRouteReason] = useState("");
  const [skippedBranches, setSkippedBranches] = useState<string[]>([]);
  const [branches, setBranches] = useState<BranchCard[]>(branchOrder);
  const [branchResult, setBranchResult] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setSelectedBranch("");
    setRouteReason("");
    setSkippedBranches([]);
    setBranches(branchOrder);
    setBranchResult("");
    setFinalState(null);
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (isString(values.selected_branch)) {
      setSelectedBranch(values.selected_branch);
    }
    if (isString(values.route_reason)) {
      setRouteReason(values.route_reason);
    }
    if (isArray(values.skipped_branches)) {
      setSkippedBranches(values.skipped_branches.map(String));
    }
    if (isString(values.branch_result)) {
      setBranchResult(values.branch_result);
    }
    if (values.branch_statuses) {
      setBranches(normalizeBranchStatuses(values.branch_statuses));
    }
  }

  function prepareRunRoute() {
    setBusy(true);
    setError("");
    setEvents([]);
    setSelectedBranch("");
    setRouteReason("");
    setSkippedBranches([]);
  }

  return {
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
  };
}
