import { Clock3 } from "lucide-react";
import { formatJson } from "./data";
import { type LongContextController } from "./useLongContext";

// Typed display panels receive only the state and callbacks they render.
type ContextBudgetPanelProps = Pick<
  LongContextController,
  | "messages"
  | "summary"
  | "summaryRecords"
  | "summarizedMessages"
  | "contextStats"
>;

export function ContextBudgetPanel({
  messages,
  summary,
  summaryRecords,
  summarizedMessages,
  contextStats,
}: ContextBudgetPanelProps) {
  return (
    <div
      className="context-budget-panel"
      role="region"
      aria-label="Context Budget"
    >
      <div className="panel-title">
        <Clock3 aria-hidden="true" size={18} />
        Context Budget
      </div>
      <div className="budget-grid">
        <div>
          <span>Summarize After</span>
          <strong>{contextStats.summarizeAfter}</strong>
        </div>
        <div>
          <span>Keep Recent</span>
          <strong>{contextStats.keepRecent}</strong>
        </div>
        <div>
          <span>Retained Messages</span>
          <strong>
            {contextStats.retainedMessageCount || messages.length}
          </strong>
        </div>
        <div>
          <span>Summarized Messages</span>
          <strong>
            {contextStats.summarizedMessageCount || summarizedMessages.length}
          </strong>
        </div>
        <div>
          <span>Summary Records</span>
          <strong>
            {contextStats.summaryRecordCount || summaryRecords.length}
          </strong>
        </div>
        <div>
          <span>Triggered</span>
          <strong>
            {contextStats.compactionTriggered || summary ? "yes" : "no"}
          </strong>
        </div>
      </div>
    </div>
  );
}

type SummaryOfEarlierContextPanelProps = Pick<
  LongContextController,
  "summary" | "summaryMetadata"
>;

export function SummaryOfEarlierContextPanel({
  summary,
  summaryMetadata,
}: SummaryOfEarlierContextPanelProps) {
  return (
    <div
      className="summary-panel"
      role="region"
      aria-label="Summary of Earlier Context"
    >
      <div className="panel-title">Summary of Earlier Context</div>
      {summary ? (
        <div className="answer-box compact-answer">{summary}</div>
      ) : (
        <p className="muted">No summary yet.</p>
      )}
      {summaryMetadata ? (
        <dl className="summary-metadata">
          <div>
            <dt>Created</dt>
            <dd>{summaryMetadata.createdAt}</dd>
          </div>
          <div>
            <dt>Source Range</dt>
            <dd>{summaryMetadata.sourceMessageRange}</dd>
          </div>
          <div>
            <dt>Removed</dt>
            <dd>{summaryMetadata.sourceCount}</dd>
          </div>
          <div>
            <dt>Retained</dt>
            <dd>{summaryMetadata.retainedCount}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

type RecentMessagesPanelProps = Pick<LongContextController, "messages">;

export function RecentMessagesPanel({ messages }: RecentMessagesPanelProps) {
  return (
    <div
      className="recent-messages-panel"
      role="region"
      aria-label="Recent Messages"
    >
      <div className="panel-title">Recent Messages</div>
      <div className="message-list compact-messages">
        {messages.length === 0 ? (
          <p className="muted">
            Seed the long conversation to see retained messages.
          </p>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={`message-bubble ${message.role}`}
            >
              <span>{message.role}</span>
              <p>{message.content}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

type SummarizedMessagesPanelProps = Pick<
  LongContextController,
  "summarizedMessages"
>;

export function SummarizedMessagesPanel({
  summarizedMessages,
}: SummarizedMessagesPanelProps) {
  return (
    <div
      className="summarized-messages-panel"
      role="region"
      aria-label="Summarized Messages"
    >
      <div className="panel-title">Summarized Messages</div>
      <div className="summarized-message-list">
        {summarizedMessages.length === 0 ? (
          <p className="muted">Removed messages will remain traceable here.</p>
        ) : (
          summarizedMessages.map((message) => (
            <article
              key={`${message.id}-${message.index}`}
              className="summarized-message"
            >
              <span>
                #{message.index} {message.role}
              </span>
              <p>{message.content}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

type CompactionEventsPanelProps = Pick<
  LongContextController,
  "status" | "contextEvents"
>;

export function CompactionEventsPanel({
  status,
  contextEvents,
}: CompactionEventsPanelProps) {
  return (
    <div
      className="context-events-panel"
      role="region"
      aria-label="Compaction Events"
    >
      <div className="panel-title">Compaction Events</div>
      <div className="context-event-list">
        {contextEvents.length === 0 ? (
          <p className="muted">No context events yet.</p>
        ) : (
          contextEvents.map((event, index) => (
            <article
              key={`${event.phase}-${event.status}-${index}`}
              className={`context-event ${event.status}`}
            >
              <strong>{event.phase}</strong>
              <code>{event.status}</code>
              <p>{event.detail}</p>
              <small>
                retained {event.retainedCount} / removed {event.removedCount}
              </small>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

type AssistantAnswerPanelProps = Pick<
  LongContextController,
  "assistantResponse" | "final"
>;

export function AssistantAnswerPanel({
  assistantResponse,
  final,
}: AssistantAnswerPanelProps) {
  return (
    <div
      className="assistant-answer-panel"
      role="region"
      aria-label="Assistant Answer"
    >
      <div className="panel-title">Assistant Answer</div>
      <div className="answer-box compact-answer">
        {final || assistantResponse || "No assistant answer yet."}
      </div>
    </div>
  );
}

type LatestSummaryRecordPanelProps = Pick<
  LongContextController,
  "latestRecord"
>;

export function LatestSummaryRecordPanel({
  latestRecord,
}: LatestSummaryRecordPanelProps) {
  return (
    <div
      className="summary-record-panel"
      role="region"
      aria-label="Latest Summary Record"
    >
      <div className="panel-title">Latest Summary Record</div>
      {latestRecord ? (
        <pre>{formatJson(latestRecord)}</pre>
      ) : (
        <p className="muted">No summary record yet.</p>
      )}
    </div>
  );
}
