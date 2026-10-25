"use client";
import { CANVAS_MIME, type Dashboard } from "@/entities/dashboard";
import type { DashboardMutation } from "../model/store";
export function CanvasTabs({
  state,
  busy,
  mutate,
  dropOnTab,
}: {
  state: Dashboard;
  busy: boolean;
  mutate: DashboardMutation;
  dropOnTab: (raw: string, tabId: string) => Promise<void>;
}) {
  const panels = state.panels.filter((p) => p.tab_id === state.active_tab_id);
  return (
    <div className="canvas-tabs" role="tablist">
      {state.tabs.map((tab) => (
        <button
          role="tab"
          aria-selected={tab.id === state.active_tab_id}
          key={tab.id}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes(CANVAS_MIME))
              event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void dropOnTab(event.dataTransfer.getData(CANVAS_MIME), tab.id);
          }}
          onClick={() => void mutate("tab_select", null, { id: tab.id })}
          onDoubleClick={() => {
            const title = prompt("탭 이름", tab.title);
            if (title) void mutate("tab_rename", null, { id: tab.id, title });
          }}
        >
          {tab.title}
        </button>
      ))}
      <button
        aria-label="Canvas 탭 추가"
        onClick={() => {
          const title = prompt("새 탭 이름", "Research");
          if (title) void mutate("tab_add", null, { title });
        }}
      >
        ＋
      </button>
      {state.tabs.length > 1 && (
        <button
          disabled={busy}
          onClick={() => {
            const tab = state.tabs.find(
              (item) => item.id === state.active_tab_id,
            );
            if (
              !window.confirm(
                `“${tab?.title}” 탭${panels.length ? `과 포함된 패널 ${panels.length}개` : ""}를 삭제할까요? 다른 탭, 대화와 원본 결과는 유지됩니다.`,
              )
            )
              return;
            void mutate("tab_remove", null, {
              id: state.active_tab_id,
              remove_panels: panels.length > 0,
            });
          }}
        >
          현재 탭 삭제
        </button>
      )}
    </div>
  );
}
