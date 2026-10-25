"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactGridLayout, {
  useContainerWidth,
  noCompactor,
  type Layout,
} from "react-grid-layout";
import { CANVAS_MIME, type Dashboard } from "@/entities/dashboard";
import { command, addArtifact, useDashboard } from "../model/store";
import { parseCanvasDrag } from "../model/drag";
import { CanvasToolbar } from "./canvas-toolbar";
import { CanvasTabs } from "./canvas-tabs";
import { CanvasPanelContents } from "./canvas-panel";
import { displayLayouts, dropPosition } from "../model/grid";
import { downloadDashboard } from "../model/export";

export function Canvas({
  threadId,
  state,
}: {
  threadId: string;
  state: Dashboard;
}) {
  const { width, containerRef, mounted } = useContainerWidth();
  const [busy, setBusy] = useState(false);
  const [gestureVersion, setGestureVersion] = useState(0);
  const gestureActive = useRef(false);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !gestureActive.current) return;
      event.preventDefault();
      gestureActive.current = false;
      // Unmount the grid's transient drag/resize state and document listeners.
      // The authoritative layout has not been saved yet.
      setGestureVersion((version) => version + 1);
    };
    document.addEventListener("keydown", cancel, true);
    return () => document.removeEventListener("keydown", cancel, true);
  }, []);
  const error = useDashboard((s) => s.errors[threadId]);
  const mutate = useCallback(
    async (
      action: string,
      id: string | null = null,
      payload: Record<string, unknown> = {},
    ) => {
      setBusy(true);
      try {
        await command(threadId, action, id, payload);
      } catch {
        /* Notice is retained in store. */
      } finally {
        setBusy(false);
      }
    },
    [threadId],
  );
  const narrow = width < 600;
  const panels = state.panels.filter((p) => p.tab_id === state.active_tab_id);
  const persistLayout = (layout: Layout) => {
    if (narrow || !gestureActive.current) return;
    gestureActive.current = false;
    void mutate("layout", null, {
      layouts: layout.map((p) => ({
        id: p.i,
        layout: { x: p.x, y: p.y, w: p.w, h: p.h },
      })),
    });
  };
  const dropOnTab = async (
    raw: string,
    tabId: string,
    position?: { x: number; y: number },
  ) => {
    try {
      const data = parseCanvasDrag(raw, threadId);
      if (data.type === "panel") {
        const panel = state.panels.find((item) => item.id === data.panelId);
        if (!panel || panel.pinned) throw new Error("Panel not movable");
        await command(threadId, "update", panel.id, { tab_id: tabId });
        await command(threadId, "select", panel.id);
      } else {
        const artifact = state.artifacts.find(
          (item) => item.id === data.artifactId,
        );
        if (!artifact) throw new Error("Unknown artifact");
        await addArtifact(
          threadId,
          { ...artifact, ui_state: data.uiState ?? artifact.ui_state },
          {
            tabId,
            position: position
              ? {
                  x: Math.min(position.x, 24 - artifact.layout.w),
                  y: position.y,
                }
              : undefined,
          },
        );
      }
    } catch {
      useDashboard
        .getState()
        .notice(
          threadId,
          "현재 대화의 이동 가능한 패널이나 완료된 결과만 추가할 수 있습니다.",
        );
    }
  };
  return (
    <section className="canvas-pane" aria-label="Canvas dashboard">
      <CanvasToolbar state={state} threadId={threadId} mutate={mutate} />
      <CanvasTabs
        state={state}
        busy={busy}
        mutate={mutate}
        dropOnTab={dropOnTab}
      />
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {state.export_request && (
        <div className="notice">
          전체 Canvas를 내보낼 준비가 되었습니다.{" "}
          <button
            onClick={() =>
              state.export_request?.format === "print"
                ? window.open(`/print?thread=${threadId}`, "_blank")
                : downloadDashboard(
                    state,
                    state.export_request?.format ?? "json",
                  )
            }
          >
            다운로드 실행
          </button>
        </div>
      )}
      <div
        ref={containerRef}
        className="canvas-grid"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes(CANVAS_MIME))
            event.preventDefault();
        }}
        onDrop={(event) => {
          const raw = event.dataTransfer.getData(CANVAS_MIME);
          if (!raw) return;
          event.preventDefault();
          const grid =
            event.currentTarget.querySelector(".react-grid-layout") ??
            event.currentTarget;
          const bounds = grid.getBoundingClientRect();
          const position = dropPosition(
            event.clientX - bounds.left,
            event.clientY - bounds.top,
            bounds.width,
          );
          void dropOnTab(raw, state.active_tab_id, position);
        }}
      >
        {!panels.length && (
          <div className="canvas-empty">
            <span className="grid-symbol">▦</span>
            <h3>생각을 모으는 공간</h3>
            <p>대화에서 얻은 차트와 요약을 여기에 담으세요.</p>
            <p>“매출 그래프를 Canvas에 추가해줘”</p>
            <span>드래그 · 크기 조절 · 위치 고정 · 내보내기</span>
          </div>
        )}
        {mounted && (
          <ReactGridLayout
            key={`${threadId}:${state.active_tab_id}:${gestureVersion}`}
            onDragStart={() => {
              gestureActive.current = true;
            }}
            onResizeStart={() => {
              gestureActive.current = true;
            }}
            width={width}
            layout={displayLayouts(panels, narrow)}
            gridConfig={{
              cols: 24,
              rowHeight: 28,
              margin: [12, 12],
              containerPadding: [0, 0],
            }}
            compactor={noCompactor}
            dragConfig={{ enabled: !busy && !narrow, handle: ".panel-grip" }}
            resizeConfig={{ enabled: !busy && !narrow, handles: ["se"] }}
            onDragStop={persistLayout}
            onResizeStop={persistLayout}
          >
            {panels.map((panel) => (
              <div
                key={panel.id}
                id={`panel-${panel.id}`}
                className={`dashboard-panel ${state.selected_panel_id === panel.id ? "selected" : ""}`}
                data-panel-id={panel.id}
              >
                <CanvasPanelContents
                  panel={panel}
                  threadId={threadId}
                  tabs={state.tabs}
                  narrow={narrow}
                  busy={busy}
                  mutate={mutate}
                />
              </div>
            ))}
          </ReactGridLayout>
        )}
      </div>
    </section>
  );
}
