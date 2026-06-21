import "@copilotkit/react-core/v2/styles.css";
import "./a2ui-dynamic-schema-ag-ui.css";
import {
  CopilotChat,
  CopilotKit,
  useConfigureSuggestions,
  useRenderTool,
} from "@copilotkit/react-core/v2";
import { Columns3, FileWarning, LayoutTemplate, ListChecks } from "lucide-react";
import { z } from "zod";

type JsonRecord = Record<string, unknown>;

function copilotRuntimeUrl() {
  const configured = import.meta.env.VITE_COPILOTKIT_RUNTIME_URL;
  if (configured) return configured;
  return "/api/copilotkit";
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseResult(value: unknown): JsonRecord {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parseResult(parsed);
    } catch {
      return {};
    }
  }

  return isRecord(value) ? value : {};
}

function records(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function DynamicNode({ node }: { node: JsonRecord }) {
  const type = typeof node.type === "string" ? node.type : "unknown";

  if (type === "comparison") {
    return (
      <section className="dynamic-a2ui-node">
        <div className="dynamic-a2ui-node-title">
          <Columns3 size={16} aria-hidden="true" />
          <strong>{String(node.title ?? "Comparison")}</strong>
        </div>
        <div className="dynamic-a2ui-comparison">
          {records(node.options).map((option) => (
            <article key={String(option.id ?? option.label)}>
              <strong>{String(option.label ?? "Option")}</strong>
              <span>{String(option.price ?? "")}</span>
              <p>{String(option.fit ?? "")}</p>
              <meter min={0} max={100} value={Number(option.score ?? 0)} />
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (type === "form") {
    return (
      <section className="dynamic-a2ui-node">
        <div className="dynamic-a2ui-node-title">
          <LayoutTemplate size={16} aria-hidden="true" />
          <strong>{String(node.title ?? "Form")}</strong>
        </div>
        <div className="dynamic-a2ui-form">
          {records(node.fields).map((field) => (
            <label key={String(field.id ?? field.label)}>
              <span>{String(field.label ?? "Field")}</span>
              <input value={String(field.value ?? "")} readOnly />
            </label>
          ))}
        </div>
      </section>
    );
  }

  if (type === "list") {
    return (
      <section className="dynamic-a2ui-node">
        <div className="dynamic-a2ui-node-title">
          <ListChecks size={16} aria-hidden="true" />
          <strong>{String(node.title ?? "List")}</strong>
        </div>
        <ul className="dynamic-a2ui-list">
          {records(node.items).map((item) => (
            <li key={String(item.id ?? item.label)}>
              <span>{String(item.label ?? "Item")}</span>
              <code>{String(item.status ?? "pending")}</code>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (type === "summary") {
    return (
      <section className="dynamic-a2ui-node">
        <div className="dynamic-a2ui-node-title">
          <LayoutTemplate size={16} aria-hidden="true" />
          <strong>{String(node.title ?? "Summary")}</strong>
        </div>
        <p>{String(node.body ?? "")}</p>
        <div className="dynamic-a2ui-stats">
          {records(node.stats).map((stat) => (
            <div key={String(stat.label)}>
              <span>{String(stat.label ?? "Metric")}</span>
              <strong>{String(stat.value ?? "")}</strong>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="dynamic-a2ui-fallback">
      <FileWarning size={16} aria-hidden="true" />
      <div>
        <strong>Unsupported schema node</strong>
        <p>{String(node.reason ?? `No renderer registered for ${type}.`)}</p>
      </div>
    </section>
  );
}

function DynamicSchemaCard({ result }: { result: unknown }) {
  const parsed = parseResult(result);
  const components = records(parsed.components);
  const unsupported = isRecord(parsed.unsupported) ? parsed.unsupported : null;
  const notes = records(parsed.stream_notes);

  return (
    <article className="dynamic-a2ui-card" data-testid="dynamic-a2ui-schema">
      <header className="dynamic-a2ui-header">
        <LayoutTemplate size={18} aria-hidden="true" />
        <div>
          <strong>{String(parsed.selected_kind ?? "dynamic")} schema</strong>
          <span>{String(parsed.schema_version ?? "unknown schema")}</span>
        </div>
      </header>
      <div className="dynamic-a2ui-notes">
        {notes.map((note, index) => (
          <span key={`${String(note.phase)}-${index}`}>
            {String(note.phase ?? "phase")}: {String(note.status ?? "pending")}
          </span>
        ))}
      </div>
      {components.map((component, index) => (
        <DynamicNode key={`${String(component.type)}-${index}`} node={component} />
      ))}
      {unsupported ? <DynamicNode node={unsupported} /> : null}
      <p className="dynamic-a2ui-summary">{String(parsed.final_summary ?? "Schema ready.")}</p>
    </article>
  );
}

function Chat() {
  useRenderTool({
    name: "generate_dynamic_schema",
    parameters: z.object({
      request: z.string().describe("The user request that determines the dynamic schema type."),
    }),
    render: ({ result, status }) => {
      if (status !== "complete") {
        return <div className="dynamic-a2ui-loading">Generating dynamic schema...</div>;
      }

      return <DynamicSchemaCard result={result} />;
    },
  });

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Comparison UI",
        message: "Compare three deployment options for a LangGraph SDK demo.",
      },
      {
        title: "Intake form",
        message: "Create an intake form for collecting launch owner, deadline, and risk.",
      },
      {
        title: "Checklist",
        message: "Generate a checklist of implementation tasks for a dynamic A2UI renderer.",
      },
    ],
    available: "always",
  });

  return (
    <section className="dynamic-a2ui-shell">
      <aside className="dynamic-a2ui-side">
        <div className="dynamic-a2ui-side-title">
          <LayoutTemplate size={18} aria-hidden="true" />
          Dynamic Schema
        </div>
        <p>Only form, list, comparison, and summary nodes render directly. Everything else uses a fallback.</p>
      </aside>
      <div className="dynamic-a2ui-chat">
        <CopilotChat agentId="a2ui_dynamic_schema" className="dynamic-a2ui-chat-window" />
      </div>
    </section>
  );
}

export function A2uiDynamicSchemaAgUiExample() {
  return (
    <CopilotKit runtimeUrl={copilotRuntimeUrl()} showDevConsole={false} agent="a2ui_dynamic_schema">
      <Chat />
    </CopilotKit>
  );
}
