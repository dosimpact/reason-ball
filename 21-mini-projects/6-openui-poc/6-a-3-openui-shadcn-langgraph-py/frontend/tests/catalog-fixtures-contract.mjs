import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Load fixture data only; avoid importing browser effects or model clients.
function load(filename, name, extract = false) {
  let source = readFileSync(filename, "utf8");
  if (extract) {
    const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const declaration = tree.statements.flatMap(statement => ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : []).find(node => node.name.getText(tree) === name);
    assert.ok(declaration?.initializer, `Missing fixture declaration: ${name}`);
    const additions = tree.statements.filter(statement => ts.isExpressionStatement(statement) && statement.getText(tree).startsWith(`${name}.push(`)).map(statement => statement.getText(tree));
    source = `const ${name} = ${declaration.initializer.getText(tree)};\n${additions.join("\n")}`;
  }
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  return vm.runInNewContext(`${js}\n${extract ? name : `exports.${name}`}`, { exports: {} });
}
const fixtures = [...load("src/lib/catalog-fixtures.ts", "baseCatalogFixtures"), ...load("src/lib/shadcn-genui/expanded-shadcn/index.tsx", "additionalFixtures", true), ...load("src/lib/shadcn-genui/magic/fixtures.ts", "magicFixtures")];
const registered = new Set(Object.keys(JSON.parse(readFileSync("src/generated/spec.json", "utf8")).components));
const covered = new Set(), ids = new Set();
for (const fixture of fixtures) {
  assert.ok(!ids.has(fixture.id), `Duplicate fixture: ${fixture.id}`);
  ids.add(fixture.id);
  assert.match(fixture.source, /root\s*=\s*Card\(/, `${fixture.id}: missing Card root`);
  assert.doesNotMatch(fixture.source, /\b(?:Query|Mutation)\s*\(/, `${fixture.id}: cannot call tools`);
  const calls = new Set([...fixture.source.matchAll(/\b([A-Z][A-Za-z0-9]*)\s*\(/g)].map(match => match[1]));
  for (const name of fixture.components) {
    assert.ok(registered.has(name), `${fixture.id}: unregistered ${name}`);
    assert.ok(calls.has(name), `${fixture.id}: metadata claims unused ${name}`);
    covered.add(name);
  }
  for (const name of calls) assert.ok(registered.has(name), `${fixture.id}: unknown ${name}`);
}
assert.deepEqual([...registered].filter(name => !covered.has(name)), [], "Definitions missing fixture coverage");
console.log(`Fixture contract passed: ${registered.size} definitions, ${fixtures.length} deterministic fixtures.`);
