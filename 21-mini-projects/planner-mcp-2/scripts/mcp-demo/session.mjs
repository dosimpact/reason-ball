import assert from "node:assert/strict";
import { mkdir, appendFile, writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export async function openSession() {
  const endpoint =
    process.env.PLANNER_MCP_URL || "http://dodonet.iptime.org:14000/mcp";
  const runId = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const evidence = "test-results/mcp-demo/" + runId;
  await mkdir(evidence, { recursive: true });
  const client = new Client({
    name: "planner-mcp-only-demo",
    version: "1.0.0",
  });
  await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
  let sequence = 0;
  const called = new Set(),
    projects = new Set(),
    documents = new Set(),
    results = [];
  const manifest = { runId, endpoint, evidence, projects: [], documents: [] };
  async function save() {
    manifest.projects = [...projects];
    manifest.documents = [...documents];
    await writeFile(
      evidence + "/manifest.json",
      JSON.stringify(manifest, null, 2),
    );
    await writeFile(
      evidence + "/results.json",
      JSON.stringify(results, null, 2),
    );
  }
  async function log(entry) {
    await appendFile(evidence + "/calls.jsonl", JSON.stringify(entry) + "\n");
  }
  async function call(
    name,
    args = {},
    expectError = false,
    connection = client,
  ) {
    const mutation = /^(create|update|delete|add|reopen|record)_/.test(name);
    if (mutation && name !== "create_project") {
      if (args.projectId)
        assert(projects.has(args.projectId), "Mutation outside owned project");
      if (args.documentId)
        assert(
          documents.has(args.documentId),
          "Mutation outside owned document",
        );
    }
    const seq = ++sequence;
    called.add(name);
    const response = await connection.callTool({ name, arguments: args });
    const raw =
      response.content
        ?.filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n") || "";
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { text: raw };
    }
    await log({
      seq,
      time: new Date().toISOString(),
      name,
      arguments: args,
      isError: !!response.isError,
      data,
    });
    if (expectError) {
      assert(response.isError, name + " should reject " + JSON.stringify(args));
      return data;
    }
    assert(!response.isError, name + ": " + raw);
    if (name === "create_project") {
      projects.add(data.id);
      for (const doc of data.indexes) documents.add(doc.id);
    }
    if (name === "create_document" || name === "record_verification")
      documents.add(data.id);
    if (mutation) await save();
    return data;
  }
  async function listTools() {
    const result = await client.listTools();
    await log({
      seq: ++sequence,
      time: new Date().toISOString(),
      name: "tools/list",
      data: result,
    });
    return result.tools;
  }
  const get = (id) =>
    call("get_document", { documentId: typeof id === "string" ? id : id.id });
  async function patch(doc, changes) {
    const current = await get(doc);
    return call("update_document", {
      documentId: current.id,
      expectedRevision: current.revision,
      ...changes,
    });
  }
  async function create(
    project,
    title,
    phase = "design",
    templateName = "view",
    extra = {},
  ) {
    return call("create_document", {
      projectId: project.id,
      title,
      phase,
      templateName,
      ...extra,
    });
  }
  async function add(doc, label, position) {
    const current = await get(doc);
    return call("add_checklist_item", {
      documentId: current.id,
      expectedRevision: current.revision,
      label,
      ...(position === undefined ? {} : { position }),
    });
  }
  async function check(doc, itemId, changes) {
    const current = await get(doc);
    return call("update_checklist_item", {
      documentId: current.id,
      expectedRevision: current.revision,
      itemId,
      ...changes,
    });
  }
  async function rejectPatch(doc, changes) {
    const current = await get(doc);
    const error = await call(
      "update_document",
      {
        documentId: current.id,
        expectedRevision: current.revision,
        ...changes,
      },
      true,
    );
    assert.deepEqual(await get(doc), current);
    return error;
  }
  async function cw(doc, extra = {}) {
    return call("get_codeweave", {
      documentId: doc.id,
      extensionId: "code-flow",
      ...extra,
    });
  }
  async function edit(doc, nodeId, changes) {
    const current = await cw(doc);
    return call("update_codeweave_node", {
      documentId: doc.id,
      extensionId: "code-flow",
      expectedRevision: current.revision,
      expectedSource: current.source,
      nodeId,
      patch: changes,
    });
  }
  async function test(id, fn) {
    const start = sequence + 1;
    try {
      await fn();
      results.push({
        id,
        status: "PASS",
        calls: [Math.min(start, sequence) === start ? start : 1, sequence],
      });
    } catch (error) {
      results.push({
        id,
        status: "FAIL",
        calls: [Math.min(start, sequence) === start ? start : 1, sequence],
        detail: error.message,
      });
    }
    console.log(id, results.at(-1).status, results.at(-1).detail || "");
    await save();
  }
  return {
    client,
    endpoint,
    runId,
    evidence,
    manifest,
    results,
    called,
    call,
    listTools,
    get,
    patch,
    create,
    add,
    check,
    rejectPatch,
    cw,
    edit,
    test,
    save,
    get sequence() {
      return sequence;
    },
    async reconnect() {
      const c = new Client({ name: "planner-mcp-readback", version: "1" });
      await c.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
      return c;
    },
  };
}
