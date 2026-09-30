import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import * as zod from "zod";
import * as difficulty from "../../src/shared/api/supabase/mission-difficulty";
import * as versionFields from "../../src/shared/api/supabase/mission-version-fields";
import * as displayMetadata from "../../src/shared/api/supabase/version-display-metadata";
import * as levelValidation from "../../src/shared/api/supabase/mission-level-validation";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
const compiled = ts.transpileModule(readFileSync(resolve("src/shared/api/supabase/domain.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function loadList(privileged: SupabaseClient) {
  const exported: Record<string, unknown> = {};
  new Function("require", "exports", compiled)((name: string) => {
    if (name === "server-only") return {};
    if (name === "zod") return zod;
    if (name === "./mission-difficulty") return difficulty;
    if (name === "./mission-version-fields") return versionFields;
    if (name === "./version-display-metadata") return displayMetadata;
    if (name === "./mission-level-validation") return levelValidation;
    if (name === "./http") return {
      createPrivilegedClient: () => privileged,
      assertDatabaseSuccess: (error: unknown) => { if (error) throw new Error("Database page failed"); },
      SupabaseHttpError: class extends Error {
        constructor(_status: number, code: string, message: string) { super(`${code}: ${message}`); }
      },
    };
    throw new Error(`Unexpected runtime import: ${name}`);
  }, exported);
  return exported.listMissions as typeof import("../../src/shared/api/supabase/domain").listMissions;
}

function fixture(count: number): Tables {
  const data: Tables = { missions: [], mission_versions: [], mission_steps: [], mission_characters: [], mission_assets: [], mission_catalog_instruction_fields: [] };
  for (let i = 0; i < count; i++) {
    const id = `mission-${String(i).padStart(4, "0")}`;
    const version = `version-${String(i).padStart(4, "0")}`;
    data.missions.push({ id, slug: id, title: `Mission ${i}`, summary: "Practice", scenario_category: i === 0 ? "social" : "work", difficulty: "B2", estimated_minutes: 10, status: "published", current_version_id: version, reward_experience_points: 10, completion_count: 0, featured: i === count - 1, created_at: "2026-09-21T00:00:00Z" });
    data.mission_versions.push({ id: version, mission_id: id, version_number: 1, learning_goals: [], scenario_context: "A meeting", learner_role: "Learner", character_role: "Colleague", opening_instruction: "Let's begin", target_vocabulary: [], target_grammar: [], pass_score: 70, display_metadata: null });
    data.mission_catalog_instruction_fields.push({ mission_version_id: version, evaluator_config: { prerequisites: [], secretPolicy: "Never expose private evaluator settings", ...(i === 0 ? { catalogDisplay: { location: "업무 · 회의", description: "확인할 문제\n\n합의할 다음 행동" }, catalogImport: { source: { privateScenario: "Do not expose this snapshot" } } } : {}) } });
    for (let step = 0; step < (i === 0 ? 1105 : 4); step++) {
      data.mission_steps.push({ id: `${version}-step-${String(step).padStart(4, "0")}`, mission_version_id: version, step_order: step + 1, title: `Step ${step}`, objective: `Goal ${step}`, learner_goal: `Goal ${step}`, hints: ["Hint"], success_criteria: ["Communicate the meaning"], is_optional: false });
    }
    for (let character = 0; character < (i === 0 ? 1005 : 1); character++) {
      data.mission_characters.push({ mission_id: id, character_id: `character-${String(character).padStart(4, "0")}`, is_recommended: false });
    }
    if (i === 0) {
      for (let asset = 0; asset < 1005; asset++) data.mission_assets.push({ id: `asset-${String(asset).padStart(4, "0")}`, mission_id: id, storage_bucket: "mission-public", storage_path: `scene-${asset}.png`, asset_type: "scene", is_primary: false, access_level: "public" });
      data.mission_assets.push({ id: "asset-z-badge", mission_id: id, storage_bucket: "mission-public", storage_path: "badge.png", asset_type: "badge", is_primary: false, access_level: "public" });
      data.mission_assets.push({ id: "asset-private", mission_id: id, storage_bucket: "mission-private", storage_path: "secret.png", asset_type: "badge", is_primary: true, access_level: "owner" });
    }
  }
  // Simulate input order unrelated to equal timestamps and sort priorities.
  for (const rows of Object.values(data)) rows.reverse();
  return data;
}

function transport(data: Tables, cap = 1000, fault?: { table: string; kind: "fail" | "repeat" }) {
  const requests: Array<{ url: URL; privileged: boolean }> = [];
  function client(privileged: boolean) {
    return createClient("http://supabase.test", privileged ? "service-test-key" : "public-test-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input) => {
        const url = new URL(String(input));
        requests.push({ url, privileged });
        // The fixture uses short IDs; verify the equivalent real UUID URL budget.
        expect(url.href.replace(/(?:mission|version)-\d{4}/g, "10000000-0000-4000-8000-000000000001").length).toBeLessThan(8_000);
        const table = url.pathname.split("/").pop()!;
        const offset = Number(url.searchParams.get("offset") ?? 0);
        expect(privileged).toBe(["mission_versions", "mission_steps", "mission_assets", "mission_catalog_instruction_fields"].includes(table));
        if (fault?.table === table && fault.kind === "fail" && offset > 0) return Response.json({ code: "XX000", message: "Unavailable" }, { status: 500 });
        let rows = [...(data[table] ?? [])];
        for (const [key, filter] of url.searchParams) {
          if (filter.startsWith("eq.")) rows = rows.filter((row) => String(row[key]) === filter.slice(3));
          if (filter.startsWith("in.(")) {
            const values = filter.slice(4, -1).split(",");
            expect(values.length).toBeLessThanOrEqual(100);
            rows = rows.filter((row) => values.includes(String(row[key])));
          }
        }
        const orders = (url.searchParams.get("order") ?? "").split(",").filter(Boolean);
        rows.sort((left, right) => {
          for (const order of orders) {
            const [key, direction] = order.split(".");
            const comparison = typeof left[key] === "number" || typeof left[key] === "boolean"
              ? Number(left[key]) - Number(right[key]) : String(left[key]).localeCompare(String(right[key]));
            if (comparison) return direction === "desc" ? -comparison : comparison;
          }
          return 0;
        });
        const start = fault?.table === table && fault.kind === "repeat" ? 0 : offset;
        const size = Math.min(Number(url.searchParams.get("limit") ?? 1000), cap);
        return Response.json(rows.slice(start, start + size));
      } },
    });
  }
  return { client: client(false), privileged: client(true), requests };
}

