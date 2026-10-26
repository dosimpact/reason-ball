import assert from "node:assert/strict";
import { test } from "node:test";
import data from "../src/entities/vendor/data/vendors.json";
import type { Offer, Vendor } from "../src/entities/vendor/model/types";
import {
  filterPriceRows,
  getPlanningMetricOptions,
  getPriceTableSummary,
  normalizePriceRows,
  paginatePriceRows,
  priceRowsToCsv,
  sortPriceRows,
} from "../src/features/price-table/model/price-table";

const venueBase = (data as Vendor[]).find((vendor) => vendor.kind === "venue")!;
const planningBase = (data as Vendor[]).find(
  (vendor) => vendor.kind === "planning",
)!;
function offer(overrides: Partial<Offer> = {}): Offer {
  return {
    hall: "기본홀",
    meal: { min: 50000, max: 60000, raw: "" },
    rental: { min: 2000000, max: 3000000, raw: "" },
    rentalKind: "rental",
    decoration: null,
    guests: 200,
    condition: "토요일",
    additional: false,
    ...overrides,
  };
}
function venue(id: string, overrides: Partial<Vendor> = {}): Vendor {
  return {
    ...venueBase,
    id,
    name: id,
    region: "서울(강남)",
    offers: [offer()],
    ...overrides,
  };
}
function planner(id: string, overrides: Partial<Vendor> = {}): Vendor {
  return {
    ...planningBase,
    id,
    name: id,
    region: "부산",
    planningPrices: [
      {
        category: "package",
        basis: "package",
        unitLabel: "패키지 기준",
        min: 3000000,
        max: 5000000,
        freeAvailable: false,
        includedAvailable: false,
      },
      {
        category: "makeup",
        basis: "person",
        unitLabel: "1인",
        min: 50000,
        max: 80000,
        freeAvailable: false,
        includedAvailable: false,
      },
      {
        category: "makeup",
        basis: "item",
        unitLabel: "상품 기준",
        min: 500000,
        max: 800000,
        freeAvailable: false,
        includedAvailable: false,
      },
    ],
    ...overrides,
  };
}

test("the table uses meal, rental, guarantee and ranges from one selected offer", () => {
  const vendor = venue("seasons", {
    mealMin: 1,
    rentalMin: 1,
    guestsMin: 1,
    offers: [
      offer({
        hall: "A",
        meal: { min: 50000, max: 60000, raw: "" },
        rental: { min: 10000000, max: 11000000, raw: "" },
      }),
      offer({
        hall: "B",
        meal: { min: 70000, max: 80000, raw: "" },
        rental: { min: 1000000, max: 1500000, raw: "" },
        rentalKind: "combined",
        guests: 250,
        condition: "일요일 B 조건",
      }),
    ],
  });
  const [row] = normalizePriceRows([vendor], { kind: "venue", guests: 200 });
  assert.equal(row.offerLabel, "B");
  assert.equal(row.price, 18500000);
  assert.equal(row.priceMax, 21500000);
  assert.equal(row.meal, 70000);
  assert.equal(row.mealMax, 80000);
  assert.equal(row.rental, 1000000);
  assert.equal(row.rentalMax, 1500000);
  assert.equal(row.guarantee, 250);
  assert.equal(row.billableGuests, 250);
  assert.equal(row.mealTotal, 17500000);
  assert.equal(row.rentalKind, "combined");
  assert.match(row.condition, /보증인원 250명/);
});

test("ineligible guest tiers have unknown table amounts instead of vendor-wide fallback minima", () => {
  const vendor = venue("tier", {
    mealMin: 1,
    rentalMin: 1,
    offers: [offer({ minimumAttendees: 200, maximumAttendees: 250 })],
  });
  const [row] = normalizePriceRows([vendor], { kind: "venue", guests: 100 });
  assert.equal(row.price, null);
  assert.equal(row.meal, null);
  assert.equal(row.rental, null);
  assert.equal(row.guarantee, null);
  assert.equal(row.canEstimate, false);
});

test("an unknown rental stays unknown while the table explains its partial meal subtotal", () => {
  const [row] = normalizePriceRows(
    [venue("unknown-rental", { offers: [offer({ rental: null })] })],
    { kind: "venue", guests: 200 },
  );
  assert.equal(row.price, 10000000);
  assert.equal(row.rental, null);
  assert.match(row.condition, /대관료 미확인/);
});

test("planning rows compare exactly one category and unit without falling back to a cheaper service", () => {
  const vendor = planner("plan");
  const personal = normalizePriceRows([vendor], {
    kind: "planning",
    planningMetric: "makeup:person",
  })[0];
  const item = normalizePriceRows([vendor], {
    kind: "planning",
    planningMetric: "makeup:item",
  })[0];
  const packageRow = normalizePriceRows([vendor], { kind: "planning" })[0];
  const dress = normalizePriceRows([vendor], {
    kind: "planning",
    planningMetric: "dress:item",
  })[0];
  assert.equal(personal.price, 50000);
  assert.equal(item.price, 500000);
  assert.equal(packageRow.price, 3000000);
  assert.equal(dress.price, null);
  assert.equal(personal.meal, null);
  assert.match(personal.basisLabel, /1인/);
  assert.equal(
    getPlanningMetricOptions([vendor]).find(
      (metric) => metric.value === "makeup:person",
    )?.count,
    1,
  );
  const mixedSummary = getPriceTableSummary([personal, packageRow]);
  assert.equal(mixedSummary.comparable, false);
  assert.equal(mixedSummary.average, null);
  assert.equal(mixedSummary.median, null);
});

