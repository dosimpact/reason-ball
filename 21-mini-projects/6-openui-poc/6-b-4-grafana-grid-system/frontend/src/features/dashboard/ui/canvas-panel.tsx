"use client";
import { useCallback } from "react";
import {
  CANVAS_MIME,
  PanelContent,
  type Dashboard,
  type Panel,
} from "@/entities/dashboard";
import { command, useDashboard, type DashboardMutation } from "../model/store";
import { keyboardLayout } from "../model/grid";
import { RefreshControls } from "./refresh-controls";

export function CanvasPanelContents({
  panel,
  threadId,
  tabs,
  narrow,
  busy,
  mutate,
}: {
  panel: Panel;
  threadId: string;
  tabs: Dashboard["tabs"];
  narrow: boolean;
  busy: boolean;
  mutate: DashboardMutation;
}) {
  return (
    <>
      <header>
        <button
          className="panel-grip"
          disabled={panel.pinned || narrow || busy}
          onKeyDown={(event) => {
            const layout = keyboardLayout(
              panel.layout,
              event.key,
              event.shiftKey,
            );
            if (!layout) return;
            event.preventDefault();
            void mutate("layout", panel.id, {
              layouts: [{ id: panel.id, layout }],
            });
          }}
          aria-label={`${panel.title} 이동`}
          title="드래그 또는 방향키로 이동 · Shift+방향키로 크기 조절"
        >
          ⠿
        </button>
        <button
          draggable={!panel.pinned}
          disabled={panel.pinned || busy}
          aria-label={`${panel.title} 다른 탭으로 드래그`}
          title="탭 버튼으로 드래그"
          onDragStart={(event) => {
            event.stopPropagation();
            event.dataTransfer.setData(
              CANVAS_MIME,
              JSON.stringify({
                version: 1,
                threadId,
                type: "panel",
                panelId: panel.id,
              }),
            );
            event.dataTransfer.effectAllowed = "move";
          }}
        >
          ↗
        </button>
        <button
          className="panel-title"
          onClick={() => void mutate("select", panel.id)}
        >
          {panel.title}
        </button>
        <button
          aria-label={`${panel.title} ${panel.pinned ? "고정 해제" : "고정"}`}
          onClick={() =>
            void mutate("pin", panel.id, { pinned: !panel.pinned })
          }
        >
          {panel.pinned ? "◆" : "◇"}
        </button>
        <button
          aria-label={`${panel.title} 삭제`}
          onClick={() => void mutate("remove", panel.id)}
        >
          ×
        </button>
      </header>
      <div className="panel-body">
        {panel.kind === "financial" && (
          <RefreshControls panel={panel} threadId={threadId} />
        )}
        <PersistentContent panel={panel} threadId={threadId} />
      </div>
      <footer>
        <span>
          {panel.kind === "financial" ? "SEC · Annual data" : "OpenUI"}
        </span>
        <select
          aria-label={`${panel.title} 탭 이동`}
          disabled={panel.pinned || busy}
          value={panel.tab_id}
          onChange={(event) =>
            void mutate("update", panel.id, {
              tab_id: event.target.value,
            })
          }
        >
          {tabs.map((tab) => (
            <option value={tab.id} key={tab.id}>
              {tab.title}
            </option>
          ))}
        </select>
        {(["w", "h"] as const).map((dimension) => (
          <label key={dimension}>
            {dimension === "w" ? "너비" : "높이"}
            <select
              aria-label={`${panel.title} ${dimension === "w" ? "너비" : "높이"}`}
              disabled={panel.pinned || busy || (narrow && dimension === "w")}
              value={panel.layout[dimension]}
              onChange={(event) =>
                void mutate("layout", panel.id, {
                  layouts: [
                    {
                      id: panel.id,
                      layout: {
                        ...panel.layout,
                        [dimension]: Number(event.target.value),
                      },
                    },
                  ],
                })
              }
            >
              {Array.from(
                { length: dimension === "w" ? 21 : 37 },
                (_, i) => i + 4,
              ).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button
          disabled={panel.pinned}
          aria-label={`${panel.title} 위로 이동`}
          onClick={() =>
            void mutate("layout", panel.id, {
              layouts: [
                {
                  id: panel.id,
                  layout: {
                    ...panel.layout,
                    y: Math.max(0, panel.layout.y - 4),
                  },
                },
              ],
            })
          }
        >
          ↑
        </button>
      </footer>
    </>
  );
}
function PersistentContent({
  panel,
  threadId,
}: {
  panel: Panel;
  threadId: string;
}) {
  const save = useCallback(
    (value: Record<string, unknown>) => {
      const current = useDashboard
        .getState()
        .documents[threadId]?.panels.find((p) => p.id === panel.id);
      if (
        !current ||
        JSON.stringify(value) === JSON.stringify(current.ui_state)
      )
        return;
      void command(threadId, "ui_state", panel.id, value).catch(() => {});
    },
    [panel.id, threadId],
  );
  return <PanelContent panel={panel} onStateUpdate={save} />;
}
