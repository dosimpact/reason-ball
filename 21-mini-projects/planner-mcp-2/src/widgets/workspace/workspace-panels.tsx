"use client";
import {
  useSyncExternalStore,
  useState,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { Button } from "@/shared/ui/button";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "../../shared/ui/resizable";
const desktopQuery = "(min-width: 1001px)";
function subscribe(onChange: () => void) {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function getDesktop() {
  return window.matchMedia(desktopQuery).matches;
}
export function WorkspacePanels({
  canvas,
  detail,
  revealKey = "",
}: {
  canvas: ReactNode;
  detail: ReactNode;
  revealKey?: string;
}) {
  const [closedFor, setClosedFor] = useState<string | null>(null);
  const detailOpen = closedFor !== revealKey;
  const [mobileView, setMobileView] = useState<"canvas" | "detail">(
    revealKey ? "detail" : "canvas",
  );
  useEffect(() => {
    // A new document starts visible; do not remember a prior document's closed state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClosedFor(null);
    if (revealKey) setMobileView("detail");
  }, [revealKey]);
  const detailId = useId();
  const canvasRegionId = `${detailId}-canvas`;
  const detailRegionId = `${detailId}-detail`;
  const openButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const desktop = useSyncExternalStore(subscribe, getDesktop, () => true);
  return (
    <div className="workspace-shell">
      <div
        className="mobile-workspace-tabs"
        role="tablist"
        aria-label="작업 공간 보기"
      >
        <Button
          variant="ghost"
          role="tab"
          aria-selected={mobileView === "canvas"}
          aria-controls={canvasRegionId}
          onClick={() => setMobileView("canvas")}
        >
          문서 목록
        </Button>
        <Button
          variant="ghost"
          role="tab"
          aria-selected={mobileView === "detail"}
          aria-controls={detailRegionId}
          onClick={() => setMobileView("detail")}
        >
          문서 상세
        </Button>
      </div>
      <ResizablePanelGroup
        className={`workspace mobile-view-${mobileView}${
          desktop && !detailOpen ? " workspace-detail-closed" : ""
        }`}
        orientation="horizontal"
        disabled={!desktop || !detailOpen}
        style={{
          display: desktop ? "flex" : "block",
          overflow: desktop ? "hidden" : "visible",
          height: desktop ? "100%" : "auto",
        }}
      >
        <ResizablePanel
          id="canvas"
          defaultSize="42.5%"
          minSize={desktop ? "300px" : "0%"}
          style={{
            overflow: desktop ? "hidden" : "visible",
            display: "block",
            height: desktop ? "100%" : "auto",
          }}
        >
          <div
            id={canvasRegionId}
            role="tabpanel"
            className="workspace-panel-scroll"
            aria-label="캔버스 패널"
          >
            {!detailOpen && (
              <div className="panel-toolbar desktop-panel-toolbar">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-controls={detailRegionId}
                  aria-expanded={false}
                  ref={openButton}
                  onClick={() => {
                    setClosedFor(null);
                    requestAnimationFrame(() => closeButton.current?.focus());
                  }}
                >
                  상세 패널 열기
                </Button>
              </div>
            )}
            {canvas}
          </div>
        </ResizablePanel>
        <ResizableHandle
          withHandle
          aria-label="캔버스와 상세 패널 크기 조절"
          title="드래그하거나 방향키로 패널 크기를 조절하세요"
        />
        <ResizablePanel
          id="detail"
          defaultSize="57.5%"
          minSize={desktop ? "340px" : "0%"}
          style={{
            overflow: desktop ? "hidden" : "visible",
            display: "block",
            height: desktop ? "100%" : "auto",
          }}
        >
          <div
            id={detailRegionId}
            role="tabpanel"
            className="workspace-panel-scroll"
            aria-label="상세 패널"
          >
            <div id={detailId} className="panel-toolbar desktop-panel-toolbar">
              <Button
                variant="ghost"
                size="sm"
                aria-controls={detailRegionId}
                aria-expanded={true}
                ref={closeButton}
                onClick={() => {
                  setClosedFor(revealKey);
                  requestAnimationFrame(() => openButton.current?.focus());
                }}
              >
                상세 패널 닫기
              </Button>
            </div>
            {detail}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
