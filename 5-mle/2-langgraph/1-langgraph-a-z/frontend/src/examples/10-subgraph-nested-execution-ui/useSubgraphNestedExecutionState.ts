import { isPlainObject, isArray, isString } from "remeda";
import { useState } from "react";
import { StreamLogEntry } from "../../lib/langgraphClient";
import {
  JsonRecord,
  MessageRecord,
  StepRecord,
  normalizeMessages,
  normalizeSteps,
  samples,
} from "./data";

// Local state is separate from SDK requests and rendering.
export function useSubgraphNestedExecutionState() {
  const [request, setRequest] = useState(samples[0].value);
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  const [parentSteps, setParentSteps] = useState<StepRecord[]>([]);
  const [subgraphSteps, setSubgraphSteps] = useState<StepRecord[]>([]);
  const [parentMessages, setParentMessages] = useState<MessageRecord[]>([]);
  const [subgraphMessages, setSubgraphMessages] = useState<MessageRecord[]>([]);
  const [parentState, setParentState] = useState<JsonRecord | null>(null);
  const [subgraphState, setSubgraphState] = useState<JsonRecord | null>(null);
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [final, setFinal] = useState("");
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setSelectedTeam("");
    setBreadcrumb([]);
    setParentSteps([]);
    setSubgraphSteps([]);
    setParentMessages([]);
    setSubgraphMessages([]);
    setParentState(null);
    setSubgraphState(null);
    setFinalState(null);
    setFinal("");
    setEvents([]);
    setError("");
  }

  function applyValues(values: JsonRecord) {
    if (isString(values.selected_team))
      setSelectedTeam(values.selected_team);
    if (isArray(values.breadcrumb))
      setBreadcrumb(values.breadcrumb.map(String));
    if (isArray(values.parent_steps))
      setParentSteps(normalizeSteps(values.parent_steps));
    if (isArray(values.subgraph_steps)) {
      setSubgraphSteps(normalizeSteps(values.subgraph_steps));
    }
    if (isArray(values.parent_messages)) {
      setParentMessages(normalizeMessages(values.parent_messages));
    }
    if (isArray(values.subgraph_messages)) {
      setSubgraphMessages(normalizeMessages(values.subgraph_messages));
    }
    if (isPlainObject(values.parent_state)) setParentState(values.parent_state);
    if (isPlainObject(values.subgraph_state))
      setSubgraphState(values.subgraph_state);
    if (isString(values.final)) setFinal(values.final);
    if (Object.keys(values).length > 0) setFinalState(values);
  }

  function prepareRunNestedGraph() {
    setBusy(true);
    setError("");
    setEvents([]);
    setSelectedTeam("");
    setBreadcrumb([]);
    setParentSteps([]);
    setSubgraphSteps([]);
    setParentMessages([]);
    setSubgraphMessages([]);
    setParentState(null);
    setSubgraphState(null);
    setFinalState(null);
    setFinal("");
    setStatus("Creating nested thread");
  }

  return {
    prepareRunNestedGraph,
    applyValues,
    request,
    setRequest,
    threadId,
    setThreadId,
    status,
    setStatus,
    selectedTeam,
    setSelectedTeam,
    breadcrumb,
    setBreadcrumb,
    parentSteps,
    setParentSteps,
    subgraphSteps,
    setSubgraphSteps,
    parentMessages,
    setParentMessages,
    subgraphMessages,
    setSubgraphMessages,
    parentState,
    setParentState,
    subgraphState,
    setSubgraphState,
    finalState,
    setFinalState,
    final,
    setFinal,
    events,
    setEvents,
    error,
    setError,
    busy,
    setBusy,
    resetView,
  };
}
