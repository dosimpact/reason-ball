import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import manifest from "../database/manifest.json";
import vendors from "../src/entities/vendor/data/vendors.json";

const app = fileURLToPath(new URL("../", import.meta.url));
test("every copied input stays inside the app and matches its recorded bytes", () => {
  for (const entry of manifest.files) {
    const target = realpathSync(path.join(app, entry.path));
    assert.ok(target.startsWith(path.join(app, "database") + path.sep));
    const bytes = readFileSync(target);
    assert.equal(bytes.length, entry.bytes, entry.path);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      entry.sha256,
      entry.path,
    );
  }
});
test("all disclosure source references resolve to the copied local snapshot", () => {
  const files = new Map(
    manifest.files.map((entry) => [entry.path, entry.sha256]),
  );
  for (const vendor of vendors) {
    for (const source of vendor.sources) {
      assert.equal(
        files.get(source.path),
        source.sha256,
        `${vendor.name}: ${source.path}`,
      );
    }
  }
});
