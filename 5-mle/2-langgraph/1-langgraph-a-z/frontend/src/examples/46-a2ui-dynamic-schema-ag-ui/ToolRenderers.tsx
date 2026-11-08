import { isPlainObject, isString } from "remeda";
import { Columns3, FileWarning, LayoutTemplate, ListChecks } from "lucide-react";
import { z } from "zod";
import { type JsonRecord, records, parseResult, generateDynamicSchemaParameters } from "./model";

export function DynamicNode({ node }: { node: JsonRecord }) {
  const type = isString(node.type) ? node.type : "unknown";

  if (type === "comparison") {
    return (
      <section className="dynamic-a2ui-node">
        <div className="dynamic-a2ui-node-title">
          <Columns3 size={16} aria-hidden="true" />
          <strong>{String(node.title ?? "Comparison")}</strong>
        </div>
        <div className="dynamic-a2ui-comparison">
          {records(node.options).map((option) => (
            <article key={String(option.id ?? option.label)}>
              <strong>{String(option.label ?? "Option")}</strong>
              <span>{String(option.price ?? "")}</span>
              <p>{String(option.fit ?? "")}</p>
              <meter min={0} max={100} value={Number(option.score ?? 0)} />
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (type === "form") {
    return (
      <section className="dynamic-a2ui-node">
        <div className="dynamic-a2ui-node-title">
          <LayoutTemplate size={16} aria-hidden="true" />
          <strong>{String(node.title ?? "Form")}</strong>
        </div>
        <div className="dynamic-a2ui-form">
          {records(node.fields).map((field) => (
            <label key={String(field.id ?? field.label)}>
              <span>{String(field.label ?? "Field")}</span>
              <input value={String(field.value ?? "")} readOnly />
            </label>
          ))}
        </div>
      </section>
    );
  }

  if (type === "list") {
    return (
      <section className="dynamic-a2ui-node">
        <div className="dynamic-a2ui-node-title">
          <ListChecks size={16} aria-hidden="true" />
          <strong>{String(node.title ?? "List")}</strong>
        </div>
        <ul className="dynamic-a2ui-list">
          {records(node.items).map((item) => (
            <li key={String(item.id ?? item.label)}>
              <span>{String(item.label ?? "Item")}</span>
              <code>{String(item.status ?? "pending")}</code>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (type === "summary") {
    return (
      <section className="dynamic-a2ui-node">
        <div className="dynamic-a2ui-node-title">
          <LayoutTemplate size={16} aria-hidden="true" />
          <strong>{String(node.title ?? "Summary")}</strong>
        </div>
        <p>{String(node.body ?? "")}</p>
        <div className="dynamic-a2ui-stats">
          {records(node.stats).map((stat) => (
            <div key={String(stat.label)}>
              <span>{String(stat.label ?? "Metric")}</span>
              <strong>{String(stat.value ?? "")}</strong>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="dynamic-a2ui-fallback">
      <FileWarning size={16} aria-hidden="true" />
      <div>
        <strong>Unsupported schema node</strong>
        <p>{String(node.reason ?? `No renderer registered for ${type}.`)}</p>
      </div>
    </section>
  );
}

export function DynamicSchemaCard({ result }: { result: unknown }) {
  const parsed = parseResult(result);
  const components = records(parsed.components);
  const unsupported = isPlainObject(parsed.unsupported) ? parsed.unsupported : null;
  const notes = records(parsed.stream_notes);

  return (
    <article className="dynamic-a2ui-card" data-testid="dynamic-a2ui-schema">
      <header className="dynamic-a2ui-header">
        <LayoutTemplate size={18} aria-hidden="true" />
        <div>
          <strong>{String(parsed.selected_kind ?? "dynamic")} schema</strong>
          <span>{String(parsed.schema_version ?? "unknown schema")}</span>
        </div>
      </header>
      <div className="dynamic-a2ui-notes">
        {notes.map((note, index) => (
          <span key={`${String(note.phase)}-${index}`}>
            {String(note.phase ?? "phase")}: {String(note.status ?? "pending")}
          </span>
        ))}
      </div>
      {components.map((component, index) => (
        <DynamicNode key={`${String(component.type)}-${index}`} node={component} />
      ))}
      {unsupported ? <DynamicNode node={unsupported} /> : null}
      <p className="dynamic-a2ui-summary">{String(parsed.final_summary ?? "Schema ready.")}</p>
    </article>
  );
}

export function GenerateDynamicSchemaRenderer({ result, status }: { parameters: Partial<z.infer<typeof generateDynamicSchemaParameters>>; result: unknown; status: string }) {
  if (status !== "complete") {
    return <div className="dynamic-a2ui-loading">Generating dynamic schema...</div>;
  }

  return <DynamicSchemaCard result={result} />;
}
