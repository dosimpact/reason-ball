import {
  Archive,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  RotateCcw,
  Scissors,
  Send,
} from "lucide-react";
import { langGraphApiUrl } from "../../lib/langgraphClient";
import { seedMessages } from "./data";
import { type LongContextController } from "./useLongContext";

// Form and button event binding stays in the presentation layer.
type RuntimeControlsProps = Pick<
  LongContextController,
  | "threadId"
  | "status"
  | "lastCompactionRunId"
  | "followUp"
  | "setFollowUp"
  | "error"
  | "busy"
  | "resetState"
  | "reloadState"
  | "runMessages"
  | "createThread"
  | "sendFollowUp"
>;

export function RuntimeControls({
  threadId,
  status,
  lastCompactionRunId,
  followUp,
  setFollowUp,
  error,
  busy,
  resetState,
  reloadState,
  runMessages,
  createThread,
  sendFollowUp,
}: RuntimeControlsProps) {
  return (
    <aside className="long-context-control">
      <div className="panel-title">
        <Archive aria-hidden="true" size={18} />
        Context Thread
      </div>
      <label className="field">
        <span>LangGraph API URL</span>
        <input value={langGraphApiUrl} readOnly />
      </label>
      <div className="button-row">
        <button
          type="button"
          className="secondary-button"
          onClick={createThread}
          disabled={busy}
        >
          <MessageSquarePlus size={16} />
          New context thread
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={() => void runMessages(seedMessages, "seed conversation")}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="spin" size={16} />
          ) : (
            <Scissors size={16} />
          )}
          Seed long conversation
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={reloadState}
          disabled={!threadId || busy}
        >
          <RefreshCw size={16} />
          Reload state
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={resetState}
          disabled={busy}
        >
          <RotateCcw size={16} />
          Reset
        </button>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void sendFollowUp();
        }}
        className="run-form"
      >
        <label className="field">
          <span>Follow-up message</span>
          <textarea
            value={followUp}
            onChange={(event) => setFollowUp(event.target.value)}
            rows={4}
          />
        </label>
        <button
          type="submit"
          className="primary-button"
          disabled={busy || !followUp.trim()}
        >
          {busy ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
          Send message
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
          <span>Compaction</span>
          <strong>{lastCompactionRunId || "none"}</strong>
        </div>
      </div>
      {error ? <p className="error-line">{error}</p> : null}
    </aside>
  );
}
