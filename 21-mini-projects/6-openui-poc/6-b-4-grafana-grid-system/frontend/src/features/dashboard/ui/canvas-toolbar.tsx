"use client";
import { dashboardSchema, type Dashboard } from "@/entities/dashboard";
import { useDashboard, type DashboardMutation } from "../model/store";
import { downloadDashboard } from "../model/export";
export function CanvasToolbar({
  state,
  threadId,
  mutate,
}: {
  state: Dashboard;
  threadId: string;
  mutate: DashboardMutation;
}) {
  return (
    <header className="canvas-header">
      <div>
        <span className="eyebrow">YOUR RESEARCH SPACE</span>
        <h2>
          Canvas <small>{state.panels.length} panels</small>
        </h2>
      </div>
      <div className="export-buttons">
        <label className="import-control">
          가져오기
          <input
            type="file"
            accept="application/json,.json"
            aria-label="Canvas JSON 가져오기"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 5_000_000)
                  throw new Error("5MB 이하 파일만 가져올 수 있습니다.");
                const json = JSON.parse(await file.text());
                if (json.schema_version !== 1)
                  throw new Error("지원하지 않는 저장 버전입니다.");
                const incoming = dashboardSchema.parse(json.dashboard);
                await mutate("import", null, {
                  tabs: incoming.tabs,
                  panels: incoming.panels,
                });
              } catch (e) {
                useDashboard.getState().notice(threadId, (e as Error).message);
              }
              event.target.value = "";
            }}
          />
        </label>
        <button onClick={() => downloadDashboard(state, "json")}>JSON</button>
        <button onClick={() => downloadDashboard(state, "csv")}>CSV</button>
        <button
          onClick={() => window.open(`/print?thread=${threadId}`, "_blank")}
        >
          PDF / 인쇄
        </button>
      </div>
    </header>
  );
}
