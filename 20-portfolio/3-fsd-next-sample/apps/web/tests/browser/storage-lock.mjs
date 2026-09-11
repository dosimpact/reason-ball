// Browser primitive regression, separate from app/Supabase business E2E.
// Run: node tests/browser/storage-lock.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import ts from "typescript";

const url = "http://dodonet.iptime.org:13000/__storage_lock_probe";
const source = ts.transpile(await readFile(new URL("../../src/shared/lib/browser-lock.ts", import.meta.url), "utf8"), {
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2020,
}).replace(/export /g, "");
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  // Isolated HTML avoids touching application accounts or persisted user data.
  await context.route(url, (route) => route.fulfill({ contentType: "text/html", body: "<html>Storage lock regression</html>" }));
  const pages = await Promise.all([context.newPage(), context.newPage()]);
  for (const page of pages) {
    await page.goto(url);
    await page.addScriptTag({ content: source });
  }
  assert.deepEqual(await pages[0].evaluate(() => ({ secure: isSecureContext, locks: Boolean(navigator.locks) })), { secure: false, locks: false });
  await pages[0].evaluate(() => localStorage.setItem("lock-race", "0"));
  await Promise.all(pages.map((page) => page.evaluate(async () => {
    for (let index = 0; index < 30; index++) {
      await withBrowserStorageLock("race", () => {
        const previous = Number(localStorage.getItem("lock-race"));
        const until = performance.now() + 2;
        while (performance.now() < until) { /* Expose unprotected lost updates. */ }
        localStorage.setItem("lock-race", String(previous + 1));
      });
    }
  })));
  assert.equal(await pages[0].evaluate(() => Number(localStorage.getItem("lock-race"))), 60);
  const recovery = await pages[0].evaluate(async () => {
    const errors = [];
    for (const operation of [() => { throw new Error("operation-failed"); }, async () => 1]) {
      try { await withBrowserStorageLock("race", operation); }
      catch (error) { errors.push(error.message); }
    }
    return { errors, result: await withBrowserStorageLock("race", () => 123) };
  });
  assert.deepEqual(recovery, { errors: ["operation-failed", "Browser storage lock operations must be synchronous."], result: 123 });
  console.log("PASS: HTTP IndexedDB two-tab serialization (60 updates), failure release, and async rejection");
} finally {
  await browser.close();
}
