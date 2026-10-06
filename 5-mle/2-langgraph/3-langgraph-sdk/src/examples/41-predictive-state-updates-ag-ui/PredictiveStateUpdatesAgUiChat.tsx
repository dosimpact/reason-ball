import { CopilotChat } from "@copilotkit/react-core/v2";
import { CheckCircle2, FileText, RotateCcw, Wand2 } from "lucide-react";
import { usePredictiveStateUpdatesAgUiChat } from "./usePredictiveStateUpdatesAgUiChat";
import { layoutStyle, panelStyle, inputStyle, buttonStyle } from "./styles";

export function PredictiveStateUpdatesAgUiChat() {
  const { documentState, setDocumentState, pending, startPrediction, confirmPrediction, resetDocument } = usePredictiveStateUpdatesAgUiChat();

  return (
    <section style={layoutStyle}>
      <div style={panelStyle} data-testid="predictive-document-panel">
        <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
          <FileText size={18} />
          <h3 style={{ fontSize: 18, margin: 0 }}>Predictive Document</h3>
        </div>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Title
          <input
            style={inputStyle}
            value={documentState.title}
            onChange={(event) =>
              setDocumentState({ ...documentState, title: event.target.value, lastOperation: "manual:title" })
            }
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Body
          <textarea
            rows={10}
            style={inputStyle}
            value={documentState.body}
            onChange={(event) =>
              setDocumentState({ ...documentState, body: event.target.value, lastOperation: "manual:body" })
            }
          />
        </label>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            style={{ ...buttonStyle, background: "#174f8c", color: "#ffffff" }}
            type="button"
            onClick={() => startPrediction("shorten")}
          >
            <Wand2 size={16} />
            Predict shorten
          </button>
          <button
            style={{ ...buttonStyle, background: "#ffffff", color: "#24312d" }}
            type="button"
            onClick={() => confirmPrediction()}
            disabled={!pending || pending.status !== "pending"}
          >
            <CheckCircle2 size={16} />
            Confirm
          </button>
          <button
            style={{ ...buttonStyle, background: "#ffffff", color: "#24312d" }}
            type="button"
            onClick={resetDocument}
          >
            <RotateCcw size={16} />
            Reset
          </button>
        </div>

        <div style={{ ...panelStyle, background: pending?.status === "pending" ? "#fff9e6" : "#f4faf7" }}>
          <strong>Revision {documentState.revision}</strong>
          <span>Last operation: {documentState.lastOperation}</span>
          <span>Prediction: {pending ? `${pending.operation} ${pending.status}` : "none"}</span>
        </div>
      </div>

      <div style={{ ...panelStyle, minHeight: 680 }}>
        <h3 style={{ fontSize: 18, margin: 0 }}>Backend Confirmation Chat</h3>
        <CopilotChat agentId="41_predictive_state_updates" className="agentic-chat-window" />
      </div>
    </section>
  );
}
