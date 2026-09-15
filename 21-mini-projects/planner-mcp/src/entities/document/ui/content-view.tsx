"use client";
import { useEffect, useId, useState } from "react";
import type {
  ApiSpec,
  LoggingSpec,
  FigmaSpec,
  PlannerDocument,
} from "../model/schema";

export function MermaidView({ source }: { source: string }) {
  const id = useId().replaceAll(":", "").replaceAll("_", ""),
    [rendered, setRendered] = useState({ source: "", svg: "", error: "" });
  useEffect(() => {
    let active = true;
    void import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          suppressErrorRendering: true,
        });
        const { svg } = await mermaid.render(`mermaid-${id}`, source);
        if (active) setRendered({ source, svg, error: "" });
      })
      .catch((e) => {
        if (active) setRendered({ source, svg: "", error: String(e) });
      });
    return () => {
      active = false;
    };
  }, [source, id]);
  return (
    <section aria-label="엔티티 다이어그램">
      {rendered.source !== source ? (
        <p>다이어그램 그리는 중…</p>
      ) : rendered.error ? (
        <p role="alert">Mermaid 문법 오류: {rendered.error}</p>
      ) : (
        <div
          className="diagram"
          dangerouslySetInnerHTML={{ __html: rendered.svg }}
        />
      )}
      <details>
        <summary>Mermaid 원문</summary>
        <pre>{source}</pre>
      </details>
    </section>
  );
}
function Fields({
  fields,
}: {
  fields: { name: string; description: string; type?: string }[];
}) {
  return fields.length ? (
    <table>
      <thead>
        <tr>
          <th>필드</th>
          <th>설명</th>
          <th>타입</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((f, i) => (
          <tr key={i}>
            <td>
              <code>{f.name}</code>
            </td>
            <td>{f.description}</td>
            <td>{f.type ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <p className="muted">필드 없음</p>
  );
}
export function ContentView({ document }: { document: PlannerDocument }) {
  if (document.type.endsWith("api-spec")) {
    const spec = document.content as ApiSpec;
    return (
      <section>
        <p>
          <span className="badge">
            {spec.specKind === "existing" ? "기존 스펙" : "변경 스펙"}
          </span>{" "}
          {spec.changeReason}
        </p>
        {spec.baseDocumentId && (
          <p>
            기준 문서 {spec.baseDocumentId} · r{spec.baseRevision}
          </p>
        )}
        {spec.operations.map((op) => (
          <article className="spec-card" key={op.id}>
            <h3>{op.name}</h3>
            <code className="endpoint">
              {op.method ?? op.protocol.toUpperCase()} {op.address}
            </code>
            <h4>입력</h4>
            <Fields fields={op.input} />
            <h4>출력</h4>
            <Fields fields={op.output} />
            {!!op.errors.length && (
              <>
                <h4>오류</h4>
                <Fields fields={op.errors} />
              </>
            )}
          </article>
        ))}
      </section>
    );
  }
  if (document.type === "db-entity")
    return (
      <MermaidView source={(document.content as { mermaid: string }).mermaid} />
    );
  if (document.type === "weblogging-spec")
    return (
      <section>
        {(document.content as LoggingSpec).events.map((event) => (
          <article className="spec-card" key={event.id}>
            <h3>
              {event.eventName} <span className="badge">{event.trigger}</span>
            </h3>
            <p>{event.condition}</p>
            <Fields fields={event.fields} />
          </article>
        ))}
      </section>
    );
  if (document.type === "figma-requirements")
    return (
      <section>
        {(document.content as FigmaSpec).widgets.map((widget) => (
          <article className="spec-card" key={widget.widgetId}>
            <h3>
              {widget.name} <span className="badge">widget</span>
            </h3>
            <p>{widget.responsibility}</p>
            <div className="figma-links">
              {widget.figmaRefs.map((ref, i) => (
                <a key={i} href={ref.url} target="_blank" rel="noreferrer">
                  ↗ {ref.screenName}
                  {ref.nodeId ? ` · ${ref.nodeId}` : ""}
                </a>
              ))}
            </div>
            <h4>UI Surface</h4>
            <ul>
              {widget.surfaces.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <h4>입력 검증</h4>
            <table>
              <tbody>
                {widget.inputValidation.map((v, i) => (
                  <tr key={i}>
                    <th>{v.input}</th>
                    <td>{v.rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h4>UI Funnel</h4>
            <ol className="funnel">
              {widget.funnel.map((f, i) => (
                <li key={i}>
                  {f.action} <span>→</span> {f.destination}
                </li>
              ))}
            </ol>
            {widget.states.map((s, i) => (
              <p key={i}>
                <strong>{s.name}</strong> {s.description}
              </p>
            ))}
          </article>
        ))}
      </section>
    );
  return null;
}
