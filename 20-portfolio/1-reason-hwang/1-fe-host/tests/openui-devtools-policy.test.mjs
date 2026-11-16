import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function configuration(flag) {
  const env = { ...process.env };
  if (flag === undefined) delete env.OPENUI_DEVTOOLS;
  else env.OPENUI_DEVTOOLS = flag;
  const code = `
    const imported=await import('./next.config.ts');
    const config=imported.default.default??imported.default;
    const webpack=config.webpack({resolve:{alias:{'private-next-pages':'preserved',react:'native'}}});
    const target=config.turbopack.resolveAlias['@openuidev/devtools'];
    let widget;
    if(target){const loaded=await import(new URL(target,new URL('./',import.meta.url)));widget=(loaded.OpenUIDevtools??loaded.default.OpenUIDevtools)();}
    console.log(JSON.stringify({turbo:config.turbopack.resolveAlias,webpack:webpack.resolve.alias,...(target?{widget}: {})}));
  `;
  return JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], { cwd: root, env, encoding: "utf8" }));
}

test("default disables only the optional SDK widget in both bundlers", () => {
  const result = configuration(undefined);
  const target = path.join(root, "src/shared/config/openui-devtools-disabled.ts");
  assert.deepEqual(result.turbo, { "@openuidev/devtools": "./src/shared/config/openui-devtools-disabled.ts" });
  assert.equal(result.webpack["@openuidev/devtools$"], target);
  assert.equal(result.webpack["private-next-pages"], "preserved");
  assert.equal(result.webpack.react, "native");
  assert.equal(result.widget, null);
});
test("explicit OPENUI_DEVTOOLS=true leaves native SDK diagnostics available", () => {
  const result = configuration("true");
  assert.deepEqual(result.turbo, {});
  assert.deepEqual(result.webpack, { "private-next-pages": "preserved", react: "native" });
});
test("a false flag cannot accidentally enable CDN-backed devtools", () => {
  assert.ok(configuration("false").turbo["@openuidev/devtools"]);
});
