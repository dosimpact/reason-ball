import { test } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { assertCatalogArtifacts } from "../scripts/check-openui-sync.mjs";

const prompt = Buffer.from('FinancialChart(snapshot)\nIndicatorControls(value,catalog)');
const spec = Buffer.from('{"components":{"FinancialChart":{},"IndicatorControls":{}}}');
const current = () => ({ generatedPrompt: prompt, generatedSpec: spec, frontendPrompt: Buffer.from(prompt), frontendSpec: Buffer.from(spec), pythonPrompt: Buffer.from(prompt) });
test("accept source-generated FE artifacts and shared Python mirror", () => assert.doesNotThrow(() => assertCatalogArtifacts(current())));
for (const [field, label] of [["frontendPrompt", "FE system-prompt.txt"], ["frontendSpec", "FE system-prompt.spec.json"], ["pythonPrompt", "Python shared system-prompt.txt"]]) {
  test(`reject stale ${field} and name the repair command`, () => {
    assert.throws(() => assertCatalogArtifacts({ ...current(), [field]: Buffer.from("old catalog") }), error => error.message.includes(label) && error.message.includes("pnpm -C 1-fe-host sec-ui:generate"));
  });
}
test("reject empty generation even when stored artifacts are also empty", () => assert.throws(() => assertCatalogArtifacts(Object.fromEntries(Object.keys(current()).map(key => [key, Buffer.from("")]))), /empty artifacts/));
