"use client";
import { useEffect, useId, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChecklistItem, Document } from "./model";
function Mermaid({ source }: { source: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [result, setResult] = useState({ svg: "", error: "" });
  useEffect(() => {
    let cancelled = false;
    import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          suppressErrorRendering: true,
        });
        const { svg } = await mermaid.render(`mermaid${id}`, source);
        if (!cancelled) setResult({ svg, error: "" });
      })
      .catch(() => {
        if (!cancelled)
          setResult({ svg: "", error: "Mermaid 문법을 확인하세요." });
      });
    return () => {
      cancelled = true;
    };
  }, [source, id]);
  return result.error ? (
    <p role="alert">{result.error}</p>
  ) : (
    <div className="mermaid" dangerouslySetInnerHTML={{ __html: result.svg }} />
  );
}
export function MarkdownView({ body }: { body: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            return className === "language-mermaid" ? (
              <Mermaid source={String(children)} />
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
export function ChecklistView({
  items,
  onConfirm,
  onReopen,
  busy = false,
}: {
  items: ChecklistItem[];
  onConfirm?: (item: ChecklistItem) => void;
  onReopen?: (item: ChecklistItem) => void;
  busy?: boolean;
}) {
  return (
    <div className="checklist">
      {items.length === 0 ? (
        <p className="muted">검증 항목이 없습니다.</p>
      ) : (
        items.map((item) => (
          <div className="check-row" key={item.id}>
            <div>
              <strong>{item.label}</strong>
              <span className={`badge ${item.aiResult}`}>
                AI: {item.aiResult}
              </span>
            </div>
            <label>
              <input
                type="checkbox"
                checked={item.humanConfirmed}
                disabled={busy || !onConfirm}
                onChange={() => onConfirm?.(item)}
              />{" "}
              사람 확인
            </label>
            {onReopen && (
              <button
                disabled={busy}
                onClick={() => onReopen(item)}
                aria-label={`${item.label} 재검증`}
              >
                재검증
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
export function OverviewTree({
  entries,
  onOpen,
  parentId = null,
}: {
  entries: Document["overview"];
  onOpen?: (id: string) => void;
  parentId?: string | null;
}) {
  return (
    <ul className="overview-tree">
      {entries
        .filter((e) => e.parentId === parentId)
        .map((e) => (
          <li key={e.id}>
            <details open>
              <summary>{e.title}</summary>
              <p>
                <b>What</b> {e.what}
              </p>
              <p>
                <b>How to</b> {e.how}
              </p>
              {e.verificationDocumentId && (
                <button onClick={() => onOpen?.(e.verificationDocumentId!)}>
                  검증 방법 보기
                </button>
              )}
              <OverviewTree entries={entries} parentId={e.id} onOpen={onOpen} />
            </details>
          </li>
        ))}
    </ul>
  );
}
