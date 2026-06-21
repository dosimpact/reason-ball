import { ClipboardList, Loader2, Play, RefreshCcw, RotateCcw, StepForward } from "lucide-react";
import type { DragEvent, FormEvent } from "react";
import { useMemo, useState } from "react";
import {
  langGraphApiUrl,
  StreamLogEntry,
  createLangGraphClient,
  normalizeStreamChunk,
} from "../../lib/langgraphClient";

const defaultGoal = "Plan a reliable rollout for a LangGraph SDK artifact demo with review checkpoints.";
const statuses = ["completed", "active", "pending", "blocked", "failed"] as const;

type PlanStatus = (typeof statuses)[number];

type JsonRecord = Record<string, unknown>;

type PlanStep = {
  id: string;
  title: string;
  detail: string;
  status: string;
  owner: string;
};

type ExecutionLog = {
  stepId: string;
  status: string;
  detail: string;
};

type PlanVersion = {
  version: number;
  summary: string;
  steps: PlanStep[];
};

type PlanEvent = {
  type: string;
  phase: string;
  status: string;
  detail: string;
  progress: number;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valuesOf(state: unknown): JsonRecord {
  if (isRecord(state) && isRecord(state.values)) return state.values;
  return isRecord(state) ? state : {};
}

function nodePayloads(data: unknown): JsonRecord[] {
  if (!isRecord(data)) return [];
  return Object.values(data).filter(isRecord);
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : Number(value ?? fallback);
}

function percent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function normalizeSteps(value: unknown): PlanStep[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((step) => ({
    id: typeof step.id === "string" ? step.id : "",
    title: typeof step.title === "string" ? step.title : "",
    detail: typeof step.detail === "string" ? step.detail : "",
    status: typeof step.status === "string" ? step.status : "",
    owner: typeof step.owner === "string" ? step.owner : "",
  }));
}

function normalizeLog(value: unknown): ExecutionLog[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((entry) => ({
    stepId: typeof entry.step_id === "string" ? entry.step_id : "",
    status: typeof entry.status === "string" ? entry.status : "",
    detail: typeof entry.detail === "string" ? entry.detail : "",
  }));
}

function normalizeVersions(value: unknown): PlanVersion[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((version) => ({
    version: numberValue(version.version),
    summary: typeof version.summary === "string" ? version.summary : "",
    steps: normalizeSteps(version.steps),
  }));
}

function normalizePlanEvents(value: unknown): PlanEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((event) => ({
    type: typeof event.type === "string" ? event.type : "chat_plan_board",
    phase: typeof event.phase === "string" ? event.phase : "",
    status: typeof event.status === "string" ? event.status : "",
    detail: typeof event.detail === "string" ? event.detail : "",
    progress: numberValue(event.progress),
  }));
}

