import "@copilotkit/react-core/v2/styles.css";
import { CopilotChat, CopilotKit, useConfigureSuggestions, useRenderTool } from "@copilotkit/react-core/v2";
import { Boxes, CheckCircle2, Clock3, PackageSearch, TriangleAlert } from "lucide-react";
import { z } from "zod";

type InventoryMetric = {
  label?: string;
  value?: string | number;
};

type InventoryRow = {
  sku?: string;
  name?: string;
  warehouse?: string;
  available?: string | number;
  reserved?: string | number;
  status?: string;
};

type InventoryResult = {
  title?: string;
  status?: string;
  summary?: string;
  metrics?: InventoryMetric[];
  rows?: InventoryRow[];
};

function copilotRuntimeUrl() {
  const configured = import.meta.env.VITE_COPILOTKIT_RUNTIME_URL;
  if (configured) return configured;
  return "/api/copilotkit";
}

function normalizeInventoryResult(result: unknown): InventoryResult {
  if (typeof result === "string") {
    try {
      return normalizeInventoryResult(JSON.parse(result));
    } catch {
      return {};
    }
  }

  if (result && typeof result === "object" && !Array.isArray(result)) {
    return result as InventoryResult;
  }

  return {};
}

function statusIcon(status: string | undefined) {
  if (status === "ready") return <CheckCircle2 aria-hidden="true" size={16} />;
  if (status === "attention") return <TriangleAlert aria-hidden="true" size={16} />;
  return <Clock3 aria-hidden="true" size={16} />;
}

const styles = {
  surface: {
    display: "grid",
    minHeight: "640px",
    gridTemplateColumns: "minmax(0, 1fr)",
    background: "#f6f7f9",
    border: "1px solid #d8dee8",
    borderRadius: "8px",
    overflow: "hidden",
  },
  chatPanel: {
    minHeight: "640px",
  },
  card: {
    display: "grid",
    gap: "14px",
    border: "1px solid #cbd7e3",
    borderRadius: "8px",
    padding: "16px",
    background: "#ffffff",
    color: "#17202a",
    boxShadow: "0 8px 24px rgba(20, 35, 52, 0.08)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  title: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontWeight: 700,
  },
  status: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    border: "1px solid #d8dee8",
    borderRadius: "999px",
    padding: "4px 8px",
    fontSize: "12px",
    textTransform: "capitalize" as const,
  },
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
  },
  metric: {
    border: "1px solid #e4e9ef",
    borderRadius: "8px",
    padding: "10px",
    background: "#f9fbfd",
  },
  table: {
    display: "grid",
    gap: "8px",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr 0.7fr 0.7fr",
    gap: "8px",
    alignItems: "center",
    borderTop: "1px solid #edf1f5",
    paddingTop: "8px",
    fontSize: "13px",
  },
};

function InventoryCard({
  parameters,
  result,
}: {
  parameters: { query?: string; warehouse?: string };
  result: unknown;
}) {
  const parsed = normalizeInventoryResult(result);
  const rows = parsed.rows ?? [];
  const metrics = parsed.metrics ?? [];

  return (
    <div style={styles.card} data-testid="backend-tool-render-card">
      <div style={styles.header}>
        <div style={styles.title}>
          <Boxes aria-hidden="true" size={18} />
          {parsed.title ?? "Inventory lookup"}
        </div>
        <span style={styles.status}>
          {statusIcon(parsed.status)}
          {parsed.status ?? "complete"}
        </span>
      </div>
      <p style={{ margin: 0 }}>{parsed.summary ?? `Lookup complete for ${parameters.query ?? "inventory"}.`}</p>
      {metrics.length > 0 ? (
        <div style={styles.metrics}>
          {metrics.map((metric) => (
            <div key={metric.label ?? String(metric.value)} style={styles.metric}>
              <div style={{ fontSize: "12px", color: "#5f6b7a" }}>{metric.label ?? "Metric"}</div>
              <strong>{metric.value ?? "n/a"}</strong>
            </div>
          ))}
        </div>
      ) : null}
      <div style={styles.table}>
        {rows.length > 0 ? (
          rows.map((row) => (
            <div key={row.sku ?? row.name} style={styles.row}>
              <strong>{row.name ?? "Unnamed item"}</strong>
              <span>{row.warehouse ?? parameters.warehouse ?? "north"}</span>
              <span>{row.available ?? 0} available</span>
              <span>{row.status ?? "ready"}</span>
            </div>
          ))
        ) : (
          <div style={styles.row}>
            <strong>No matching rows</strong>
            <span>{parameters.warehouse ?? "north"}</span>
            <span>0 available</span>
            <span>empty</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BackendToolRenderingChat() {
  useRenderTool({
    name: "search_inventory",
    parameters: z.object({
      query: z.string(),
      warehouse: z.string().optional(),
    }),
    render: ({ parameters, result, status }) => {
      if (status !== "complete") {
        return (
          <div style={styles.card} data-testid="backend-tool-render-loading">
            <div style={styles.title}>
              <PackageSearch aria-hidden="true" size={18} />
              Searching inventory...
            </div>
            <p style={{ margin: 0 }}>Query: {parameters.query}</p>
          </div>
        );
      }

      return <InventoryCard parameters={parameters} result={result} />;
    },
  });

  useConfigureSuggestions({
    suggestions: [
      {
        title: "Search inventory",
        message: "Search inventory for available demo items in the north warehouse.",
      },
      {
        title: "Warehouse status",
        message: "Check all warehouses for AG-UI renderer stock.",
      },
    ],
    available: "always",
  });

  return (
    <section style={styles.surface}>
      <div style={styles.chatPanel}>
        <CopilotChat agentId="backend_tool_rendering" className="agentic-chat-window" />
      </div>
    </section>
  );
}

export function BackendToolRenderingAgUiExample() {
  return (
    <CopilotKit
      runtimeUrl={copilotRuntimeUrl()}
      showDevConsole={false}
      agent="backend_tool_rendering"
    >
      <BackendToolRenderingChat />
    </CopilotKit>
  );
}
