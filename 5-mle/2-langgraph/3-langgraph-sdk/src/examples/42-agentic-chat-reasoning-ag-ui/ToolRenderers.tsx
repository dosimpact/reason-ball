import { isString } from "remeda";
import { z } from "zod";
import { publishReasoningSummaryParameters, parseJson, stringList, lookupPolicyFactParameters } from "./model";
import { panelStyle } from "./styles";

export function PublishReasoningSummaryRenderer({ status, parameters, result }: { parameters: Partial<z.infer<typeof publishReasoningSummaryParameters>>; result: unknown; status: string }) {
  const parsed = parseJson(result);
  const steps = stringList(parsed.steps);
  return (
    <details open style={{ ...panelStyle, gap: 10 }} data-testid="reasoning-summary-tool">
      <summary style={{ cursor: "pointer", fontWeight: 800 }}>
        {status === "complete" ? "Public reasoning summary" : "Preparing public reasoning summary"}
      </summary>
      <span>{parameters.task || "Waiting for task..."}</span>
      {steps.length > 0 ? (
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}
      {isString(parsed.safety_note) ? <small>{parsed.safety_note}</small> : null}
    </details>
  );
}

export function LookupPolicyFactRenderer({ status, parameters, result }: { parameters: Partial<z.infer<typeof lookupPolicyFactParameters>>; result: unknown; status: string }) {
  const parsed = parseJson(result);
  return (
    <div style={{ ...panelStyle, gap: 8 }} data-testid="policy-fact-tool">
      <strong>{status === "complete" ? "Reasoning policy fact" : "Looking up policy fact"}</strong>
      <span>{parameters.topic || "pending"}</span>
      {isString(parsed.fact) ? <p style={{ margin: 0 }}>{parsed.fact}</p> : null}
    </div>
  );
}
