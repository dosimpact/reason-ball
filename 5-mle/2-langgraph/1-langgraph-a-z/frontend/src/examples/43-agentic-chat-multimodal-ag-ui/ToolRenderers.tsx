import { isString } from "remeda";
import { z } from "zod";
import { recordImageObservationsParameters, parseJson, stringList, describeTextOnlyRequestParameters } from "./model";
import { panelStyle } from "./styles";

export function RecordImageObservationsRenderer({ status, parameters, result }: { parameters: Partial<z.infer<typeof recordImageObservationsParameters>>; result: unknown; status: string }) {
  const parsed = parseJson(result);
  const checks = stringList(parsed.checks);
  return (
    <div style={{ ...panelStyle, gap: 8 }} data-testid="image-observations-tool">
      <strong>{status === "complete" ? "Image observations recorded" : "Inspecting image"}</strong>
      <span>Subject: {parameters.subject || "pending"}</span>
      <span>Visible text: {parameters.visible_text || "pending"}</span>
      <span>Colors: {parameters.colors || "pending"}</span>
      {checks.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {checks.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function DescribeTextOnlyRequestRenderer({ status, parameters, result }: { parameters: Partial<z.infer<typeof describeTextOnlyRequestParameters>>; result: unknown; status: string }) {
  const parsed = parseJson(result);
  return (
    <div style={{ ...panelStyle, gap: 8 }} data-testid="text-only-tool">
      <strong>{status === "complete" ? "Text-only request" : "Checking text-only request"}</strong>
      <span>{parameters.prompt || "pending"}</span>
      {isString(parsed.message) ? <p style={{ margin: 0 }}>{parsed.message}</p> : null}
    </div>
  );
}
