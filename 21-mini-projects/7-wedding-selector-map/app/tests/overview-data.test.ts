import assert from "node:assert/strict";
import { test } from "node:test";
import data from "../src/entities/vendor/data/vendors.json";
import type { Vendor } from "../src/entities/vendor/model/types";
import {
  overviewPoints,
  planningMetricOptions,
} from "../src/widgets/price-overview/model/overview-data";
const planning = (data as Vendor[]).find(
  (vendor) => vendor.kind === "planning",
)!;
test("overview distributions select one service category and unit rather than mixing cheap personal services with packages", () => {
  const vendors: Vendor[] = [
    {
      ...planning,
      id: "a",
      planningPrices: [
        {
          category: "makeup",
          basis: "person",
          unitLabel: "1인",
          min: 50000,
          max: 200000,
          freeAvailable: false,
          includedAvailable: false,
        },
        {
          category: "package",
          basis: "package",
          unitLabel: "패키지",
          min: 3000000,
          max: 5000000,
          freeAvailable: false,
          includedAvailable: false,
        },
      ],
    },
    {
      ...planning,
      id: "b",
      planningPrices: [
        {
          category: "makeup",
          basis: "person",
          unitLabel: "1인",
          min: 60000,
          max: 80000,
          freeAvailable: false,
          includedAvailable: false,
        },
      ],
    },
    {
      ...planning,
      id: "c",
      planningPrices: [
        {
          category: "makeup",
          basis: "item",
          unitLabel: "상품",
          min: 500000,
          max: 500000,
          freeAvailable: false,
          includedAvailable: false,
        },
      ],
    },
  ];
  assert.deepEqual(overviewPoints(vendors, "makeup:person", 200), [
    { id: "a", value: 50000 },
    { id: "b", value: 60000 },
  ]);
  assert.equal(
    planningMetricOptions(vendors).find(
      (option) => option.key === "makeup:person",
    )?.count,
    2,
  );
});
test("a free or included planning item without a known numeric basic price stays out of the numeric cohort", () => {
  const vendor: Vendor = {
    ...planning,
    planningPrices: [
      {
        category: "dress",
        basis: "item",
        unitLabel: "상품",
        min: null,
        max: null,
        freeAvailable: true,
        includedAvailable: true,
      },
    ],
  };
  assert.deepEqual(overviewPoints([vendor], "dress:item", 200), []);
  assert.deepEqual(planningMetricOptions([vendor]), []);
});
