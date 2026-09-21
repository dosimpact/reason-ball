import assert from "node:assert/strict";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Verify the emitted module outside the Next.js workspace and its node_modules.
const directory = await mkdtemp(join(tmpdir(), "codeweave-core-"));
try {
  await cp(new URL("../.codeweave-build/", import.meta.url), directory, {
    recursive: true,
  });
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({ type: "module" }),
  );
  const core = await import(pathToFileURL(join(directory, "index.js")).href);
  const source = "[App]\n  -> (+) Custom: portable";
  const document = core.compileCodeWeave(source);
  assert.equal(document.ok, true);
  assert.equal(core.getVisibleRows(document)[1].marker, "+");
  const result = core.updateNode(
    document,
    "line:2",
    { text: "edited" },
    source,
  );
  assert.equal(result.ok, true);
  assert.equal(core.getNodeAtLine(result.document, 2).text, "edited");
  console.log("CodeWeave standalone ESM import, compile, tree and edit: PASS");
} finally {
  await rm(directory, { recursive: true, force: true });
}
