import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { compatibility } from "../src/lib/a2ui/compatibility";
import { catalogId, componentSchema, definitions, profileComponents, type CatalogProfile } from "../src/lib/a2ui/definitions";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const host = resolve(root, "1-fe-host");
const output = resolve(root, "assets/a2ui");
const pythonResources = resolve(root, "3-langgraph-fast/src/graph/primary_graphs/a2ui_demo/contracts");
const frontendResources = resolve(host, "src/lib/a2ui/generated");
const check = process.argv.includes("--check");
const require = createRequire(resolve(host, "package.json"));

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sorted(item)]),
  );
  return value;
}
const serialize = (value: unknown) => `${JSON.stringify(sorted(value), null, 2)}\n`;
const digest = (text: string) => createHash("sha256").update(text).digest("hex");

function emit(directory: string, name: string, content: string) {
  const path = resolve(directory, name);
  if (check) {
    let existing = "";
    try { existing = readFileSync(path, "utf8"); } catch { /* reported below */ }
    if (existing !== content) throw new Error(`Stale A2UI artifact: ${path}. Run pnpm a2ui:generate.`);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}

function verifyVersions() {
  for (const [name, version] of Object.entries(compatibility.javascript)) {
    const actual = name === "@a2ui/web_core"
      ? JSON.parse(readFileSync(resolve(dirname(require.resolve(`${name}/v0_9`)), "../../package.json"), "utf8")).version
      : require(`${name}/package.json`).version;
    if (actual !== version) throw new Error(`${name}: expected ${version}, installed ${actual}`);
  }
  const actual = JSON.parse(execFileSync(resolve(root, "3-langgraph-fast/.venv/bin/python"), ["-c",
    "import json,importlib.metadata as m;print(json.dumps({n:m.version(n) for n in " + JSON.stringify(Object.keys(compatibility.python)) + "}))",
  ], { encoding: "utf8" }));
  for (const [name, version] of Object.entries(compatibility.python)) {
    if (actual[name] !== version) throw new Error(`${name}: expected ${version}, installed ${actual[name]}`);
  }
}

function verifyInventory() {
  const files = readdirSync(resolve(host, "src/components/ui")).filter(name => name.endsWith(".tsx") && !name.endsWith(".stories.tsx")).map(name => name.slice(0, -4)).sort();
  const registered = Object.values(definitions).flatMap(def => def.source ? [def.source] : []).sort();
  if (JSON.stringify(files) !== JSON.stringify(registered)) throw new Error("UI file inventory and A2UI registration differ");
  return Object.fromEntries(Object.entries(definitions).map(([name, def]) => [name, { source: def.source, description: def.description }]));
}

function buildCatalog(profile: CatalogProfile) {
  const components = Object.fromEntries(profileComponents[profile].map(name => {
    // Our contract vocabulary has no tuples/recursive refs/draft-specific keywords.
    // Strip the converter's dialect declaration; the emitted document uses 2020-12.
    const props = zodToJsonSchema(componentSchema(name, profile), { $refStrategy: "none", target: "jsonSchema7" });
    const { $schema: _dialect, ...shape } = props as { $schema?: string; properties: Record<string, unknown>; required?: string[] };
    void _dialect;
    return [name, {
      ...shape,
      properties: { id: { type: "string", minLength: 1 }, component: { const: name }, ...shape.properties },
      required: ["id", "component", ...(shape.required ?? [])],
      additionalProperties: false,
    }];
  }));
  return {
    $schema: compatibility.jsonSchemaDialect,
    $id: catalogId(profile), catalogId: catalogId(profile),
    components,
    $defs: {
      anyComponent: { oneOf: Object.keys(components).map(name => ({ $ref: `#/components/${name}` })) },
      theme: { type: "object", additionalProperties: false },
    },
  };
}

verifyVersions();
const inventory = verifyInventory();
const catalogHashes: Record<string, { catalogId: string; sha256: string; components: string[] }> = {};
for (const profile of Object.keys(profileComponents) as CatalogProfile[]) {
  const catalog = buildCatalog(profile);
  const validator = new Ajv2020({ strict: true, allowUnionTypes: true });
  // A2UI catalog metadata are annotations, not validation rules.
  validator.addKeyword("catalogId");
  validator.addKeyword({ keyword: "components", schemaType: "object" });
  validator.compile({ ...catalog, $ref: "#/$defs/anyComponent" });
  const content = serialize(catalog);
  catalogHashes[profile] = { catalogId: catalogId(profile), sha256: digest(content), components: profileComponents[profile] };
  for (const directory of [output, pythonResources, frontendResources]) emit(directory, `${profile}.catalog.json`, content);
}
const specDirectory = resolve(output, "specification/v0_9");
const provenance = JSON.parse(readFileSync(resolve(specDirectory, "provenance.json"), "utf8"));
for (const [file, sha256] of Object.entries(provenance.files)) {
  const content = readFileSync(resolve(specDirectory, file), "utf8");
  if (digest(content) !== sha256) throw new Error(`Official schema hash mismatch: ${file}`);
  emit(pythonResources, `specification/${file}`, content);
  emit(frontendResources, `specification/${file}`, content);
}
const manifest = serialize({ ...compatibility, catalogs: catalogHashes, specification: provenance });
for (const directory of [output, pythonResources, frontendResources]) emit(directory, "manifest.json", manifest);
emit(output, "inventory.json", serialize(inventory));
console.log(`A2UI ${check ? "checked" : "generated"}: 61 UI sources, ${Object.keys(definitions).length} adapters, ${Object.keys(profileComponents).length} catalogs; protocol ${compatibility.protocolVersion}`);
