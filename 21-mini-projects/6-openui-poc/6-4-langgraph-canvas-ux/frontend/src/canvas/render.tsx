"use client";
import {
  createContext,
  useContext,
  useCallback,
  useState,
  Component,
  type ReactNode,
} from "react";
import {
  createParser,
  defineComponent,
  Renderer,
  type ActionEvent,
  type OpenUIError,
} from "@openuidev/react-lang";
import { z } from "zod";
import { library } from "@/lib/library";
import { Chart } from "@/lib/components/chart";
import { runLibraryAction } from "@/lib/actions";
import { webUrl } from "@/lib/components/style";
import type { Snapshot, Widget } from "./model";

const formatCell = (value: string | number | null | undefined) =>
  typeof value === "number"
    ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : String(value ?? "—");
const DataContext = createContext<Snapshot | undefined>(undefined);
export function DataTable({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="data-table">
      <table>
        <thead>
          <tr>
            {snapshot.columns.map((c) => (
              <th key={c.name}>{c.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {snapshot.rows.map((row, index) => (
            <tr key={index}>
              {snapshot.columns.map((c) => (
                <td key={c.name}>{formatCell(row[c.name])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const CanvasData = defineComponent({
  name: "CanvasData",
  description:
    "Render the host-owned, validated query snapshot without rerunning an LLM. bindingId identifies the widget data binding.",
  props: z.object({
    bindingId: z.string(),
    type: z.enum(["bar", "line", "pie", "table"]),
  }),
  component: function BoundData({ props, renderNode }) {
    const snapshot = useContext(DataContext);
    if (!snapshot) return <p>조회 결과가 아직 없습니다.</p>;
    if (!snapshot.rows.length)
      return (
        <p className="empty-result">이 조건에 해당하는 데이터가 없습니다.</p>
      );
    const x =
      snapshot.columns.find((c) =>
        snapshot.rows.some((r) => typeof r[c.name] === "string"),
      )?.name ?? snapshot.columns[0].name;
    const series = snapshot.columns
      .filter(
        (c) =>
          c.name !== x &&
          snapshot.rows.some((r) => typeof r[c.name] === "number"),
      )
      .map((c) => c.name);
    const hasNull = snapshot.rows.some((r) =>
      series.some((s) => r[s] === null),
    );
    const ChartView = Chart.component;
    return (
      <div data-testid="bound-data" data-version={snapshot.dataVersion}>
        {props.type === "table" || hasNull || !series.length ? (
          <DataTable snapshot={snapshot} />
        ) : (
          <ChartView
            props={{
              type: props.type,
              data: snapshot.rows as Record<string, string | number>[],
              x,
              series,
              height: 220,
            }}
            renderNode={renderNode}
          />
        )}
      </div>
    );
  },
});
export const canvasLibrary = library.extend({
  components: { add: [CanvasData] },
});
const parser = createParser(canvasLibrary.toJSONSchema(), canvasLibrary.root);
export function validateProgram(program: string) {
  const parsed = parser.parse(program);
  const errors = parsed.meta.errors.filter((e) => e.severity !== "warning");
  if (!parsed.root || errors.length || parsed.meta.unresolved.length)
    throw new Error(
      "OpenUI 응답을 검증하지 못했습니다. 기존 위젯을 유지합니다.",
    );
  return parsed;
}
class RenderBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <p role="alert">위젯을 표시하지 못했습니다. 저장된 원본은 유지됩니다.</p>
    ) : (
      this.props.children
    );
  }
}

export function WidgetRenderer({
  widget,
  streaming = false,
  onState,
  onPrompt,
}: {
  widget: Widget;
  streaming?: boolean;
  onState?: (state: Record<string, unknown>) => void;
  onPrompt?: (text: string) => void;
}) {
  const [error, setError] = useState("");
  const onError = useCallback(
    (errors: OpenUIError[]) =>
      setError(
        errors
          .filter((e) => e.severity !== "warning")
          .map((e) => e.message)
          .join("; "),
      ),
    [],
  );
  const onAction = useCallback(
    (event: ActionEvent) => {
      if (event.type === "continue_conversation")
        onPrompt?.(
          event.humanFriendlyMessage || String(event.params?.message ?? ""),
        );
      else if (event.type === "open_url") {
        const url = webUrl(String(event.params?.url ?? ""));
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      } else void runLibraryAction(event);
    },
    [onPrompt],
  );
  return (
    <RenderBoundary>
      <DataContext.Provider value={widget.snapshot}>
        <Renderer
          response={widget.program}
          library={canvasLibrary}
          isStreaming={streaming}
          initialState={widget.uiState}
          onStateUpdate={onState}
          onAction={onAction}
          onError={onError}
        />
        {error && !streaming && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </DataContext.Provider>
    </RenderBoundary>
  );
}
