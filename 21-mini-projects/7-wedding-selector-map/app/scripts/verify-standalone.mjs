import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const app = fileURLToPath(new URL("../", import.meta.url));
const temp = await realpath(
  await mkdtemp(path.join(os.tmpdir(), "orot-verify-")),
);
const release = path.join(temp, "release");
let child;
let logs = "";
async function checkLinks(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      const target = await realpath(filename);
      assert.ok(
        target.startsWith(release + path.sep),
        `External symlink: ${filename}`,
      );
    } else if (entry.isDirectory()) await checkLinks(filename);
  }
}
try {
  await cp(path.join(app, ".next/standalone"), release, {
    recursive: true,
    verbatimSymlinks: true,
  });
  await checkLinks(release);
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  child = spawn(process.execPath, ["server.js"], {
    cwd: release,
    env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => {
    logs += chunk;
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk;
  });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(100);
  }
  assert.ok(ready, logs);
  for (const route of ["/", "/prices"]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    const html = await response.text();
    const assets = [
      ...new Set(
        [
          ...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g),
        ].map((match) => match[1]),
      ),
    ];
    assert.ok(assets.length > 0);
    for (const asset of assets)
      assert.equal(
        (await fetch(new URL(asset.replaceAll("&amp;", "&"), base))).status,
        200,
        asset,
      );
  }
  const vendors = JSON.parse(
    await readFile(
      path.join(app, "src/entities/vendor/data/vendors.json"),
      "utf8",
    ),
  );
  for (const kind of ["venue", "planning"]) {
    const vendor = vendors.find((item) => item.kind === kind);
    const response = await fetch(`${base}/api/vendors/${vendor.id}`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).id, vendor.id);
  }
  const manifest = JSON.parse(
    await readFile(path.join(release, "database/manifest.json"), "utf8"),
  );
  const sample = manifest.files.find((item) => item.path.endsWith(".xlsx"));
  const document = await fetch(
    `${base}/api/documents?path=${encodeURIComponent(sample.path)}`,
  );
  assert.equal(document.status, 200);
  assert.equal(
    createHash("sha256")
      .update(Buffer.from(await document.arrayBuffer()))
      .digest("hex"),
    sample.sha256,
  );
  assert.equal(
    (
      await fetch(
        `${base}/api/documents?path=${encodeURIComponent("../package.json")}`,
      )
    ).status,
    403,
  );
  console.log(
    `PASS isolated standalone: pages, static assets, both vendor kinds, local document SHA-256, traversal rejection, internal symlinks (${manifest.files.length} source files)`,
  );
} finally {
  if (child && child.exitCode === null) {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGTERM");
    const timeout = setTimeout(() => child.kill("SIGKILL"), 5000);
    await exited;
    clearTimeout(timeout);
  }
  await rm(temp, { recursive: true, force: true });
}
