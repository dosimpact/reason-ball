"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFrameDocument } from "../model/frameDocument";
import { factIdPattern, type ViewerFact, type ViewerMetadata } from "../model/types";

export function SourceFrame({ source, metadata, selected, onSelect, onWarning, moveRevision = 0 }: { source: string; metadata: ViewerMetadata; selected?: ViewerFact; onSelect: (factId: string) => void; onWarning: (message: string) => void; moveRevision?: number }) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const callbacks = useRef({ onSelect, onWarning }); callbacks.current = { onSelect, onWarning };
  const [ready, setReady] = useState(false);
  const frame = useMemo(() => { const channelId = crypto.randomUUID(); return { channelId, html: createFrameDocument(source, metadata.sourceHash, channelId, window.location.origin) }; }, [source, metadata.sourceHash, metadata.extractorVersion]);
  const send = useCallback((type: "sec-ixbrl:init" | "sec-ixbrl:focus", factId?: string) => {
    iframe.current?.contentWindow?.postMessage({ type, version: 1, channelId: frame.channelId, sourceHash: metadata.sourceHash, ...(factId ? { factId } : {}) }, "*");
  }, [frame.channelId, metadata.sourceHash]);
  useEffect(() => {
    setReady(false);
    const receive = (event: MessageEvent) => {
      if (event.source !== iframe.current?.contentWindow || event.origin !== "null") return;
      const data: unknown = event.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) return;
      const message = data as Record<string, unknown>;
      if (message.version !== 1 || message.channelId !== frame.channelId || message.sourceHash !== metadata.sourceHash) return;
      if (Object.keys(message).some(key => !["type", "version", "channelId", "sourceHash", "factId", "anchorCount"].includes(key))) return;
      if (message.type === "sec-ixbrl:ready" && typeof message.anchorCount === "number" && Number.isSafeInteger(message.anchorCount) && message.anchorCount >= 0 && message.factId === undefined) {
        setReady(true);
        if (metadata.visibleFacts > 0 && message.anchorCount === 0) callbacks.current.onWarning("원문 위치 표식을 찾지 못했습니다. fact 상세는 볼 수 있지만 원문 이동을 확인할 수 없습니다.");
      } else if ((message.type === "sec-ixbrl:select" || message.type === "sec-ixbrl:missing") && typeof message.factId === "string" && factIdPattern.test(message.factId) && message.anchorCount === undefined) {
        if (message.type === "sec-ixbrl:select") callbacks.current.onSelect(message.factId);
        else callbacks.current.onWarning("선택한 fact의 원문 위치를 찾지 못했습니다. 문서와 결과를 다시 불러오세요.");
      }
    };
    window.addEventListener("message", receive);
    return () => { window.removeEventListener("message", receive); };
  }, [frame, metadata.sourceHash, metadata.visibleFacts]);
  useEffect(() => { if (ready && selected && !selected.isHidden && selected.segments.length && factIdPattern.test(selected.factId)) send("sec-ixbrl:focus", selected.factId); }, [ready, selected, send, moveRevision]);
  return <div className="flex min-h-0 flex-1 flex-col"><p className="border-b px-3 py-2 text-xs text-muted-foreground">{ready ? "태그가 있는 값을 누르면 상세 정보를 표시합니다. 원문은 별도의 흰색 문서 영역으로 표시됩니다." : "정제된 원문을 연결하는 중…"}</p><iframe key={frame.channelId} ref={iframe} title="SEC iXBRL 원문" sandbox="allow-scripts" referrerPolicy="no-referrer" className="min-h-[55dvh] w-full flex-1 border-0 bg-white lg:min-h-0" srcDoc={frame.html} onLoad={() => send("sec-ixbrl:init")} /></div>;
}
