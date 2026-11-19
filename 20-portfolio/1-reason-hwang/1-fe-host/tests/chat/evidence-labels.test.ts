import assert from "node:assert/strict";
import test from "node:test";
import { periodLabel, unitLabel } from "../../src/_pages/sec-chat/model/evidenceLabels";

test("selected modeling evidence retains duration and instant period labels", () => {
  assert.equal(periodLabel({ startDate: "2024-10-01", endDate: "2025-09-30" }), "2024-10-01 ~ 2025-09-30");
  assert.equal(periodLabel({ instantDate: "2025-09-30" }), "2025-09-30");
  assert.equal(periodLabel({ start: "2024-01-01", end: "2024-12-31" }), "2024-01-01 ~ 2024-12-31");
  assert.equal(periodLabel(undefined), undefined);
});
test("unit objects and serialized units are formatted without raw JSON", () => {
  assert.equal(unitLabel({ numerator: ["USD"], denominator: ["shares"] }), "USD / shares");
  assert.equal(unitLabel('{"numerator":["USD"],"denominator":[]}'), "USD");
  assert.equal(unitLabel("USD"), "USD");
  assert.equal(unitLabel("{invalid"), "단위 형식 확인 필요");
  assert.equal(unitLabel({ unsupported: { raw: "data" } }), "단위 형식 확인 필요");
});
