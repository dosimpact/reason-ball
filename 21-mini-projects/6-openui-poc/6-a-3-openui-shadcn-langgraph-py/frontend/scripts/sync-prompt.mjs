// Explicit developer action; the running backend never reads frontend files.
import { copyFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const source = new URL("../src/generated/system-prompt.txt", import.meta.url);
const target = new URL("../../backend-langgraph/agent/system-prompt.txt", import.meta.url);
await copyFile(source, target);
assert.equal(await readFile(source, "utf8"), await readFile(target, "utf8"));
console.log("Synced shadcn prompt to Python. Restart backend after prompt changes.");
