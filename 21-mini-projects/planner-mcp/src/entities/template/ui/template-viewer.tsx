"use client";
import { useEffect, useId, useState, type ComponentType } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

function MermaidBlock({ source }: { source: string }) {
  const id = `template-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [result, setResult] = useState({ source: "", svg: "", error: "" });
  useEffect(() => {
    let active = true;
    void import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          suppressErrorRendering: true,
        });
        const { svg } = await mermaid.render(id, source);
        if (active) setResult({ source, svg, error: "" });
      })
      .catch(() => {
        if (active)
          setResult({ source, svg: "", error: "Mermaid 문법을 확인하세요." });
      });
    return () => {
      active = false;
    };
  }, [source, id]);
  return (
    <div aria-label="Mermaid 다이어그램" className="template-diagram">
      {result.source !== source ? (
        <p role="status">다이어그램 그리는 중…</p>
      ) : result.error ? (
        <p role="alert">{result.error}</p>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: result.svg }} />
      )}
      <details>
        <summary>Mermaid 원문</summary>
        <pre>{source}</pre>
      </details>
    </div>
  );
}

export function MarkdownView({ source }: { source: string }) {
  if (!source.trim()) return <p className="muted">미리 볼 내용이 없습니다.</p>;
  return (
    <div className="markdown-view">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          pre({ children, node }) {
            const code = node?.children[0];
            if (
              code?.type === "element" &&
              code.tagName === "code" &&
              Array.isArray(code.properties.className) &&
              code.properties.className.includes("language-mermaid")
            ) {
              const source = code.children
                .filter((child) => child.type === "text")
                .map((child) => child.value)
                .join("");
              return <MermaidBlock source={source} />;
            }
            return <pre>{children}</pre>;
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {source}
      </Markdown>
    </div>
  );
}

// Add a renderer here together with its accepted model format when introducing a new view.
const viewers: Record<string, ComponentType<{ source: string }>> = {
  markdown: MarkdownView,
};
export function TemplateViewer({
  format,
  source,
}: {
  format: string;
  source: string;
}) {
  const Viewer = viewers[format];
  return Viewer ? (
    <Viewer source={source} />
  ) : (
    <p role="alert">지원하지 않는 표시 형식입니다: {format}</p>
  );
}