for (const [count, cap] of [[752, 1000], [1052, 37]]) {
  test(`loads ${count} missions and every child under a ${cap}-row server cap`, async () => {
    const { client, privileged, requests } = transport(fixture(count), cap);
    const result = await loadList(privileged)(client);
    expect(result).toHaveLength(count);
    if (count === 752 && cap === 1000) expect(requests.length).toBeLessThanOrEqual(115);
    expect(new Set(result.map((item) => item.id)).size).toBe(count);
    expect(result[0].id).toBe(`mission-${String(count - 1).padStart(4, "0")}`);
    const first = result.find((item) => item.id === "mission-0000")!;
    expect(first.category).toBe("관계");
    expect(first.location).toBe("업무 · 회의");
    expect(first.description).toBe("확인할 문제\n\n합의할 다음 행동");
    expect(result[0].location).toBe("A meeting");
    expect(result[0].description).toBe("Practice");
    expect(JSON.stringify(result)).not.toContain("privateScenario");
    expect(JSON.stringify(result)).not.toContain("Do not expose this snapshot");
    expect(first.steps).toHaveLength(1105);
    expect(first.steps?.at(-1)?.label).toBe("Goal 1104");
    expect(first.recommendedCharacterId).toBe("character-0000");
    expect(first.rewardImageUrl).toContain("/mission-public/badge.png");
    expect(result[0].steps).toHaveLength(4);
    expect(JSON.stringify(result)).not.toContain("secretPolicy");
    expect(JSON.stringify(result)).not.toContain("secret.png");
    expect(requests.every(({ url }) => Number(url.searchParams.get("limit")) <= 200)).toBe(true);
    expect(requests.filter(({ url }) => url.pathname.endsWith("/missions")).every(({ url }) => url.searchParams.get("order") === "id.asc")).toBe(true);
    for (const table of ["mission_steps", "mission_characters", "mission_assets"]) {
      expect(requests.some(({ url }) => url.pathname.endsWith(`/${table}`) && Number(url.searchParams.get("offset")) >= 1000)).toBe(true);
    }
  });
}

