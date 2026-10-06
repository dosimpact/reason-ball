import { AlertTriangle } from "lucide-react";
import { formatJson, inlineKey, eventPercent, phasePercent } from "./data";
import { type CustomEventRendererController } from "./useCustomEventRenderer";

// Typed display panels receive only the state and callbacks they render.
type RendererStatusPanelProps = Pick<
  CustomEventRendererController,
  | "finalStatus"
  | "inlineEvents"
  | "warnings"
  | "warningEvents"
  | "progressComplete"
>;

export function RendererStatusPanel({
  finalStatus,
  inlineEvents,
  warnings,
  warningEvents,
  progressComplete,
}: RendererStatusPanelProps) {
  return (
    <div
      className={`renderer-status-panel ${finalStatus}`}
      role="region"
      aria-label="Renderer Status"
    >
      <div className="panel-title">Renderer Status</div>
      <div className="renderer-status-grid">
        <div>
          <span>Final Status</span>
          <strong>{finalStatus}</strong>
        </div>
        <div>
          <span>Inline Events</span>
          <strong>{inlineEvents.length}</strong>
        </div>
        <div>
          <span>Warnings</span>
          <strong>{warningEvents.length + warnings.length}</strong>
        </div>
        <div>
          <span>Progress</span>
          <strong>
            {progressComplete
              ? "100%"
              : `${Math.max(0, ...inlineEvents.map(eventPercent))}%`}
          </strong>
        </div>
      </div>
    </div>
  );
}

type InlineEventRendererPanelProps = Pick<
  CustomEventRendererController,
  "taskId" | "taskPrompt" | "status" | "inlineEvents" | "answer" | "final"
>;

export function InlineEventRendererPanel({
  taskId,
  taskPrompt,
  status,
  inlineEvents,
  answer,
  final,
}: InlineEventRendererPanelProps) {
  return (
    <div
      className="inline-renderer-panel"
      role="region"
      aria-label="Inline Event Renderer"
    >
      <div className="panel-title">Inline Event Renderer</div>
      <div className="renderer-chat-flow">
        <article className="renderer-message human">
          <strong>Human task</strong>
          <p>{taskPrompt || "No task prompt yet."}</p>
          <small>{taskId || "no task id"}</small>
        </article>
        {inlineEvents.length === 0 ? (
          <p className="muted">Run the graph to render custom events inline.</p>
        ) : (
          inlineEvents.map((event) => (
            <article
              key={inlineKey(event)}
              className={`renderer-event-card ${event.kind} ${event.status}`}
            >
              <div className="renderer-event-header">
                <div>
                  <strong>{event.kind} event</strong>
                  <span>
                    {event.phase} / {event.node}
                  </span>
                </div>
                <code>{event.status || event.severity}</code>
              </div>
              <p>{event.message}</p>
              <div className="renderer-progress-row">
                <meter min={0} max={100} value={eventPercent(event)} />
                <span>{eventPercent(event)}%</span>
              </div>
            </article>
          ))
        )}
        <article className="renderer-message assistant">
          <strong>Assistant answer</strong>
          <p>
            {final ||
              answer ||
              "Final assistant message appears after the event renderer completes."}
          </p>
        </article>
      </div>
    </div>
  );
}

type PhaseProgressPanelProps = Pick<
  CustomEventRendererController,
  "status" | "phaseRecords"
>;

export function PhaseProgressPanel({
  status,
  phaseRecords,
}: PhaseProgressPanelProps) {
  return (
    <div
      className="phase-progress-panel"
      role="region"
      aria-label="Phase Progress"
    >
      <div className="panel-title">Phase Progress</div>
      <div className="phase-progress-list">
        {phaseRecords.length === 0 ? (
          <p className="muted">Phase progress appears after the run starts.</p>
        ) : (
          phaseRecords.map((record) => (
            <article
              key={record.phase}
              className={`phase-progress-card ${record.status}`}
            >
              <strong>{record.label || record.phase}</strong>
              <code>{record.status}</code>
              <p>{record.lastMessage}</p>
              <div>
                <meter min={0} max={100} value={phasePercent(record)} />
                <span>{phasePercent(record)}%</span>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

type WarningEventsPanelProps = Pick<
  CustomEventRendererController,
  "warnings" | "warningEvents"
>;

export function WarningEventsPanel({
  warnings,
  warningEvents,
}: WarningEventsPanelProps) {
  return (
    <div
      className="warning-events-panel"
      role="region"
      aria-label="Warning Events"
    >
      <div className="panel-title">Warning Events</div>
      {warningEvents.length === 0 && warnings.length === 0 ? (
        <p className="muted">
          Warning renderer rows appear when custom warning events arrive.
        </p>
      ) : (
        <div className="warning-event-list">
          {[...warningEvents.map((event) => event.message), ...warnings].map(
            (warning, index) => (
              <article
                key={`${warning}-${index}`}
                className="warning-event-card"
              >
                <AlertTriangle aria-hidden="true" size={16} />
                <span>{warning}</span>
              </article>
            ),
          )}
        </div>
      )}
    </div>
  );
}

type UnknownEventInspectorPanelProps = Pick<
  CustomEventRendererController,
  "status" | "unknownEvents"
>;

export function UnknownEventInspectorPanel({
  status,
  unknownEvents,
}: UnknownEventInspectorPanelProps) {
  return (
    <div
      className="unknown-event-panel"
      role="region"
      aria-label="Unknown Event Inspector"
    >
      <div className="panel-title">Unknown Event Inspector</div>
      {unknownEvents.length === 0 ? (
        <p className="muted">
          Unknown custom events are preserved here instead of breaking the
          renderer.
        </p>
      ) : (
        <div className="unknown-event-list">
          {unknownEvents.map((event) => (
            <details key={event.eventId} className="unknown-event-row" open>
              <summary>
                <strong>{event.kind}</strong>
                <span>{event.status}</span>
              </summary>
              <pre>{formatJson(event)}</pre>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

type FinalAnswerPanelProps = Pick<
  CustomEventRendererController,
  "answer" | "final"
>;

export function FinalAnswerPanel({ answer, final }: FinalAnswerPanelProps) {
  return (
    <div className="final-answer-panel" role="region" aria-label="Final Answer">
      <div className="panel-title">Final Answer</div>
      <div className="answer-box compact-answer">
        {final || answer || "No final answer yet."}
      </div>
    </div>
  );
}
