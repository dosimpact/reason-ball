import { extractChart } from "./extract-chart";
import {
  createParser,
  evaluateRoot,
  type ElementNode,
  type OpenUIError,
} from "@openuidev/lang-core";
import {
  dashboardLibrary,
  type Panel,
  stateDefaultErrors,
} from "@/entities/dashboard";

const schema = dashboardLibrary.toJSONSchema();
const parser = createParser(schema, dashboardLibrary.root);
const functions = Object.fromEntries(
  Object.entries(schema.functions ?? {}).map(([name, definition]) => [
    name,
    { ...definition, fn: dashboardLibrary.functions[name].fn },
  ]),
);
export type ExportTable = {
  visualization?: string;
  columns: string[];
  rows: unknown[][];
  sources?: string[];
};
function element(value: unknown): value is ElementNode {
  return (
    !!value &&
    typeof value === "object" &&
    "type" in value &&
    value.type === "element"
  );
}

/** Evaluate the same catalog and saved bindings as the renderer. No actions or queries run. */
export function extractDataBlocks(panel: Panel): ExportTable[] {
  const parsed = parser.parse(panel.program);
  if (
    !parsed.root ||
    parsed.meta.incomplete ||
    parsed.meta.unresolved.length ||
    parsed.meta.errors.some((error) => error.severity !== "warning") ||
    stateDefaultErrors(parsed.stateDeclarations).length ||
    parsed.queryStatements.length
  ) {
    throw new Error(
      "표 데이터를 평가하지 못했습니다. JSON 또는 PDF로 내용을 확인하세요.",
    );
  }
  const values = { ...parsed.stateDeclarations, ...panel.ui_state };
  const errors: OpenUIError[] = [];
  const root = evaluateRoot(parsed, {
    ctx: {
      getState: (name) => values[name],
      resolveRef: () => undefined,
      functions,
      actions: schema.actions,
    },
    library: dashboardLibrary,
    store: null,
    errors,
  });
  if (errors.length)
    throw new Error("표 계산 중 오류가 발생했습니다. 원본 패널을 확인하세요.");
  const tables: ExportTable[] = [];
  const visit = (value: unknown, inheritedSources: string[] = []) => {
    if (Array.isArray(value))
      return value.forEach((child) => visit(child, inheritedSources));
    if (!element(value)) return;
    const localSources = Array.isArray(value.props.sources)
      ? value.props.sources.flatMap((source: unknown) =>
          source &&
          typeof source === "object" &&
          "url" in source &&
          typeof source.url === "string"
            ? [source.url]
            : [],
        )
      : [];
    const sources = [...new Set([...inheritedSources, ...localSources])];
    const sourceProps = sources.length ? { sources } : {};
    const chart = extractChart(value);
    if (chart) {
      tables.push({ ...sourceProps, ...chart });
    } else if (value.typeName === "Table") {
      const columns = (value.props.columns as unknown[]).filter(element);
      const data = columns.map((column) =>
        Array.isArray(column.props.data) ? column.props.data : [],
      );
      const length = Math.max(0, ...data.map((column) => column.length));
      tables.push({
        ...sourceProps,
        columns: columns.map((column) => String(column.props.label)),
        rows: Array.from({ length }, (_, row) =>
          data.map((column) => column[row] ?? ""),
        ),
      });
    } else if (value.typeName === "IuiTable") {
      tables.push({
        ...sourceProps,
        columns: (value.props.columns as unknown[]).map(String),
        rows: value.props.rows as unknown[][],
      });
    } else {
      Object.values(value.props).forEach((child) => visit(child, sources));
    }
  };
  visit(root);
  return tables;
}

export function extractTables(panel: Panel): ExportTable[] {
  return extractDataBlocks(panel).filter((block) => !block.visualization);
}

export function exportCellValue(value: unknown): unknown {
  if (!element(value)) return value;
  const props = value.props;
  // Preserve visible text and link targets rather than serializing component code.
  return [
    props.text ?? props.value ?? props.label ?? props.children ?? "",
    props.href ?? props.url ?? "",
  ]
    .map((part) =>
      Array.isArray(part) ? part.map(exportCellValue).join(" ") : String(part),
    )
    .filter(Boolean)
    .join(" ");
}
