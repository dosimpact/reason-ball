import assert from "node:assert/strict";
import test from "node:test";
import type { Vendor } from "../src/entities/vendor/model/types";
import {
  getVendorCoordinate,
  groupMapPoints,
} from "../src/widgets/venue-map/model/map-points";

function vendor(id: string, overrides: Partial<Vendor> = {}): Vendor {
  return {
    id,
    region: "서울(강남)",
    latitude: null,
    longitude: null,
    ...overrides,
  } as Vendor;
}

test("missing coordinates remain unknown rather than borrowing a region center", () => {
  assert.equal(
    getVendorCoordinate(vendor("unmapped-location-regression")),
    null,
  );
});

test("unresolved vendors are grouped separately from address coordinates", () => {
  const points = groupMapPoints([
    vendor("unmapped-first"),
    vendor("unmapped-second"),
    vendor("provided-address", { latitude: 37.5177, longitude: 127.0473 }),
  ]);
  assert.equal(points.exact.length, 1);
  assert.equal(points.exact[0].vendor.id, "provided-address");
  assert.equal(points.regions.length, 1);
  assert.equal(points.regions[0].vendors.length, 2);
  assert.equal(points.regions[0].coordinate.precision, "region");
  assert.equal(points.unresolved, 2);
});

test("an unknown region cannot create a marker with invented coordinates", () => {
  const points = groupMapPoints([
    vendor("unknown-region", { region: "원문 지역 미기재" }),
  ]);
  assert.equal(points.exact.length, 0);
  assert.equal(points.regions.length, 0);
  assert.equal(points.unresolved, 1);
});
