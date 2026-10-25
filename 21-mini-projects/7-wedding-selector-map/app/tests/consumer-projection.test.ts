import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getVendor,
  getVendorSummaries,
} from "../src/entities/vendor/api/catalogue.server";
import { estimatedVenueCost } from "../src/entities/vendor/model/pricing";
import data from "../src/entities/vendor/data/vendors.json";
import type { Vendor } from "../src/entities/vendor/model/types";
test("consumer responses preserve price calculations without exposing document-viewing fields", () => {
  const original = (data as Vendor[]).find(
    (vendor) => vendor.kind === "venue" && vendor.mealMin != null,
  )!;
  const consumer = getVendor(original.id)!;
  assert.deepEqual(
    estimatedVenueCost(consumer, 200),
    estimatedVenueCost(original, 200),
  );
  assert.deepEqual(consumer.documents, []);
  assert.deepEqual(consumer.sources, []);
  assert.deepEqual(consumer.evidence, []);
  assert.equal(consumer.sourceUrl, "");
  assert.ok(consumer.offers.every((offer) => offer.evidence == null));
  assert.equal(consumer.model.previousDisclosures, undefined);
  assert.ok(original.sources.length > 0);
});
test("planning summaries keep useful chart groups while original terms stay lazy", () => {
  const summaries = getVendorSummaries();
  const summary = summaries.find(
    (vendor) => vendor.kind === "planning" && vendor.planningPrices?.length,
  )!;
  assert.ok(summary.planningPrices?.some((price) => price.min != null));
  assert.deepEqual(summary.priceTerms, []);
  assert.ok(getVendor(summary.id)!.priceTerms.length > 0);
});

test("zero-start rental conditions are excluded without deleting venues or changing sources", () => {
  const originals = data as Vendor[];
  const before = JSON.stringify(originals);
  const summaries = getVendorSummaries();
  assert.equal(summaries.length, originals.length);
  const affected = originals.filter(
    (vendor) =>
      vendor.kind === "venue" &&
      vendor.offers.some((offer) => offer.rental?.min === 0),
  );
  assert.equal(affected.length, 10);
  for (const original of affected) {
    const consumer = getVendor(original.id)!;
    const eligible = original.offers.filter((offer) => offer.rental?.min !== 0);
    assert.equal(consumer.offers.length, eligible.length);
    assert.ok(consumer.offers.every((offer) => offer.rental?.min !== 0));
    assert.deepEqual(
      summaries.find((vendor) => vendor.id === original.id)!.offers,
      consumer.offers,
    );
    assert.deepEqual(
      estimatedVenueCost(consumer, 200),
      estimatedVenueCost({ ...original, offers: eligible }, 200),
    );
    const meals = eligible
      .filter((offer) => !offer.additional)
      .flatMap((offer) => (offer.meal ? [offer.meal.min] : []));
    assert.equal(consumer.mealMin, meals.length ? Math.min(...meals) : null);
    if (!eligible.length) {
      assert.equal(consumer.rentalMin, null);
      assert.equal(estimatedVenueCost(consumer, 200), null);
    }
  }
  assert.equal(JSON.stringify(originals), before);
});
