import { Boxes, CheckCircle2, Clock3, PackageSearch, TriangleAlert } from "lucide-react";
import { z } from "zod";
import { normalizeInventoryResult, searchInventoryParameters } from "./model";
import { styles } from "./styles";

export function statusIcon(status: string | undefined) {
  if (status === "ready") return <CheckCircle2 aria-hidden="true" size={16} />;
  if (status === "attention") return <TriangleAlert aria-hidden="true" size={16} />;
  return <Clock3 aria-hidden="true" size={16} />;
}

export function InventoryCard({
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

export function SearchInventoryRenderer({ parameters, result, status }: { parameters: Partial<z.infer<typeof searchInventoryParameters>>; result: unknown; status: string }) {
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
}
