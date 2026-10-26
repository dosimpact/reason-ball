import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPriceHistogram,
  summarizePrices,
} from "../src/entities/vendor/model/price-insights";
import {
  estimatedVenueCost,
  getVenueCostBreakdown,
} from "../src/entities/vendor/model/pricing";
import data from "../src/entities/vendor/data/vendors.json";
import type { Vendor } from "../src/entities/vendor/model/types";
const sample = (data as Vendor[]).find(
  (vendor) =>
    vendor.kind === "venue" && vendor.offers.some((offer) => offer.meal),
)!;
test("price statistics include explicit zero and discard invalid values", () => {
  assert.deepEqual(summarizePrices([0, 10, 20, 30, NaN, Infinity, -1]), {
    count: 4,
    min: 0,
    max: 30,
    mean: 15,
    median: 15,
    q1: 7.5,
    q3: 22.5,
  });
  assert.equal(summarizePrices([NaN, -1]), null);
});
test("histogram retains the maximum edge and equal-price samples", () => {
  assert.deepEqual(
    buildPriceHistogram([10, 20, 30, 40], 3).map((bin) => bin.count),
    [1, 1, 2],
  );
  const equal = buildPriceHistogram([50000, 50000, 50000]);
  assert.equal(
    equal.reduce((sum, bin) => sum + bin.count, 0),
    3,
  );
  assert.ok(equal.every((bin) => bin.upper > bin.lower));
  assert.equal(buildPriceHistogram([], 8).length, 0);
});
test("cost chart cannot combine the meal from one season and rental from another", () => {
  const vendor: Vendor = {
    ...sample,
    offers: [
      {
        hall: "A",
        meal: { min: 50000, max: 60000, raw: "" },
        rental: { min: 10000000, max: 10000000, raw: "" },
        rentalKind: "rental",
        decoration: null,
        guests: 200,
        additional: false,
        condition: "A",
      },
      {
        hall: "B",
        meal: { min: 70000, max: 80000, raw: "" },
        rental: { min: 1000000, max: 1000000, raw: "" },
        rentalKind: "combined",
        decoration: null,
        guests: 250,
        additional: false,
        condition: "B",
      },
    ],
  };
  const chart = getVenueCostBreakdown(vendor, 200)!;
  assert.equal(chart.total, 18500000);
  assert.equal(chart.meal, 17500000);
  assert.equal(chart.rental, 1000000);
  assert.equal(chart.billableGuests, 250);
  assert.equal(chart.rentalKind, "combined");
  assert.equal(chart.mealUnit, 70000);
  assert.equal(chart.mealUnitMax, 80000);
  assert.equal(chart.guarantee, 250);
  assert.equal(chart.hall, "B");
  assert.equal(chart.totalMax, 21000000);
  assert.equal(chart.total, estimatedVenueCost(vendor, 200)?.min);
});
test("an unknown rental stays unknown in cost charts and ineligible tiers are omitted", () => {
  const offer = sample.offers.find((offer) => offer.meal)!;
  const vendor: Vendor = {
    ...sample,
    offers: [
      {
        ...offer,
        rental: null,
        additional: false,
        minimumAttendees: 150,
        maximumAttendees: 250,
      },
    ],
  };
  assert.equal(getVenueCostBreakdown(vendor, 100), null);
  assert.equal(getVenueCostBreakdown(vendor, 300), null);
  const chart = getVenueCostBreakdown(vendor, 200)!;
  assert.equal(chart.rental, null);
  assert.equal(chart.total, chart.meal);
});
