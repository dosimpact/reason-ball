import { expect, test } from "@playwright/test";
import { hasRasterImageSignature } from "../../src/shared/lib/image-signature";
import { isStorageObjectConflict } from "../../src/shared/lib/storage-error";

test("recognizes supported raster signatures without changing input", () => {
  const png = new Uint8Array([137,80,78,71,13,10,26,10]);
  const before = [...png];
  expect(hasRasterImageSignature(png, "image/png")).toBe(true);
  expect([...png]).toEqual(before);
  expect(hasRasterImageSignature(new Uint8Array([255,216,255]), "image/jpeg")).toBe(true);
  expect(hasRasterImageSignature(new TextEncoder().encode("RIFF0000WEBP"), "image/webp")).toBe(true);
  expect(hasRasterImageSignature(new TextEncoder().encode("0000ftypavif"), "image/avif")).toBe(true);
});

test("rejects empty bytes, MIME mismatch and SVG disguised as raster", () => {
  expect(hasRasterImageSignature(new Uint8Array(), "image/png")).toBe(false);
  expect(hasRasterImageSignature(new Uint8Array([255,216,255]), "image/png")).toBe(false);
  const svg = new TextEncoder().encode("<svg></svg>");
  expect(hasRasterImageSignature(svg, "image/png")).toBe(false);
  expect(hasRasterImageSignature(svg, "image/svg+xml")).toBe(false);
});

test("recognizes storage duplicate responses without swallowing access or service failures", () => {
  expect(isStorageObjectConflict({ message: "The resource already exists" })).toBe(true);
  expect(isStorageObjectConflict({ message: "Duplicate object" })).toBe(true);
  expect(isStorageObjectConflict({ message: "Conflict", statusCode: "409" })).toBe(true);
  expect(isStorageObjectConflict({ message: "Denied", statusCode: "403" })).toBe(false);
  expect(isStorageObjectConflict({ message: "Unavailable", status: 503 })).toBe(false);
});
