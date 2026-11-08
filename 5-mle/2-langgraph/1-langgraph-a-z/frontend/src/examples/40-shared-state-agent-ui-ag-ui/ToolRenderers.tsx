import { z } from "zod";
import { suggestRecipePatchParameters, parseJsonResult } from "./model";
import { panelStyle } from "./styles";

export function SuggestRecipePatchRenderer({ status, parameters, result }: { parameters: Partial<z.infer<typeof suggestRecipePatchParameters>>; result: unknown; status: string }) {
  const parsed = parseJsonResult(result);
  const patch = parseJsonResult(parsed.patch);
  return (
    <div style={{ ...panelStyle, gap: 8 }} data-testid="recipe-patch-tool">
      <strong>{status === "complete" ? "Recipe patch suggested" : "Preparing recipe patch"}</strong>
      <span>{parameters.request || "Waiting for request..."}</span>
      {status === "complete" ? <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(patch, null, 2)}</pre> : null}
    </div>
  );
}
