import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readPriceFilters,
  priceFiltersQuery,
} from "../src/pages/prices/model/state";
test("shared table links restore the same product unit, conditions, order and page", () => {
  const state = readPriceFilters({
    kind: "planning",
    q: "루이르 웨딩",
    region: "부산",
    guests: "275",
    metric: "makeup:person",
    budget: "300000",
    priced: "1",
    saved: "1",
    year: "unknown",
    page: "3",
    size: "50",
    sort: "name",
    dir: "desc",
  });
  const restored = readPriceFilters(
    Object.fromEntries(new URLSearchParams(priceFiltersQuery(state))),
  );
  assert.deepEqual(restored, state);
});
test("untrusted URL values cannot create invalid guest counts, page sizes or sort keys", () => {
  const state = readPriceFilters({
    kind: "invalid",
    guests: "-100",
    page: "0",
    size: "9999",
    sort: "__proto__",
    dir: "bad",
    metric: "all:all",
    budget: "NaN",
    year: "n/a",
  });
  assert.equal(state.kind, "venue");
  assert.equal(state.guests, 200);
  assert.equal(state.page, 1);
  assert.equal(state.pageSize, 20);
  assert.deepEqual(state.sort, { key: "price", direction: "asc" });
  assert.equal(state.planningMetric, "package:package");
  assert.equal(state.budget, 0);
  assert.equal(state.year, "all");
});

test("multiple regions round-trip through repeated URL keys and old Seoul links remain valid", () => {
  const state = readPriceFilters({ region: ["부산", "서울(강남)", "부산"] });
  assert.deepEqual(state.regions, ["부산", "서울(강남)"]);
  const params = new URLSearchParams(priceFiltersQuery(state));
  assert.deepEqual(params.getAll("region"), state.regions);
  assert.deepEqual(
    readPriceFilters({
      ...Object.fromEntries(params),
      region: params.getAll("region"),
    }),
    state,
  );
  assert.deepEqual(readPriceFilters({ region: "서울" }).regions, [
    "서울(강남)",
    "서울(강남외)",
  ]);
  assert.deepEqual(readPriceFilters({ region: "전체" }).regions, []);
});
