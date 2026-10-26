import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import metadata from "../src/entities/vendor/data/metadata.json";
import { test } from "node:test";
import data from "../src/entities/vendor/data/vendors.json";
import type { Vendor } from "../src/entities/vendor/model/types";
import {
  estimatedVenueCost,
  filterVendors,
  formatMoney,
  getComparablePrice,
} from "../src/entities/vendor/model/pricing";

const vendors = data as Vendor[];
const venue = vendors.find(
  (vendor) =>
    vendor.kind === "venue" &&
    vendor.offers.some(
      (offer) => !offer.additional && offer.meal && offer.guests,
    ),
)!;

test("both actual datasets are represented, including unknown prices", () => {
  assert.equal(
    vendors.filter((vendor) => vendor.kind === "venue").length,
    metadata.venues,
  );
  const sourcePosts = JSON.parse(
    readFileSync(
      new URL(
        "../database/참가격_웨딩홀_업체별_공시원본/게시글_기본정보.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ).posts as { post_id: string }[];
  const representedPosts = new Set(
    vendors
      .filter((vendor) => vendor.kind === "venue")
      .map((vendor) => new URL(vendor.sourceUrl).searchParams.get("boardSeq")),
  );
  assert.ok(sourcePosts.every((post) => representedPosts.has(post.post_id)));
  assert.equal(
    vendors.filter((vendor) => vendor.kind === "planning").length,
    metadata.planning,
  );
  assert.equal(
    new Set(vendors.map((vendor) => vendor.id)).size,
    vendors.length,
  );
  assert.ok(
    vendors.some(
      (vendor) => vendor.kind === "planning" && vendor.serviceMin == null,
    ),
  );
  assert.ok(
    vendors.some(
      (vendor) => vendor.kind === "planning" && vendor.serviceMin != null,
    ),
  );
});

test("estimated event costs respect the chosen offer guarantee and rental", () => {
  const result = estimatedVenueCost(venue, 10)!;
  const candidateTotals = venue.offers
    .filter((offer) => !offer.additional && offer.meal)
    .map(
      (offer) =>
        offer.meal!.min * Math.max(10, offer.guests ?? 0) +
        (offer.rental?.min ?? 0),
    );
  assert.equal(result.min, Math.min(...candidateTotals));
  assert.equal(result.isPartial, true);
  assert.ok(result.notes.some((note) => note.includes("추가 비용")));
});

test("unknown amounts are excluded by a budget and are never free", () => {
  const unknown = {
    ...venue,
    id: "unknown",
    mealMin: null,
    offers: [],
  } as Vendor;
  assert.equal(estimatedVenueCost(unknown, 200), null);
  assert.equal(getComparablePrice(unknown), null);
  assert.deepEqual(filterVendors([unknown], { maxBudget: 100_000_000 }), []);
  assert.equal(formatMoney(null), "공시가 확인 필요");
});

test("planning base service stays separate from a full package", () => {
  const planning = vendors.find(
    (vendor) => vendor.kind === "planning" && vendor.serviceMin != null,
  )!;
  assert.equal(estimatedVenueCost(planning, 200), null);
  assert.equal(
    getComparablePrice(planning),
    planning.packageMin ?? planning.serviceMin,
  );
  assert.ok(
    planning.warnings.some((warning) =>
      warning.includes("전체 합계가 아닙니다"),
    ),
  );
});

test("model-reviewed season data corrects the old mixed rental case", () => {
  const louivis = vendors.find((vendor) => vendor.name === "루이비스 강서점")!;
  assert.equal(louivis.mealMax, 89000);
  assert.equal(
    louivis.offers.find(
      (offer) =>
        offer.condition.includes("성수기") &&
        !offer.condition.includes("비수기"),
    )!.rental!.min,
    8700000,
  );
  assert.ok(louivis.offers.every((offer) => !offer.hall.includes("기타비용")));
});

test("fitting fees, quantity labels and surcharges cannot become basic service minima", () => {
  for (const vendor of vendors.filter((vendor) => vendor.kind === "planning")) {
    for (const term of vendor.priceTerms.filter((term) => term.min != null)) {
      assert.doesNotMatch(term.condition, /피팅|혼주/);
      assert.doesNotMatch(term.raw, /\+\s*\d/);
      assert.ok(term.raw.trim().length > 0);
    }
  }
});

test("every interpreted price retains a valid source and evidence reference", () => {
  for (const vendor of vendors) {
    const sources = new Set(vendor.sources.map((source) => source.id));
    const evidence = new Set(vendor.evidence.map((item) => item.id));
    for (const term of vendor.priceTerms) {
      assert.ok(sources.has(term.sourceId));
      assert.ok(evidence.has(term.evidenceId));
      if (term.state === "known") assert.notEqual(term.min, null);
      if (term.state === "included") assert.equal(term.min, null);
    }
  }
});

test("adult meal comparisons exclude child rows and restricted military discounts", () => {
  const star = vendors.find((vendor) => vendor.id === "venue-31567")!;
  assert.equal(star.mealMin, 50000);
  assert.equal(star.guestsMin, 100);
  const seorak = vendors.find((vendor) => vendor.id === "venue-31838")!;
  assert.equal(seorak.mealMin, 58000);
  const military = vendors.find((vendor) => vendor.id === "venue-31678")!;
  assert.equal(military.mealMin, 40000);
  assert.equal(estimatedVenueCost(military, 200)?.min, 9_020_000);
  assert.ok(military.warnings.some((warning) => warning.includes("군 회원")));
});

test("a merged basic-price heading cannot include the fitting or helper subcolumns", () => {
  const planner = vendors.find((vendor) => vendor.id === "planning-38592")!;
  assert.equal(planner.serviceMin, 685000);
  const fitting = planner.priceTerms.filter((term) => {
    const evidence = planner.evidence.find(
      (evidence) => evidence.id === term.evidenceId,
    )!;
    return evidence.sheet === "드레스" && /^[EF]\d+$/.test(evidence.cell ?? "");
  });
  assert.deepEqual(fitting, []);
  assert.ok(
    planner.documents.some((document) =>
      document.sections.some((section) =>
        section.items.some(
          (item) => typeof item === "string" && item.includes("피팅비"),
        ),
      ),
    ),
  );
});

test("guest tiers select the applicable price rather than an ineligible cheapest tier", () => {
  const nottingHill = vendors.find((vendor) => vendor.id === "venue-31428")!;
  assert.equal(nottingHill.mealMin, 36000);
  assert.equal(estimatedVenueCost(nottingHill, 200)?.min, 12_200_000);
  assert.equal(estimatedVenueCost(nottingHill, 100), null);
});

test("name search accepts removed spaces, punctuation, NFKC and multiple terms", () => {
  const compact = filterVendors(vendors, { query: "라망스튜디오전주점" });
  assert.ok(compact.some((vendor) => vendor.name === "라망스튜디오 전주점"));
  const multi = filterVendors(vendors, { query: "서울 강남" });
  assert.ok(multi.length > 0);
  assert.ok(
    multi.every(
      (vendor) =>
        (vendor.name + vendor.address + vendor.region).includes("서울") &&
        (vendor.name + vendor.address + vendor.region).includes("강남"),
    ),
  );
  const latin = vendors.find((vendor) => vendor.name.includes("JW"));
  if (latin) assert.ok(filterVendors([latin], { query: "ＪＷ" }).length === 1);
});

test("conditional free services remain explicit without turning the vendor's paid basics into zero", () => {
  const sopung = vendors.find((vendor) => vendor.id === "planning-38639")!;
  assert.equal(sopung.serviceMin, 440000);
  assert.ok(
    sopung.priceTerms.some(
      (term) =>
        term.state === "free" &&
        term.min === 0 &&
        term.condition.includes("촬영"),
    ),
  );
  const luir = vendors.find((vendor) => vendor.id === "planning-38609")!;
  assert.equal(luir.serviceMin, 50000);
  assert.ok(
    luir.priceTerms.some(
      (term) =>
        term.min === 50000 &&
        term.basis === "person" &&
        term.raw.includes("남 1인"),
    ),
  );
  assert.ok(
    luir.warnings.some((warning) =>
      warning.includes("두 사람의 합계가 아니므로"),
    ),
  );
});

test("the current MH post keeps the same verified attachment and historical source", () => {
  const mh = vendors.find((vendor) => vendor.id === "venue-30728")!;
  assert.equal(new URL(mh.sourceUrl).searchParams.get("boardSeq"), "38508");
  assert.equal(mh.archived, false);
  assert.ok(mh.sources.some((source) => source.url?.includes("37745")));
  assert.ok(
    mh.model.previousDisclosures?.some((disclosure) =>
      disclosure.sourceUrl.includes("37745"),
    ),
  );
});

test("explore price ranges include boundaries, intersect and exclude unknown values", () => {
  const sample = { ...venue, mealMin: 50000, rentalMin: 2000000 };
  const total = getComparablePrice(sample, 200)!;
  const ranges = {
    minMeal: 50000,
    maxMeal: 50000,
    minRental: 2000000,
    maxRental: 2000000,
    minBudget: total,
    maxBudget: total,
    guests: 200,
  };
  assert.equal(filterVendors([sample], ranges).length, 1);
  assert.equal(
    filterVendors([sample], { ...ranges, minRental: 2000001 }).length,
    0,
  );
  assert.equal(filterVendors([sample], { minMeal: 50001 }).length, 0);
  assert.equal(filterVendors([sample], { maxBudget: total - 1 }).length, 0);
  assert.equal(
    filterVendors([{ ...sample, rentalMin: null }], { minRental: 0 }).length,
    0,
  );
  assert.equal(filterVendors([{ ...sample, rentalMin: null }], {}).length, 1);
});
