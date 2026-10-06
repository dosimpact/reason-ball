import {
  Database,
  GitBranch,
  Loader2,
  Play,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { samples } from "./data";
import { type LongTermMemoryController } from "./useLongTermMemory";

// Form and button event binding stays in the presentation layer.
type RuntimeControlsProps = Pick<
  LongTermMemoryController,
  | "userId"
  | "setUserId"
  | "memoryId"
  | "setMemoryId"
  | "content"
  | "setContent"
  | "threadId"
  | "status"
  | "memories"
  | "error"
  | "busy"
  | "resetView"
  | "runMemoryAction"
>;

export function RuntimeControls({
  userId,
  setUserId,
  memoryId,
  setMemoryId,
  content,
  setContent,
  threadId,
  status,
  memories,
  error,
  busy,
  resetView,
  runMemoryAction,
}: RuntimeControlsProps) {
  return (
    <aside className="memory-control" role="region" aria-label="Memory Editor">
      <div className="panel-title">
        <Database aria-hidden="true" size={18} />
        Memory Editor
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <label className="field">
        <span>User ID</span>
        <input
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
        />
      </label>
      <div className="sample-list" aria-label="Memory samples">
        {samples.map((sample) => (
          <button
            key={sample.key}
            type="button"
            className="sample-button"
            onClick={() => {
              setMemoryId(sample.key);
              setContent(sample.value);
            }}
            disabled={busy}
          >
            {sample.label}
          </button>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runMemoryAction("create");
        }}
        className="run-form"
      >
        <label className="field">
          <span>Memory ID</span>
          <input
            value={memoryId}
            onChange={(event) => setMemoryId(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Memory Content</span>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={5}
          />
        </label>
        <div className="memory-button-grid">
          <button
            type="submit"
            className="primary-button"
            disabled={busy || !memoryId.trim() || !content.trim()}
          >
            {busy ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
            Create memory
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void runMemoryAction("update")}
            disabled={busy || !memoryId.trim() || !content.trim()}
          >
            <Save size={16} />
            Update memory
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void runMemoryAction("delete")}
            disabled={busy || !memoryId.trim()}
          >
            <Trash2 size={16} />
            Delete memory
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void runMemoryAction("recall")}
            disabled={busy || !userId.trim()}
          >
            <Play size={16} />
            Recall memories
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              void runMemoryAction("recall", {
                newThread: true,
                trackProof: true,
                overrideThreadLabel: "New thread same user",
              })
            }
            disabled={busy || !userId.trim()}
          >
            <GitBranch size={16} />
            Recall in new thread
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              void runMemoryAction("recall", {
                newThread: true,
                overrideUserId: `${userId}-other`,
                overrideThreadLabel: "Other user isolation check",
                trackOtherUser: true,
              })
            }
            disabled={busy || !userId.trim()}
          >
            <GitBranch size={16} />
            Recall other user
          </button>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={resetView}
          disabled={busy}
        >
          <RotateCcw size={16} />
          Reset view
        </button>
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
          <span>Memories</span>
          <strong>{memories.length}</strong>
        </div>
      </div>
      {error ? <p className="error-line">{error}</p> : null}
    </aside>
  );
}
