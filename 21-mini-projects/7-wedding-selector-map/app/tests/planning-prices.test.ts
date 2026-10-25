import assert from "node:assert/strict";
import { test } from "node:test";
import type { PriceTerm, Vendor } from "../src/entities/vendor/model/types";
import {
  buildPlanningPrices,
  getPlanningPriceCaption,
  getPlanningPrices,
} from "../src/entities/vendor/model/planning-prices";

function term(overrides: Partial<PriceTerm>): PriceTerm {
  return {
    id: "term",
    category: "makeup",
    subject: "기본상품",
    label: "기본상품",
    role: "payable",
    state: "known",
    min: 50000,
    max: 50000,
    raw: "50,000원",
    basis: "person",
    condition: "",
    evidenceId: "evidence",
    sourceId: "source",
    ...overrides,
  };
}

test("studio, dress, makeup and packages retain independent prices and units", () => {
  const groups = buildPlanningPrices([
    term({ category: "studio", min: 1200000, max: 1500000, basis: "item" }),
    term({ category: "dress", min: 800000, max: 1000000, basis: "item" }),
    term({ category: "makeup", min: 50000, max: 275000, basis: "person" }),
    term({ category: "makeup", min: 1100000, max: 1400000, basis: "item" }),
    term({ category: "package", min: 3000000, max: 4000000, basis: "package" }),
  ]);
  assert.equal(groups.length, 5);
  assert.equal(groups.find((group) => group.category === "dress")?.min, 800000);
  assert.deepEqual(
    groups
      .filter((group) => group.category === "makeup")
      .map((group) => [group.unitLabel, group.min]),
    [
      ["상품 기준", 1100000],
      ["1인", 50000],
    ],
  );
  assert.equal(
    groups.find((group) => group.category === "package")?.min,
    3000000,
  );
});

test("discounts, surcharges, included and free terms cannot lower paid basics", () => {
  const groups = buildPlanningPrices([
    term({ min: 440000, max: 660000 }),
    term({ role: "discount", min: 5000, max: 5000 }),
    term({ role: "surcharge", min: 10000, max: 10000 }),
    term({ state: "free", min: 0, max: 0 }),
    term({ state: "included", min: null, max: null }),
    term({ state: "on_request", min: null, max: null }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].min, 440000);
  assert.equal(groups[0].max, 660000);
  assert.equal(groups[0].freeAvailable, true);
  assert.equal(groups[0].includedAvailable, true);
  const freeOnly = buildPlanningPrices([
    term({ state: "free", min: 0, max: 0 }),
  ]);
  assert.equal(freeOnly[0].min, null);
  assert.equal(freeOnly[0].freeAvailable, true);
});

test("explicit known zero survives while missing and invalid amounts stay unknown", () => {
  const groups = buildPlanningPrices([
    term({ category: "studio", min: 0, max: 0, basis: "item" }),
    term({ category: "dress", min: null, max: null, basis: "item" }),
    term({ category: "package", min: -100, max: 0, basis: "package" }),
    term({ category: "other", min: 200000, max: 100000, basis: "item" }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].min, 0);
  assert.equal(groups[0].freeAvailable, false);
});

test("a lightweight vendor summary keeps category and one-person caption without raw terms", () => {
  const planningPrices = buildPlanningPrices([
    term({ min: 50000, max: 275000 }),
    term({ category: "dress", basis: "item", min: 800000, max: 1200000 }),
  ]);
  const summary = {
    kind: "planning",
    priceTerms: [],
    planningPrices,
    packageMin: null,
    serviceMin: 50000,
  } as unknown as Vendor;
  assert.equal(getPlanningPrices(summary), planningPrices);
  assert.equal(getPlanningPriceCaption(summary), "메이크업 · 1인");
  assert.equal(
    getPlanningPriceCaption({ ...summary, packageMin: 3000000 }),
    "공시 패키지",
  );
  assert.deepEqual(getPlanningPrices({ ...summary, kind: "venue" }), []);
});