function mergePlanEvents(current: PlanEvent[], next: PlanEvent[]) {
  const seen = new Set<string>();
  return [...current, ...next].filter((event) => {
    const key = `${event.phase}:${event.status}:${event.detail}:${event.progress}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ChatPlanBoardExample() {
  const [userGoal, setUserGoal] = useState(defaultGoal);
  const [revisionNote, setRevisionNote] = useState("Add a reviewer checkpoint before final launch.");
  const [threadId, setThreadId] = useState("");
  const [status, setStatus] = useState("Idle");
  const [finalStatus, setFinalStatus] = useState("idle");
  const [planTitle, setPlanTitle] = useState("Execution Plan Board");
  const [planSummary, setPlanSummary] = useState("");
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([]);
  const [activeStepId, setActiveStepId] = useState("");
  const [boardStatus, setBoardStatus] = useState("idle");
  const [executionLog, setExecutionLog] = useState<ExecutionLog[]>([]);
  const [artifactVersion, setArtifactVersion] = useState(0);
  const [versionHistory, setVersionHistory] = useState<PlanVersion[]>([]);
  const [planEvents, setPlanEvents] = useState<PlanEvent[]>([]);
  const [final, setFinal] = useState("");
  const [finalState, setFinalState] = useState<JsonRecord | null>(null);
  const [events, setEvents] = useState<StreamLogEntry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draggingStepId, setDraggingStepId] = useState("");
  const [dragOverStatus, setDragOverStatus] = useState<PlanStatus | "">("");
  const [boardEditStatus, setBoardEditStatus] = useState("No manual board moves yet.");

  const client = useMemo(() => createLangGraphClient(), []);
  const canEditBoard = Boolean(threadId) && planSteps.length > 0 && !busy;
  const canContinue = canEditBoard;

  function resetView() {
    setThreadId("");
    setStatus("Idle");
    setFinalStatus("idle");
    setPlanTitle("Execution Plan Board");
    setPlanSummary("");
    setPlanSteps([]);
    setActiveStepId("");
    setBoardStatus("idle");
    setExecutionLog([]);
    setArtifactVersion(0);
    setVersionHistory([]);
    setPlanEvents([]);
    setFinal("");
    setFinalState(null);
    setEvents([]);
    setError("");
    setDraggingStepId("");
    setDragOverStatus("");
    setBoardEditStatus("No manual board moves yet.");
  }

  function applyValues(values: JsonRecord) {
    if (typeof values.plan_title === "string") setPlanTitle(values.plan_title);
    if (typeof values.plan_summary === "string") setPlanSummary(values.plan_summary);
    if (Array.isArray(values.plan_steps)) setPlanSteps(normalizeSteps(values.plan_steps));
    if (typeof values.active_step_id === "string") setActiveStepId(values.active_step_id);
    if (typeof values.board_status === "string") setBoardStatus(values.board_status);
    if (Array.isArray(values.execution_log)) setExecutionLog(normalizeLog(values.execution_log));
    if (typeof values.artifact_version === "number") setArtifactVersion(values.artifact_version);
    if (Array.isArray(values.version_history)) setVersionHistory(normalizeVersions(values.version_history));
    if (Array.isArray(values.plan_events)) {
      setPlanEvents((current) => mergePlanEvents(current, normalizePlanEvents(values.plan_events)));
    }
    if (typeof values.final === "string") setFinal(values.final);
    if (typeof values.final_status === "string") setFinalStatus(values.final_status);
    if (Object.keys(values).length > 0) setFinalState(values);
  }

  function applyCustomEvent(data: unknown) {
    if (!isRecord(data) || data.type !== "chat_plan_board") return;
    setPlanEvents((current) => mergePlanEvents(current, normalizePlanEvents([data])));
  }

  async function streamRun(input: JsonRecord, reuseThreadId = "") {
    setBusy(true);
    setError("");
    setEvents([]);
    setStatus(reuseThreadId ? "Streaming plan update" : "Creating plan board thread");

    try {
      const nextThreadId =
        reuseThreadId ||
        String(
          (
            await client.threads.create({
              metadata: { example: "31-chat-plan-board" },
            })
          ).thread_id,
        );
      setThreadId(nextThreadId);
      setStatus("Streaming plan board graph");

      const stream = await client.runs.stream(nextThreadId, "chat_plan_board", {
        input,
        streamMode: ["updates", "custom"] as ["updates", "custom"],
      });

      for await (const chunk of stream) {
        const logEntry = normalizeStreamChunk(chunk);
        setEvents((current) => [logEntry, ...current].slice(0, 180));
        if (logEntry.event === "custom") applyCustomEvent(logEntry.data);
        for (const payload of nodePayloads(logEntry.data)) applyValues(payload);
        setStatus(`Streaming: ${logEntry.event}`);
      }

      const state = await client.threads.getState(nextThreadId);
      applyValues(valuesOf(state));
      setStatus("Run complete");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setFinalStatus("failed");
      setStatus("Run failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitPlan(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const goal = userGoal.trim();
    if (!goal) return;
    resetView();
    setFinalStatus("running");
    await streamRun({ user_goal: goal, action: "create" });
  }

  async function continuePlan() {
    if (!threadId) return;
    await streamRun({ action: "continue" }, threadId);
  }

  async function revisePlan() {
    if (!threadId) return;
    await streamRun({ action: "revise", revision_note: revisionNote }, threadId);
  }

  function handleCardDragStart(event: DragEvent<HTMLElement>, stepId: string) {
    if (!canEditBoard) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", stepId);
    setDraggingStepId(stepId);
  }

  function handleCardDragEnd() {
    setDraggingStepId("");
    setDragOverStatus("");
  }

  function handleColumnDragOver(event: DragEvent<HTMLElement>, targetStatus: PlanStatus) {
    if (!draggingStepId || !canEditBoard) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverStatus(targetStatus);
  }

  function handleColumnDragLeave(event: DragEvent<HTMLElement>, targetStatus: PlanStatus) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setDragOverStatus((current) => (current === targetStatus ? "" : current));
  }

  async function handleColumnDrop(event: DragEvent<HTMLElement>, targetStatus: PlanStatus) {
    event.preventDefault();
    const stepId = event.dataTransfer.getData("text/plain") || draggingStepId;
    const movedStep = planSteps.find((step) => step.id === stepId);
    setDraggingStepId("");
    setDragOverStatus("");

    if (!threadId || !movedStep || !canEditBoard) return;
    if (movedStep.status === targetStatus) {
      setBoardEditStatus(`${movedStep.title} is already ${targetStatus}.`);
      return;
    }

    setBoardEditStatus(`Saving ${movedStep.title} to ${targetStatus}.`);
    const moved = await streamRun({ action: "move_step", step_id: stepId, target_status: targetStatus }, threadId);
    setBoardEditStatus(moved ? `Saved ${movedStep.title} to ${targetStatus}.` : `Could not save ${movedStep.title}.`);
  }

  return (
    <section className="plan-board-layout">
      <aside className="plan-board-control">
        <div className="panel-title">
          <ClipboardList aria-hidden="true" size={18} />
          Plan Board Runtime
        </div>
        <label className="field">
          <span>LangGraph API URL</span>
          <input value={langGraphApiUrl} readOnly />
        </label>
        <form className="run-form" onSubmit={submitPlan}>
          <label className="field">
            <span>Goal</span>
            <textarea value={userGoal} onChange={(event) => setUserGoal(event.target.value)} rows={5} />
          </label>
          <label className="field">
            <span>Revision note</span>
            <textarea value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} rows={3} />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={busy || !userGoal.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
              Run plan board
            </button>
            <button type="button" className="secondary-button" onClick={resetView} disabled={busy}>
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </form>
        <div className="runtime-facts">
          <div>
            <span>Status</span>
            <strong>{status}</strong>
          </div>
          <div>
            <span>Thread ID</span>
            <strong>{threadId || "none"}</strong>
          </div>
          <div>
            <span>Version</span>
            <strong>v{artifactVersion}</strong>
          </div>
        </div>
        {error ? <p className="error-line">{error}</p> : null}
      </aside>

      <div className={`plan-board-status-panel ${finalStatus}`} role="region" aria-label="Plan Board Status">
        <div className="panel-title">Plan Board Status</div>
        <div className="plan-board-status-grid">
          <div>
            <span>Final Status</span>
            <strong>{finalStatus}</strong>
          </div>
          <div>
            <span>Board</span>
            <strong>{boardStatus}</strong>
          </div>
          <div>
            <span>Active Step</span>
            <strong>{activeStepId || "none"}</strong>
          </div>
          <div>
            <span>Steps</span>
            <strong>{planSteps.length}</strong>
          </div>
        </div>
      </div>

      <div className="plan-board-chat-panel" role="region" aria-label="Chat Transcript">
        <div className="panel-title">Chat Transcript</div>
        <article className="plan-board-chat-message user">
          <strong>User</strong>
          <p>{userGoal}</p>
        </article>
        <article className="plan-board-chat-message assistant">
          <strong>Assistant</strong>
          <p>{planSummary || final || "No plan board yet."}</p>
        </article>
      </div>

      <div className="plan-board-canvas-panel" role="region" aria-label="Plan Board">
        <div className="panel-title">{planTitle}</div>
        <div className="plan-board-column-grid">
          {statuses.map((statusName) => (
            <section
              key={statusName}
              className={`plan-board-column ${statusName}${dragOverStatus === statusName ? " drag-over" : ""}`}
              onDragOver={(event) => handleColumnDragOver(event, statusName)}
              onDragLeave={(event) => handleColumnDragLeave(event, statusName)}
              onDrop={(event) => void handleColumnDrop(event, statusName)}
            >
              <h3>{statusName}</h3>
              {planSteps.filter((step) => step.status === statusName).map((step) => (
                <article
                  key={step.id}
                  className={`plan-board-card ${step.status}${draggingStepId === step.id ? " dragging" : ""}`}
                  draggable={canEditBoard}
                  aria-grabbed={draggingStepId === step.id}
                  onDragStart={(event) => handleCardDragStart(event, step.id)}
                  onDragEnd={handleCardDragEnd}
                >
                  <strong>{step.title}</strong>
                  <p>{step.detail}</p>
                  <div>
                    <code>{step.id}</code>
                    <span>{step.owner}</span>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>
      </div>

      <div className="plan-board-actions-panel" role="region" aria-label="Board Actions">
        <div className="panel-title">Board Actions</div>
        <div className="button-row">
          <button type="button" className="primary-button" onClick={continuePlan} disabled={!canContinue}>
            <StepForward size={16} />
            Continue execution
          </button>
          <button type="button" className="secondary-button" onClick={revisePlan} disabled={!canContinue}>
            <RefreshCcw size={16} />
            Replan board
          </button>
        </div>
        <p className="final-line">{boardEditStatus}</p>
        <p className="final-line">{final || "Plan steps update through the same thread."}</p>
      </div>

      <div className="plan-execution-log-panel" role="region" aria-label="Execution Log">
        <div className="panel-title">Execution Log</div>
        <div className="plan-execution-log-list">
          {executionLog.length === 0 ? (
            <p className="muted">No execution log yet.</p>
          ) : (
            executionLog.map((entry, index) => (
              <article key={`${entry.stepId}-${index}`} className={`plan-log-row ${entry.status}`}>
                <strong>{entry.stepId}</strong>
                <span>{entry.status}</span>
                <p>{entry.detail}</p>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="plan-version-panel" role="region" aria-label="Version History">
        <div className="panel-title">Version History</div>
        <div className="plan-version-list">
          {versionHistory.length === 0 ? (
            <p className="muted">No plan versions yet.</p>
          ) : (
            versionHistory.map((version) => (
              <article key={version.version} className="plan-version-row">
                <strong>v{version.version}</strong>
                <p>{version.summary}</p>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="plan-board-events-panel" role="region" aria-label="Plan Events">
        <div className="panel-title">Plan Events</div>
        <div className="plan-board-event-list">
          {planEvents.length === 0 ? (
            <p className="muted">No plan events yet.</p>
          ) : (
            planEvents.map((event, index) => (
              <article key={`${event.phase}-${event.status}-${index}`} className="plan-board-event-row">
                <strong>{event.phase}</strong>
                <span>{event.status}</span>
                <p>{event.detail}</p>
                <code>{percent(event.progress)}%</code>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="state-panel plan-board-final-state" role="region" aria-label="Final State">
        <div className="panel-title">Final State</div>
        <pre>{finalState ? formatJson(finalState) : "No final state yet."}</pre>
      </div>

      <div className="event-panel" role="region" aria-label="Raw Stream Events">
        <div className="panel-title">Raw Stream Events</div>
        <div className="event-list compact">
          {events.length === 0 ? (
            <p className="muted">No events yet.</p>
          ) : (
            events.map((entry) => (
              <details key={entry.id} className="event-row">
                <summary>
                  <span>{entry.receivedAt}</span>
                  <strong>event {entry.event}</strong>
                </summary>
                <pre>{formatJson(entry.data)}</pre>
              </details>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
