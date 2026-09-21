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
  useEffect(() => {
    // A new document starts visible; do not remember a prior document's closed state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClosedFor(null);
  }, [revealKey]);
  const detailId = useId();
  const openButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const desktop = useSyncExternalStore(subscribe, getDesktop, () => true);
  return (
    <ResizablePanelGroup
      className={`workspace${detailOpen ? "" : " workspace-detail-closed"}`}
      orientation="horizontal"
      disabled={!desktop || !detailOpen}
      style={{
        display: desktop ? "flex" : "block",
        overflow: "visible",
        height: "auto",
      }}
    >
      <ResizablePanel
        id="canvas"
        defaultSize="42.5%"
        minSize={desktop ? "300px" : "0%"}
        style={{ overflow: "visible", display: "block", maxHeight: "none" }}
      >
        {!detailOpen && (
          <div className="panel-toolbar">
            <Button
              variant="ghost"
              size="sm"
              aria-controls={detailId}
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
        style={{ overflow: "visible", display: "block", maxHeight: "none" }}
      >
        <div id={detailId}>
          <div className="panel-toolbar">
            <Button
              variant="ghost"
              size="sm"
              aria-controls={detailId}
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
  );
}
