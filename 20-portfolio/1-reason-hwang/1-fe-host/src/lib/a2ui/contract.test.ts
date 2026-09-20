import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import { componentSchema, definitions, type ComponentName } from "./definitions";
import { fixtures, fixtureOperations } from "./fixtures";
import catalog from "./generated/host.catalog.json";
import secCatalog from "./generated/sec.catalog.json";
import messages from "./generated/specification/server_to_client.json";
import common from "./generated/specification/common_types.json";

// The official v0.9 schema uses additionalProperties on an untyped JSON value.
// This is valid JSON Schema, although Ajv's optional strictTypes lint rejects it.
const ajv = new Ajv2020({ strict: true, strictTypes: false, allowUnionTypes: true });
ajv.addKeyword({ keyword: "catalogId", schemaType: "string" });
ajv.addKeyword({ keyword: "components", schemaType: "object" });
ajv.addSchema(catalog, "https://a2ui.org/specification/v0_9/catalog.json");
ajv.addSchema(common);
const validate = ajv.compile(messages);

describe("A2UI v0.9 catalog contracts", () => {
  for (const name of Object.keys(definitions) as ComponentName[]) {
    it(`${name} accepts the same fixture in Zod and the official wire schema`, () => {
      expect(definitions[name].props.safeParse(fixtures[name]).success).toBe(true);
      for (const operation of fixtureOperations(name)) {
        expect(validate(operation), JSON.stringify(validate.errors)).toBe(true);
      }
    });
  }

  it("rejects protocol drift and unregistered component props", () => {
    const operations = fixtureOperations("Button");
    expect(validate({ ...operations[0], version: "v0.9.1" })).toBe(false);
    const update = operations[1].updateComponents!;
    expect(validate({ version: "v0.9", updateComponents: { ...update, components: [{ ...update.components[0], invented: true }] } })).toBe(false);
    expect(definitions.Button.props.safeParse({ ...fixtures.Button, invented: true }).success).toBe(false);
  });

  it("rejects invalid constraints in both schema representations", () => {
    expect(definitions.Slider.props.safeParse({ label: "x", value: 1, min: 0, max: 2, step: 0 }).success).toBe(false);
    expect(validate({ version: "v0.9", updateComponents: { surfaceId: "test", components: [{ id: "root", component: "Slider", label: "x", value: 1, min: 0, max: 2, step: 0 }] } })).toBe(false);
  });

  it("keeps SEC actions isolated from the existing demo catalog", () => {
    const props = { label: "회사 검색", action: { event: { name: "sec_search", context: { query: { path: "/query" }, revision: 1 } } } };
    expect(componentSchema("Button", "sec").safeParse(props).success).toBe(true);
    expect(componentSchema("Button", "dynamic").safeParse(props).success).toBe(false);
    const validateSec = ajv.compile({ ...secCatalog, $ref: "#/$defs/anyComponent" });
    expect(validateSec({ id: "search", component: "Button", ...props })).toBe(true);
    expect(validateSec({ id: "search", component: "Button", ...fixtures.Button })).toBe(false);
  });
});