test("empty catalog does not query privileged instructions or other relations", async () => {
  const { client, privileged, requests } = transport(fixture(0));
  expect(await loadList(privileged)(client)).toEqual([]);
  expect(requests).toHaveLength(1);
  expect(requests[0].privileged).toBe(false);
});

for (const table of ["missions", "mission_versions", "mission_steps", "mission_characters", "mission_assets", "mission_catalog_instruction_fields"]) {
  test(`${table} later-page errors reject rather than returning a partial catalog`, async () => {
    const { client, privileged } = transport(fixture(55), 37, { table, kind: "fail" });
    await expect(loadList(privileged)(client)).rejects.toThrow("Database page failed");
  });
}

test("repeated mission and child pages fail instead of looping or duplicating results", async () => {
  for (const table of ["missions", "mission_steps"]) {
    const { client, privileged } = transport(fixture(55), 37, { table, kind: "repeat" });
    await expect(loadList(privileged)(client)).rejects.toThrow("MISSION_PAGE_INCONSISTENT");
  }
});

for (const field of ["prerequisites", "objectives", "catalogDisplay"]) {
  test(`projected explicit null ${field} fails closed, while missing fields use legacy behavior`, async () => {
    const data = fixture(1);
    data.mission_catalog_instruction_fields[0].evaluator_config = {};
    const legacy = transport(data);
    expect(await loadList(legacy.privileged)(legacy.client)).toHaveLength(1);
    data.mission_catalog_instruction_fields[0].evaluator_config = { [field]: null };
    const invalid = transport(data);
    await expect(loadList(invalid.privileged)(invalid.client)).rejects.toThrow();
  });
}

test("privileged child queries stay scoped to visible parents and character links retain caller RLS", async () => {
  const data = fixture(2);
  data.missions = data.missions.filter((row) => row.id === "mission-0000");
  // The request-scoped transport represents links filtered by can_view_character.
  data.mission_characters = [];
  const { client, privileged, requests } = transport(data);
  const result = await loadList(privileged)(client);
  expect(result).toHaveLength(1);
  expect(result[0].recommendedCharacterId).toBe("");
  for (const { url, privileged: elevated } of requests) {
    if (url.pathname.endsWith("/mission_characters")) expect(elevated).toBe(false);
    if (!elevated) continue;
    for (const key of ["id", "mission_id", "mission_version_id"]) {
      const filter = url.searchParams.get(key);
      if (filter) expect(filter).not.toContain("0001");
    }
    if (url.pathname.endsWith("/mission_versions")) expect(url.searchParams.get("mission_id")).toBe("in.(mission-0000)");
    if (url.pathname.endsWith("/mission_assets")) expect(url.searchParams.get("access_level")).toBe("eq.public");
  }
});

test("a mismatched or missing parent version fails before privileged child hydration", async () => {
  for (const mismatch of [true, false]) {
    const data = fixture(1);
    if (mismatch) data.mission_versions[0].mission_id = "hidden-parent";
    else data.mission_versions = [];
    const { client, privileged, requests } = transport(data);
    await expect(loadList(privileged)(client)).rejects.toThrow("MISSION_VERSION_UNAVAILABLE");
    expect(requests.every(({ url }) => ["missions", "mission_versions"].includes(url.pathname.split("/").pop()!))).toBe(true);
  }
});
