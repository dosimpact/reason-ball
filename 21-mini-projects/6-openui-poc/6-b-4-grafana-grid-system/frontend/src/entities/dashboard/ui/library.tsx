"use client";
import { artifactIdsFromRoot } from "../model/program-validation";
import { createContext, useContext, useState, useRef } from "react";
import {
  createParser,
  defineComponent,
  defineFunction,
  defineAction,
  Renderer,
  type ActionEvent,
} from "@openuidev/react-lang";
import { z } from "zod";
import { library as baseLibrary, runLibraryAction } from "@/shared/ui/openui";
import { stateDefaultErrors } from "../model/program-validation";
import type { Panel } from "../model/types";

// registry는 개발자가 소유합니다. 전송 payload로 실행 코드나 라이브러리를 등록하지 않습니다.
export const ArtifactContext = createContext<{
  threadId: string | null;
  artifacts: Panel[];
  add: (panel: Panel) => void;
  focus: (id: string) => void;
}>({ threadId: null, artifacts: [], add: () => {}, focus: () => {} });
export const CANVAS_MIME = "application/x-openui-canvas";
export const YearOverYear = defineFunction({
  name: "YearOverYear",
  description:
    "Percent change from prior to current. Returns null when prior is zero; for explicit user assumptions, not missing report values.",
  params: z.object({ current: z.number(), prior: z.number() }),
  returns: z.number().nullable(),
  fn: ({ current, prior }) =>
    prior === 0 ? null : (current / prior - 1) * 100,
});
export const FocusPanel = defineAction({
  name: "FocusPanel",
  description: "Focus an existing dashboard panel by its real panel ID.",
  params: z.object({ panelId: z.string() }),
});
const contentLibrary = baseLibrary.extend({
  functions: { add: [YearOverYear] },
  actions: { add: [FocusPanel] },
});
const parser = createParser(contentLibrary.toJSONSchema(), contentLibrary.root);
export function validateProgram(program: string) {
  const parsed = parser.parse(program);
  if (
    !parsed.root ||
    parsed.meta.incomplete ||
    stateDefaultErrors(parsed.stateDeclarations).length ||
    parsed.meta.unresolved.length ||
    parsed.meta.errors.some((e) => e.severity !== "warning")
  )
    throw new Error("OpenUI 형식을 확인하지 못했습니다. 원본은 보존됩니다.");
  return program;
}
export function PanelContent({
  panel,
  onStateUpdate,
}: {
  panel: Panel;
  onStateUpdate?: (state: Record<string, unknown>) => void;
}) {
  const host = useContext(ArtifactContext);
  const [error, setError] = useState({ program: "", message: "" });
  const program =
    panel.kind === "financial" ? financialProgram(panel) : panel.program;
  let validation = "";
  try {
    validateProgram(program);
  } catch (e) {
    validation = (e as Error).message;
  }
  const onAction = (event: ActionEvent) => {
    if (event.type === "FocusPanel") {
      host.focus(String((event.params as { panelId: string }).panelId));
      return;
    }
    void runLibraryAction(event);
  };
  if (validation)
    return (
      <div role="alert">
        {validation}
        <details>
          <summary>보존된 내용 보기</summary>
          <pre>{program}</pre>
        </details>
      </div>
    );
  return (
    <>
      <Renderer
        library={contentLibrary}
        response={program}
        isStreaming={false}
        initialState={panel.ui_state}
        onStateUpdate={onStateUpdate}
        onAction={onAction}
        onError={(errors) =>
          setError({
            program,
            message: errors.map((e) => e.message).join(" · "),
          })
        }
      />
      {error.program === program && error.message && (
        <p role="status">{error.message}</p>
      )}
    </>
  );
}
function financialProgram(panel: Panel) {
  const rows = (panel.data.rows ?? []) as {
    period: string;
    value: number;
    unit: string;
    growth_percent: number | null;
    url: string;
  }[];
  const q = JSON.stringify;
  const sourcePeriods = new Map<string, string[]>();
  for (const row of rows)
    sourcePeriods.set(row.url, [
      ...(sourcePeriods.get(row.url) ?? []),
      row.period,
    ]);
  const sources = Array.from(sourcePeriods, ([url, periods]) => ({
    title: periods.join(", "),
    sourceName: "SEC annual observation",
    url,
  }));
  const missing = (panel.data.missing_years ?? []) as number[];
  const note = missing.length
    ? `, Callout("warning", "자료가 없는 연도", ${q(missing.join(", ") + ". 누락 수치는 0으로 채우지 않았습니다.")})`
    : "";
  return `root = Card([CardHeader(${q(panel.title)}, ${q("연간 기간 종료일 기준 · " + (rows[0]?.unit ?? ""))}), LineChart(${q(rows.map((r) => r.period))}, [Series("Value", ${q(rows.map((r) => r.value))})], "linear", "Period end", ${q(rows[0]?.unit ?? "Value")}), Table([Col("기간", ${q(rows.map((r) => r.period))}), Col("금액", ${q(rows.map((r) => r.value.toLocaleString()))}), Col("YoY", ${q(rows.map((r) => (r.growth_percent === null ? "—" : r.growth_percent.toFixed(2) + "%")))})])${note}], ${q(sources)})`;
}
export function ArtifactView({ id }: { id: string }) {
  const host = useContext(ArtifactContext);
  const panel = host.artifacts.find((p) => p.id === id);
  const currentInputs = useRef<Record<string, unknown> | null>(null);
  if (!panel) return <p role="status">분석 결과를 불러오는 중입니다.</p>;
  return (
    <section className="chat-artifact" data-testid="chat-artifact">
      <PanelContent
        panel={panel}
        onStateUpdate={(value) => {
          currentInputs.current = value;
        }}
      />
      <div className="artifact-actions">
        <button
          onClick={() =>
            host.add({
              ...panel,
              ui_state: currentInputs.current ?? panel.ui_state,
            })
          }
        >
          ＋ Canvas에 추가
        </button>
        <button
          draggable
          aria-label={`${panel.title} Canvas로 드래그`}
          onDragStart={(event) => {
            event.dataTransfer.setData(
              CANVAS_MIME,
              JSON.stringify({
                version: 1,
                threadId: host.threadId,
                type: "artifact",
                artifactId: id,
                uiState: currentInputs.current ?? panel.ui_state,
              }),
            );
            event.dataTransfer.effectAllowed = "copy";
          }}
        >
          ⠿ 드래그
        </button>
      </div>
    </section>
  );
}
export const DashboardArtifact = defineComponent({
  name: "DashboardArtifact",
  description:
    "Render an existing server-issued chat artifact with Add to Canvas and drag. Use ONLY an artifact_id returned by publish tools. Never invent an ID.",
  props: z.object({ artifactId: z.string() }),
  component: ({ props }) => <ArtifactView id={props.artifactId} />,
});
export const dashboardLibrary = contentLibrary.extend({
  components: {
    add: [{ component: DashboardArtifact, slots: ["Card.children"] }],
  },
});

const dashboardParser = createParser(
  dashboardLibrary.toJSONSchema(),
  dashboardLibrary.root,
);

// Only reachable nodes count; a bare expression after root is not a rendered artifact.
export function renderedArtifactIds(program: string): string[] {
  const root = dashboardParser.parse(program).root;
  return artifactIdsFromRoot(root);
}
