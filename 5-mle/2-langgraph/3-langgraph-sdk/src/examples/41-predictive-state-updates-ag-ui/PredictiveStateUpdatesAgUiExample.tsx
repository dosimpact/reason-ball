import { useMemo, useState } from "react";
import "@copilotkit/react-core/v2/styles.css";
import {
  CopilotChat,
  CopilotKit,
  useAgentContext,
  useConfigureSuggestions,
  useFrontendTool,
  useRenderTool,
} from "@copilotkit/react-core/v2";
import { CheckCircle2, FileText, RotateCcw, Wand2 } from "lucide-react";
import { z } from "zod";

type DocumentState = {
  title: string;
  body: string;
  revision: number;
  lastOperation: string;
};

type PendingOperation = {
  id: string;
  operation: string;
  status: "pending" | "confirmed" | "reverted";
  predictedTitle: string;
  predictedBody: string;
};

const initialDocument: DocumentState = {
  title: "Launch Readiness Note",
  body:
    "The team needs a compact readiness note before launch. It should summarize owner, risk, and next decision. The first draft is intentionally plain so predictive edits are easy to inspect.",
  revision: 1,
  lastOperation: "seed",
};

const layoutStyle = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "minmax(360px, 1fr) minmax(360px, 1fr)",
  minHeight: 720,
} as const;

const panelStyle = {
  background: "#fbfcfb",
  border: "1px solid #cfd8d5",
  borderRadius: 8,
  display: "grid",
  gap: 14,
  padding: 16,
} as const;

const inputStyle = {
  border: "1px solid #cfd8d5",
  borderRadius: 6,
  padding: "9px 10px",
  width: "100%",
} as const;

const buttonStyle = {
  alignItems: "center",
  border: "1px solid #9fb3ad",
  borderRadius: 6,
  cursor: "pointer",
  display: "inline-flex",
  gap: 8,
  justifyContent: "center",
  padding: "9px 12px",
} as const;

function copilotRuntimeUrl() {
  const configured = import.meta.env.VITE_COPILOTKIT_RUNTIME_URL;
  if (configured) return configured;
  return "/api/copilotkit";
}

function parseResult(result: unknown): Record<string, unknown> {
  if (typeof result === "string") {
    try {
      const parsed: unknown = JSON.parse(result);
      return parseResult(parsed);
    } catch {
      return { text: result };
    }
  }
  if (result && typeof result === "object" && !Array.isArray(result)) return result as Record<string, unknown>;
  return {};
}

function predictPatch(document: DocumentState, operation: string): Pick<DocumentState, "title" | "body"> {
  if (operation === "rewrite_title") {
    return { title: `${document.title}: reviewed draft`, body: document.body };
  }
  if (operation === "shorten") {
    const sentences = document.body.split(".").map((part) => part.trim()).filter(Boolean);
    return { title: document.title, body: sentences.slice(0, 2).join(". ") + "." };
  }
  if (operation === "append_summary") {
    return {
      title: document.title,
      body: `${document.body}\n\nSummary: Keep the launch note focused, testable, and ready for review.`,
    };
  }
  return {
    title: document.title,
    body: `${document.body}\n\nRevision note: Clarified the outcome, owner, and next decision point.`,
  };
}

function PredictiveDocumentChat() {
  const [documentState, setDocumentState] = useState<DocumentState>(initialDocument);
  const [pending, setPending] = useState<PendingOperation | null>(null);

  const context = useMemo(
    () => ({
      example: "41-predictive-state-updates-ag-ui",
      document: documentState,
      pending,
    }),
    [documentState, pending],
  );

  useAgentContext({
    description: "Current document state and predictive edit status",
    value: context,
  });

  function startPrediction(operation: string) {
    const predicted = predictPatch(documentState, operation);
    const nextPending: PendingOperation = {
      id: `op-${documentState.revision + 1}`,
      operation,
      status: "pending",
      predictedTitle: predicted.title,
      predictedBody: predicted.body,
    };
    setPending(nextPending);
    setDocumentState({
      title: predicted.title,
      body: predicted.body,
      revision: documentState.revision + 1,
      lastOperation: `${operation}:pending`,
    });
  }

  function confirmPrediction(operation = pending?.operation ?? "manual") {
    setPending((current) => (current ? { ...current, status: "confirmed" } : current));
    setDocumentState((current) => ({
      ...current,
      lastOperation: `${operation}:confirmed`,
    }));
  }

  function revertPrediction() {
    setPending((current) => (current ? { ...current, status: "reverted" } : current));
    setDocumentState({
      ...initialDocument,
      revision: documentState.revision + 1,
      lastOperation: "reverted",
    });
  }

  useFrontendTool(
    {
      name: "apply_document_update",
      description: "Apply a backend-confirmed document patch to the predictive editor.",
      parameters: z.object({
        title: z.string().optional(),
        body: z.string().optional(),
        operation: z.string(),
        status: z.enum(["confirmed", "reverted"]).default("confirmed"),
      }),
      handler: async ({ title, body, operation, status }) => {
        if (status === "reverted") {
          revertPrediction();
          return { status: "reverted", document: initialDocument };
        }
        const nextDocument = {
          title: title ?? documentState.title,
          body: body ?? documentState.body,
          revision: documentState.revision + 1,
          lastOperation: `${operation}:confirmed`,
        };
        setDocumentState(nextDocument);
        setPending({
          id: `agent-${nextDocument.revision}`,
          operation,
          status: "confirmed",
          predictedTitle: nextDocument.title,
          predictedBody: nextDocument.body,
        });
        return { status: "confirmed", document: nextDocument };
      },
    },
    [documentState],
  );

  useRenderTool({
    name: "edit_document",
    parameters: z.object({
      title: z.string(),
      body: z.string(),
      operation: z.enum(["rewrite_title", "improve_paragraph", "shorten", "append_summary"]),
    }),
    render: ({ status, parameters, result }) => {
      const parsed = parseResult(result);
      return (
        <div style={{ ...panelStyle, gap: 8 }} data-testid="document-edit-tool">
          <strong>{status === "complete" ? "Backend edit confirmed" : "Predicting document edit"}</strong>
          <span>Operation: {parameters.operation ?? "pending"}</span>
          {status === "complete" ? <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(parsed.patch ?? parsed, null, 2)}</pre> : null}
        </div>
      );
    },
  });

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Shorten document",
        message: `Call edit_document with title "${documentState.title}", the current body, and operation "shorten". Then apply the patch with apply_document_update.`,
      },
      {
        title: "Explain revision",
        message: `Explain revision ${documentState.revision} and last operation ${documentState.lastOperation}.`,
      },
    ],
    available: "always",
  });

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
            onClick={() => {
              setDocumentState(initialDocument);
              setPending(null);
            }}
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
        <CopilotChat agentId="predictive_state_updates" className="agentic-chat-window" />
      </div>
    </section>
  );
}

export function PredictiveStateUpdatesAgUiExample() {
  return (
    <CopilotKit runtimeUrl={copilotRuntimeUrl()} showDevConsole={false} agent="predictive_state_updates">
      <PredictiveDocumentChat />
    </CopilotKit>
  );
}
