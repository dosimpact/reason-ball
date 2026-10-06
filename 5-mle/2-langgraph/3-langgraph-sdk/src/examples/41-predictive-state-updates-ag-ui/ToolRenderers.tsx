import { z } from "zod";
import { editDocumentParameters, parseResult } from "./model";
import { panelStyle } from "./styles";

export function EditDocumentRenderer({ status, parameters, result }: { parameters: Partial<z.infer<typeof editDocumentParameters>>; result: unknown; status: string }) {
  const parsed = parseResult(result);
  return (
    <div style={{ ...panelStyle, gap: 8 }} data-testid="document-edit-tool">
      <strong>{status === "complete" ? "Backend edit confirmed" : "Predicting document edit"}</strong>
      <span>Operation: {parameters.operation ?? "pending"}</span>
      {status === "complete" ? <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(parsed.patch ?? parsed, null, 2)}</pre> : null}
    </div>
  );
}
