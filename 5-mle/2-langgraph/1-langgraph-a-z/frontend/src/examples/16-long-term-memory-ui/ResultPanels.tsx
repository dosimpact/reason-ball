import { type LongTermMemoryController } from "./useLongTermMemory";

// Typed display panels receive only the state and callbacks they render.
type DurableMemoriesPanelProps = Pick<
  LongTermMemoryController,
  "userId" | "memoryId" | "content" | "memories" | "namespace" | "selectMemory"
>;

export function DurableMemoriesPanel({
  userId,
  memoryId,
  content,
  memories,
  namespace,
  selectMemory,
}: DurableMemoriesPanelProps) {
  return (
    <div
      className="durable-memory-panel"
      role="region"
      aria-label="Durable Memories"
    >
      <div className="panel-title">Durable Memories</div>
      <p className="namespace-line">
        Namespace{" "}
        <code>
          {namespace.length > 0
            ? namespace.join("/")
            : `memories/long-term-memory-ui/${userId}`}
        </code>
      </p>
      <div className="memory-list">
        {memories.length === 0 ? (
          <p className="muted">No durable memories loaded for this user.</p>
        ) : (
          memories.map((memory) => (
            <button
              key={memory.id}
              type="button"
              className={
                memory.id === memoryId ? "memory-item active" : "memory-item"
              }
              onClick={() => selectMemory(memory)}
            >
              <strong>{memory.id}</strong>
              <span>{memory.content}</span>
              <code>{memory.userId}</code>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

type ThreadStatePanelProps = Pick<
  LongTermMemoryController,
  "threadId" | "status" | "threadNotes" | "latestOperation"
>;

export function ThreadStatePanel({
  threadId,
  status,
  threadNotes,
  latestOperation,
}: ThreadStatePanelProps) {
  return (
    <div className="thread-state-panel" role="region" aria-label="Thread State">
      <div className="panel-title">Thread State</div>
      <div className="thread-state-grid">
        <div>
          <span>Current Thread</span>
          <strong>{threadId || "none"}</strong>
        </div>
        <div>
          <span>Latest Operation</span>
          <strong>
            {latestOperation
              ? `${latestOperation.action} / ${latestOperation.status}`
              : "none"}
          </strong>
        </div>
      </div>
      <div className="thread-note-list">
        {threadNotes.length === 0 ? (
          <p className="muted">Thread-local notes will appear after a run.</p>
        ) : (
          threadNotes.map((note) => <p key={note}>{note}</p>)
        )}
      </div>
    </div>
  );
}

type CrossThreadProofPanelProps = Pick<
  LongTermMemoryController,
  | "userId"
  | "content"
  | "lastMutationThreadId"
  | "crossThreadId"
  | "otherUserThreadId"
  | "proofMessage"
  | "proofMemories"
  | "otherUserMemoryCount"
>;

export function CrossThreadProofPanel({
  userId,
  content,
  lastMutationThreadId,
  crossThreadId,
  otherUserThreadId,
  proofMessage,
  proofMemories,
  otherUserMemoryCount,
}: CrossThreadProofPanelProps) {
  return (
    <div
      className="cross-thread-panel"
      role="region"
      aria-label="Cross-thread Proof"
    >
      <div className="panel-title">Cross-thread Proof</div>
      <div className="proof-grid">
        <div>
          <span>Mutation Thread</span>
          <strong>{lastMutationThreadId || "none"}</strong>
        </div>
        <div>
          <span>Recall Thread</span>
          <strong>{crossThreadId || "none"}</strong>
        </div>
        <div>
          <span>Other User Thread</span>
          <strong>{otherUserThreadId || "none"}</strong>
        </div>
      </div>
      <p>{proofMessage}</p>
      {proofMemories.length > 0 ? (
        <div className="proof-memory-list">
          {proofMemories.map((memory) => (
            <article
              key={`${memory.userId}-${memory.id}`}
              className="proof-memory-card"
            >
              <strong>{memory.id}</strong>
              <span>{memory.content}</span>
              <code>{memory.userId}</code>
            </article>
          ))}
        </div>
      ) : null}
      {otherUserMemoryCount !== null ? (
        <p className="isolation-line">
          Other user recall returned {otherUserMemoryCount} durable memories.
        </p>
      ) : null}
    </div>
  );
}

type MemoryEventsPanelProps = Pick<
  LongTermMemoryController,
  "userId" | "memoryId" | "memoryEvents"
>;

export function MemoryEventsPanel({
  userId,
  memoryId,
  memoryEvents,
}: MemoryEventsPanelProps) {
  return (
    <div
      className="memory-events-panel"
      role="region"
      aria-label="Memory Events"
    >
      <div className="panel-title">Memory Events</div>
      <div className="memory-event-list">
        {memoryEvents.length === 0 ? (
          <p className="muted">Store operation events will appear here.</p>
        ) : (
          memoryEvents.slice(0, 12).map((event, index) => (
            <div
              key={`${event.action}-${event.memoryId}-${index}`}
              className="memory-event"
            >
              <strong>{event.action}</strong>
              <span>{event.memoryId || event.userId}</span>
              <p>{event.detail}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type FinalAnswerPanelProps = Pick<
  LongTermMemoryController,
  "assistantResponse" | "final"
>;

export function FinalAnswerPanel({
  assistantResponse,
  final,
}: FinalAnswerPanelProps) {
  return (
    <div className="final-answer-panel" role="region" aria-label="Final Answer">
      <div className="panel-title">Final Answer</div>
      <div className="answer-box">
        {final || assistantResponse || "No memory response yet."}
      </div>
    </div>
  );
}