test("free and included planning conditions do not become a numeric zero unless zero is explicitly known", () => {
  const vendor = planner("included", {
    planningPrices: [
      {
        category: "dress",
        basis: "item",
        unitLabel: "상품 기준",
        min: null,
        max: null,
        freeAvailable: true,
        includedAvailable: true,
      },
    ],
  });
  const [row] = normalizePriceRows([vendor], {
    kind: "planning",
    planningMetric: "dress:item",
  });
  assert.equal(row.price, null);
  assert.equal(row.freeAvailable, true);
  assert.equal(row.includedAvailable, true);
  const zero = { ...row, id: "zero", price: 0, priceMax: 0 };
  assert.deepEqual(filterPriceRows([row, zero], { maxBudget: 0 }), [zero]);
  assert.deepEqual(filterPriceRows([row, zero], { onlyPriced: true }), [zero]);
});

test("null prices and guarantee counts stay last in both sort directions", () => {
  const rows = normalizePriceRows([venue("a"), venue("b"), venue("c")], {
    kind: "venue",
  });
  rows[0] = { ...rows[0], price: 0, guarantee: 0 };
  rows[1] = { ...rows[1], price: null, guarantee: null };
  rows[2] = { ...rows[2], price: 100, guarantee: 100 };
  for (const key of ["price", "guests"] as const) {
    assert.deepEqual(
      sortPriceRows(rows, { key, direction: "asc" }).map((row) => row.id),
      ["a", "c", "b"],
    );
    assert.deepEqual(
      sortPriceRows(rows, { key, direction: "desc" }).map((row) => row.id),
      ["c", "a", "b"],
    );
  }
});

test("search, region, budget and saved filters combine without changing the original rows", () => {
  const rows = normalizePriceRows(
    [
      venue("a", { name: "ＪＷ 테스트", address: "서울 강남구" }),
      venue("b", { name: "다른 업체", region: "부산" }),
    ],
    { kind: "venue" },
  );
  const filtered = filterPriceRows(rows, {
    query: "JW 강남",
    region: "서울",
    maxBudget: 20000000,
    savedOnly: true,
    savedIds: ["a"],
  });
  assert.deepEqual(
    filtered.map((row) => row.id),
    ["a"],
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(
    filterPriceRows(rows, { savedOnly: true, savedIds: [] }),
    [],
  );
});

test("pagination clamps stale pages, allows 20/50/100 and handles empty results", () => {
  const [base] = normalizePriceRows([venue("a")], { kind: "venue" });
  const rows = Array.from({ length: 61 }, (_, index) => ({
    ...base,
    id: String(index),
  }));
  const page = paginatePriceRows(rows, 999, 50);
  assert.equal(page.page, 2);
  assert.equal(page.pageCount, 2);
  assert.equal(page.start, 51);
  assert.equal(page.end, 61);
  assert.equal(page.rows.length, 11);
  assert.equal(paginatePriceRows(rows, -1, 21).pageSize, 20);
  assert.equal(paginatePriceRows(rows, 1, 100).rows.length, 61);
  assert.equal(paginatePriceRows([], 2, 20).start, 0);
  assert.equal(paginatePriceRows([], 2, 20).pageCount, 1);
});

test("CSV exports the supplied complete cohort with numeric zeros, unknown blanks, safe names and no source URLs", () => {
  const rows = normalizePriceRows(
    [
      venue("a", {
        name: "  =HYPERLINK(1)",
        offers: [offer({ rental: null })],
      }),
      venue("b", { name: '따옴표" 업체', offers: [] }),
    ],
    { kind: "venue" },
  );
  rows[0] = { ...rows[0], price: 0 };
  const csv = priceRowsToCsv(rows, 200);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /'  =HYPERLINK\(1\)/);
  assert.match(csv, /따옴표"" 업체/);
  assert.match(csv, /"0"/);
  assert.doesNotMatch(csv, /공시출처|https?:\/\/|sourceUrl/);
  assert.equal(csv.split("\r\n").length, 3);
});

test("multi-region selection uses a union while budget remains an intersection", () => {
  const rows = normalizePriceRows(
    [
      venue("seoul", { region: "서울(강남)" }),
      venue("busan", { region: "부산" }),
      venue("daegu", { region: "대구" }),
    ],
    { kind: "venue", guests: 200 },
  );
  assert.deepEqual(
    filterPriceRows(rows, { regions: ["서울", "부산", "서울(강남)"] }).map(
      (row) => row.id,
    ),
    ["seoul", "busan"],
  );
  assert.equal(filterPriceRows(rows, { regions: [] }).length, 3);
  assert.equal(
    filterPriceRows(rows, { regions: ["부산"], maxBudget: 1 }).length,
    0,
  );
});
