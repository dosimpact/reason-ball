import assert from "node:assert/strict";
import { extensions, markdown } from "./fixtures.mjs";

export async function runCases(
  s,
  demo,
  scratch,
  docs,
  masterExample,
  templates,
  tools,
  originalProjects,
) {
  const { call, test, get, patch, create, add, check, rejectPatch, cw, edit } =
    s;
  let work, child, overview, checkDoc, fixture, fixtureResult, weave;
  const index = (p, phase) => p.indexes.find((d) => d.phase === phase);
  await test("M01", async () => {
    const rules = await call("get_workflow_rules");
    assert.equal(rules.domains.length, 5);
    assert.match(JSON.stringify(rules), /human|사람/);
    assert.match(JSON.stringify(rules), /설계|design/i);
  });
  await test("M02", async () => {
    assert.equal(tools.length, 24);
    for (const name of ["update_document", "update_codeweave_node"]) {
      assert(
        tools.find((t) => t.name === name).inputSchema.properties
          .expectedRevision,
      );
    }
    assert(
      tools.find((t) => t.name === "update_codeweave_node").inputSchema
        .properties.expectedSource,
    );
  });
  await test("M03", async () => {
    assert((await call("list_projects")).some((p) => p.id === scratch.id));
    assert.equal(
      (await call("get_project", { projectId: scratch.id })).title,
      scratch.title,
    );
    await call("update_project", {
      projectId: scratch.id,
      title: "MCP 임시 테스트 · 삭제 예정",
    });
    assert.equal(
      (await call("get_project", { projectId: scratch.id })).title,
      "MCP 임시 테스트 · 삭제 예정",
    );
  });
  await test("M04", async () => {
    assert.equal(demo.indexes.length, 3);
    assert(demo.indexes.every((d) => d.kind === "index"));
    const nodes = await call("list_flow_nodes", { projectId: demo.id });
    assert.deepEqual(
      nodes.sort((a, b) => a.position - b.position).map((n) => n.phase),
      ["design", "implementation", "verification"],
    );
  });
  await test("M05", async () => {
    assert.equal(templates.length, 8);
    for (const name of [
      "design-verification-view",
      "design-verification-api",
      "design-verification-e2e",
    ]) {
      const t = await call("get_template", { name });
      assert(t.body && t.example && t.prompt && t.checklist.length >= 3);
    }
  });
  await test("M06", async () => {
    const template = await call("get_template", { name: "view" });
    work = await create(scratch, "인스턴스 독립성");
    assert.deepEqual(work.templateSnapshot, template);
    await patch(work, { body: "인스턴스만 수정" });
    assert.deepEqual((await get(work)).templateSnapshot, template);
    assert.deepEqual(await call("get_template", { name: "view" }), template);
  });
  await test("M07", async () => {
    child = await create(scratch, "하위 설계", "design", "view", {
      parentId: work.id,
    });
    const grand = await create(scratch, "손자 설계", "design", "view", {
      parentId: child.id,
    });
    const parent = await get(work);
    assert(
      parent.children.some(
        (d) => d.id === child.id && d.href.includes(child.id),
      ),
    );
    assert((await get(child)).children.some((d) => d.id === grand.id));
    assert(
      (
        await call("list_documents", {
          projectId: scratch.id,
          parentId: work.id,
        })
      ).some((d) => d.id === child.id),
    );
  });
  await test("M08", async () => {
    await patch(work, { body: markdown });
    assert.equal((await get(work)).body, markdown);
  });
  await test("M09", async () => {
    overview = await create(scratch, "업무 Overview", "design", "overview");
    const entries = [
      {
        id: "root",
        parentId: null,
        title: "프로젝트 시작",
        what: "설계 범위 정의",
        how: "MCP로 작성",
        verificationDocumentId: work.id,
      },
      {
        id: "child",
        parentId: "root",
        title: "구현",
        what: "합의 범위 구현",
        how: "AI 실행",
        verificationDocumentId: null,
      },
    ];
    await patch(overview, { overview: entries });
    assert.deepEqual((await get(overview)).overview, entries);
    entries[1].what = "설계된 범위만 구현";
    await patch(overview, { overview: entries });
    assert.deepEqual((await get(overview)).overview, entries);
  });
  await test("M10", async () => {
    checkDoc = await create(scratch, "정형 체크 실험", "design", "view", {
      body: markdown,
    });
    await add(checkDoc, "추가 항목", 3);
    let doc = await get(checkDoc),
      item = doc.checklist.find((c) => c.label === "추가 항목");
    assert(item.id && item.position === 3);
    await check(checkDoc, item.id, { label: "변경 항목", position: 1 });
    assert(
      (await get(checkDoc)).checklist.some(
        (c) => c.id === item.id && c.label === "변경 항목" && c.position === 1,
      ),
    );
    doc = await get(checkDoc);
    await call("delete_checklist_item", {
      documentId: doc.id,
      itemId: item.id,
      expectedRevision: doc.revision,
    });
    doc = await get(checkDoc);
    assert(!doc.checklist.some((c) => c.id === item.id));
    assert.equal(doc.body, markdown);
  });
  await test("M11", async () => {
    const item = (await get(checkDoc)).checklist[0];
    for (const aiResult of ["pending", "passed", "failed", "skipped"]) {
      await check(checkDoc, item.id, { aiResult });
      const doc = await get(checkDoc);
      assert.equal(doc.checklist[0].aiResult, aiResult);
      assert.equal(doc.checklist[0].humanConfirmed, false);
      assert.notEqual(doc.status, "verified");
    }
  });
  await test("M12", async () => {
    const doc = await get(checkDoc);
    await call(
      "update_checklist_item",
      {
        documentId: doc.id,
        itemId: doc.checklist[0].id,
        expectedRevision: doc.revision,
        humanConfirmed: true,
      },
      true,
    );
    await call(
      "update_document",
      {
        documentId: doc.id,
        expectedRevision: doc.revision,
        status: "verified",
      },
      true,
    );
    assert.deepEqual(await get(checkDoc), doc);
  });
  await test("M13", async () => {
    fixture = await create(
      demo,
      "선택적 reopen 시연 · A만 재검증",
      "verification",
      "view",
      {
        parentId: docs.groups.progress.id,
        body: "# 선택적 재검증 시연\n\n이 문서는 상태 전이를 시험하기 위한 fixture입니다. 실제 기능의 검증 통과를 의미하지 않습니다.\n\nA와 B를 AI passed로 설정한 다음 A만 reopen합니다. B는 passed를 유지하며, 사람 확인은 모두 미확인입니다. H08에서 사람이 확인한 항목의 보존을 별도로 검증합니다.",
      },
    );
    await add(fixture, "B · 영향 없는 항목");
    let doc = await get(fixture);
    fixtureResult = await call("record_verification", {
      documentId: doc.id,
      expectedRevision: doc.revision,
      body: "첫 결과 · 상태 전이 fixture",
    });
    doc = await get(fixture);
    const second = await call("record_verification", {
      documentId: doc.id,
      expectedRevision: doc.revision,
      body: "최신 결과 · 같은 결과 문서를 갱신했습니다. M13 PASS. 이 데이터는 상태 전이 실험용입니다.",
    });
    assert.equal(second.id, fixtureResult.id);
    assert.equal(
      (await get(fixture)).children.filter(
        (c) => c.kind === "verification-result",
      ).length,
      1,
    );
    assert.match((await get(second)).body, /최신 결과/);
  });
  await test("M14", async () => {
    let doc = await get(fixture);
    for (const item of doc.checklist)
      await check(fixture, item.id, { aiResult: "passed" });
    doc = await get(fixture);
    await call("reopen_document", {
      documentId: doc.id,
      expectedRevision: doc.revision,
      affectedItemIds: [doc.checklist[0].id],
      reason: "시연: 첫 항목만 영향받음",
    });
    const after = await get(fixture);
    assert.equal(after.status, "reopen");
    assert.equal(after.checklist[0].aiResult, "pending");
    assert.equal(after.checklist[1].aiResult, "passed");
    assert(after.checklist.every((c) => !c.humanConfirmed));
  });
  await test("M15", async () => {
    const old = await get(checkDoc);
    await patch(checkDoc, { body: "최신 본문" });
    const current = await get(checkDoc);
    await call(
      "update_document",
      { documentId: old.id, expectedRevision: old.revision, body: "stale" },
      true,
    );
    await call(
      "update_checklist_item",
      {
        documentId: old.id,
        expectedRevision: old.revision,
        itemId: old.checklist[0].id,
        aiResult: "passed",
      },
      true,
    );
    await call(
      "delete_document",
      { documentId: old.id, expectedRevision: old.revision },
      true,
    );
    assert.deepEqual(await get(checkDoc), current);
  });
  await test("M16", async () => {
    const args = {
      projectId: scratch.id,
      label: "임시 노드",
      phase: "design",
      documentId: work.id,
      position: 3,
      coordinates: { x: 100, y: 210 },
    };
    const node = await call("create_flow_node", args);
    const moved = await call("update_flow_node", {
      ...args,
      nodeId: node.id,
      coordinates: { x: 340, y: 230 },
    });
    assert.deepEqual(moved.coordinates, { x: 340, y: 230 });
    const withoutCoordinates = { ...args };
    delete withoutCoordinates.coordinates;
    await call("update_flow_node", {
      ...withoutCoordinates,
      nodeId: node.id,
      label: "좌표 유지",
    });
    assert.deepEqual(
      (await call("list_flow_nodes", { projectId: scratch.id })).find(
        (n) => n.id === node.id,
      ).coordinates,
      moved.coordinates,
    );
    await call("delete_flow_node", { projectId: scratch.id, nodeId: node.id });
    assert(
      !(await call("list_flow_nodes", { projectId: scratch.id })).some(
        (n) => n.id === node.id,
      ),
    );
  });
  await test("M17", async () => {
    await call(
      "create_document",
      {
        projectId: scratch.id,
        title: "외부 부모",
        phase: "design",
        templateName: "view",
        parentId: docs.overview.id,
      },
      true,
    );
    await rejectPatch(overview, {
      overview: [
        {
          id: "foreign",
          parentId: null,
          title: "외부",
          what: "",
          how: "",
          verificationDocumentId: docs.view.id,
        },
      ],
    });
    await call(
      "create_flow_node",
      {
        projectId: scratch.id,
        label: "외부",
        phase: "design",
        documentId: docs.view.id,
        position: 4,
      },
      true,
    );
  });
  await test("M18", async () => {
    const entry = {
      id: "a",
      parentId: null,
      title: "A",
      what: "",
      how: "",
      verificationDocumentId: null,
    };
    for (const value of [
      [
        { ...entry, parentId: "b" },
        { ...entry, id: "b", parentId: "a" },
      ],
      [entry, entry],
      [{ ...entry, parentId: "missing" }],
    ])
      await rejectPatch(overview, { overview: value });
  });
  await test("M19", async () => {
    const children = (
      await call("list_documents", { projectId: scratch.id })
    ).filter((d) => d.id === child.id || d.parentId === child.id);
    const doc = await get(child);
    await call("delete_document", {
      documentId: doc.id,
      expectedRevision: doc.revision,
    });
    for (const d of children)
      await call("get_document", { documentId: d.id }, true);
    const idx = await get(index(scratch, "design"));
    await call(
      "delete_document",
      { documentId: idx.id, expectedRevision: idx.revision },
      true,
    );
    assert.equal((await get(idx)).id, idx.id);
  });
  await test("M20", async () => {
    await call("create_project", { title: " " }, true);
    await call(
      "create_document",
      {
        projectId: scratch.id,
        title: "wrong",
        phase: "invalid",
        templateName: "view",
      },
      true,
    );
    await call(
      "create_document",
      {
        projectId: scratch.id,
        title: "wrong",
        phase: "design",
        templateName: "missing-template-for-mcp-demo",
      },
      true,
    );
    await call("get_template", { name: "missing-template-for-mcp-demo" }, true);
  });
  await test("M21", async () => {
    weave = await create(scratch, "확장 실험", "design", "view", {
      extensions,
    });
    assert.deepEqual((await get(weave)).extensions, extensions);
    await patch(weave, { body: "확장 생략" });
    assert.deepEqual((await get(weave)).extensions, extensions);
    await patch(weave, { extensions: [] });
    assert.deepEqual((await get(weave)).extensions, []);
    await patch(weave, { extensions });
    assert.deepEqual((await get(weave)).extensions, extensions);
  });
  await test("M22", async () => {
    const graph = extensions[0];
    for (const value of [
      [graph, graph],
      [
        {
          ...graph,
          data: {
            ...graph.data,
            edges: [{ id: "bad", source: "missing", target: "design" }],
          },
        },
      ],
      [{ ...graph, schemaVersion: 2 }],
      [{ ...graph, type: "unknown" }],
      Array.from({ length: 11 }, (_, i) => ({ ...graph, id: "graph-" + i })),
    ])
      await rejectPatch(weave, { extensions: value });
  });
  await test("M23", async () => {
    await patch(weave, {
      extensions: [{ ...extensions[1], data: { source: masterExample } }],
    });
    const parsed = await cw(weave);
    assert(parsed.ok && parsed.diagnostics.length === 0);
    assert.equal(parsed.source, masterExample);
    for (const key of [
      "layer",
      "direction",
      "depth",
      "parentId",
      "prefix",
      "change",
      "comments",
    ])
      assert(key in parsed.nodes.find((n) => n.kind === "logic"));
    assert(
      parsed.nodes.some((n) => n.change === "added" && n.prefix === "EFFECT"),
    );
    assert(parsed.nodes.some((n) => n.change === "removed"));
    await patch(weave, { extensions });
  });
  await test("M24", async () => {
    const parsed = await cw(weave, { line: 1 });
    assert.equal(parsed.selected.kind, "layer");
    for (const key of ["direction", "prefix", "parentId"])
      assert.equal(parsed.selected[key], null);
    const returned = parsed.nodes.find((n) => n.text === "생성된 프로젝트");
    const sibling = parsed.nodes.find((n) => n.prefix === "CustomDomain");
    assert.equal(returned.direction, "<-");
    assert.equal(returned.depth, sibling.depth);
    assert.equal(returned.parentId, sibling.parentId);
  });
  await test("M25", async () => {
    const parsed = await cw(weave);
    assert(
      parsed.nodes.some(
        (n) => n.prefix === "CustomDomain" && n.change === "added",
      ),
    );
    assert(
      parsed.nodes.some((n) => n.prefix === "OLD" && n.change === "removed"),
    );
    assert(parsed.nodes.some((n) => n.change === "unchanged"));
    assert(parsed.source.includes("-> (+) CustomDomain:"));
    for (const node of parsed.nodes)
      for (const key of ["completed", "implemented", "status"])
        assert(!(key in node));
  });
  await test("M26", async () => {
    const parsed = await cw(weave);
    const owner = parsed.nodes.find((n) => n.prefix === "CHECK");
    assert.equal(owner.comments.length, 2);
    const block = owner.comments.find((c) => c.kind === "block");
    assert(block.text.includes("\n") && block.text.includes("[FakeLayer]"));
    for (let line = block.startLine; line <= block.endLine; line++) {
      assert.equal((await cw(weave, { line })).selected.id, owner.id);
    }
  });
  await test("M27", async () => {
    const parsed = await cw(weave);
    assert.equal(parsed.nodes.filter((n) => n.kind === "layer").length, 3);
    assert(
      !parsed.nodes.some(
        (n) => n.prefix === "Prefix" || n.text === "FakeLayer",
      ),
    );
    assert(
      parsed.nodes
        .find((n) => n.prefix === "CHECK")
        .comments.some((c) => c.text.includes("-> (+) Prefix:")),
    );
  });
  await test("M28", async () => {
    const invalid = [
      "[A]\n\t-> TEST: tab",
      "[A]\n   -> TEST: odd",
      "[A]\n    -> TEST: jump",
      "[A]\n  TEST: missing arrow",
      "[A]\n  -> TEST missing colon",
      "[A]\n  -> (+) (-) TEST: duplicate",
      "[A]\n  -> TEST: nested\n  /*\n  /*\n  */",
      "[A]\n  -> TEST: unclosed\n  /*\ntext",
    ];
    for (const badSource of invalid) {
      const error = await rejectPatch(weave, {
        extensions: [{ ...extensions[1], data: { source: badSource } }],
      });
      assert.match(JSON.stringify(error), /line|라인|[2-9]:[0-9]/i);
    }
  });
  await test("M29", async () => {
    for (const query of [
      "프로젝트 이름",
      "CustomDomain",
      "Application",
      "주석 내부 기호",
    ]) {
      assert((await cw(weave, { query })).matches.length > 0, query);
    }
  });
  await test("M30", async () => {
    const before = await get(weave);
    const node = (await cw(weave)).nodes.find(
      (n) => n.prefix === "CustomDomain",
    );
    const result = await edit(weave, node.id, {
      text: "수정된 알림",
      prefix: "사용자타입",
      direction: "<-",
      change: "removed",
    });
    const changed = result.nodes.find((n) => n.text === "수정된 알림");
    assert.equal(changed.prefix, "사용자타입");
    assert.equal(changed.direction, "<-");
    assert.equal(changed.change, "removed");
    assert.deepEqual(
      (await get(weave)).extensions.filter((e) => e.id !== "code-flow"),
      before.extensions.filter((e) => e.id !== "code-flow"),
    );
  });
  await test("M31", async () => {
    const node = (await cw(weave)).nodes.find((n) => n.prefix === "CHECK");
    let result = await edit(weave, node.id, {
      inlineComment: "새 설명",
      blockComment: "첫 줄\n둘째 줄\n-> (+) 기호 보존",
    });
    let changed = result.nodes.find((n) => n.prefix === "CHECK");
    assert(
      changed.comments.some(
        (c) => c.kind === "inline" && c.text.includes("새 설명"),
      ),
    );
    assert(
      changed.comments.some(
        (c) => c.kind === "block" && c.text.includes("첫 줄\n둘째 줄"),
      ),
    );
    result = await edit(weave, changed.id, {
      inlineComment: null,
      blockComment: null,
    });
    assert.deepEqual(
      result.nodes.find((n) => n.prefix === "CHECK").comments,
      [],
    );
  });
  await test("M32", async () => {
    const node = (await cw(weave)).nodes.find(
      (n) => n.kind === "layer" && n.text === "Application",
    );
    const result = await edit(weave, node.id, { text: "UseCase" });
    assert(
      result.nodes.some((n) => n.kind === "layer" && n.text === "UseCase"),
    );
    assert.equal(
      result.nodes.find((n) => n.prefix === "CHECK").layer,
      "UseCase",
    );
  });
  await test("M33", async () => {
    const old = await cw(weave);
    const node = old.nodes.find((n) => n.prefix === "CHECK");
    await edit(weave, node.id, { text: "최신 검증" });
    const current = await cw(weave);
    const args = {
      documentId: weave.id,
      extensionId: "code-flow",
      nodeId: node.id,
      patch: { text: "오래된 수정" },
    };
    await call(
      "update_codeweave_node",
      {
        ...args,
        expectedRevision: old.revision,
        expectedSource: current.source,
      },
      true,
    );
    await call(
      "update_codeweave_node",
      {
        ...args,
        expectedRevision: current.revision,
        expectedSource: old.source,
      },
      true,
    );
    assert.deepEqual(await cw(weave), current);
  });
  await test("M34", async () => {
    const old = await cw(weave);
    const doc = await get(weave);
    await patch(weave, {
      extensions: doc.extensions.map((e) =>
        e.id === "code-flow"
          ? { ...e, data: { source: "\n" + e.data.source } }
          : e,
      ),
    });
    const current = await cw(weave);
    assert.equal(current.nodes[0].id, "line:2");
    await call(
      "update_codeweave_node",
      {
        documentId: weave.id,
        extensionId: "code-flow",
        expectedRevision: current.revision,
        expectedSource: old.source,
        nodeId: old.nodes[0].id,
        patch: { text: "stale" },
      },
      true,
    );
    assert.equal((await cw(weave)).source, current.source);
  });
  await test("M35", async () => {
    const current = await cw(weave);
    const logic = current.nodes.find((n) => n.kind === "logic"),
      layer = current.nodes.find((n) => n.kind === "layer");
    for (const [nodeId, value] of [
      [logic.id, { prefix: "with space" }],
      [logic.id, { text: " " }],
      [layer.id, { direction: "<-" }],
      ["line:999", { text: "missing" }],
    ]) {
      await call(
        "update_codeweave_node",
        {
          documentId: weave.id,
          extensionId: "code-flow",
          expectedRevision: current.revision,
          expectedSource: current.source,
          nodeId,
          patch: value,
        },
        true,
      );
    }
    assert.deepEqual(await cw(weave), current);
  });
  await test("M36", async () => {
    const other = await cw(weave, { extensionId: "verification-flow" });
    assert.equal(other.source, extensions[2].data.source);
    for (const extensionId of ["missing", "architecture"])
      await call("get_codeweave", { documentId: weave.id, extensionId }, true);
  });
  await test("M37", async () => {
    for (const [key, template] of [
      ["view", "design-verification-view"],
      ["api", "design-verification-api"],
      ["e2e", "design-verification-e2e"],
    ]) {
      const doc = await get(docs[key]);
      assert.equal(doc.templateSnapshot.name, template);
      assert.equal(doc.kind, "design-verification");
      assert(doc.body.includes("설계") && doc.body.includes("검증"));
    }
    const implementation = await get(docs.implementation);
    assert.equal(implementation.phase, "implementation");
    assert.equal(implementation.kind, "implementation");
    assert(implementation.body.includes("기존 구현"));
    assert.equal((await get(docs.catalog)).phase, "verification");
  });
  await test("M38", async () => {
    const catalog = await get(index(demo, "verification"));
    assert(catalog.children.some((d) => d.id === docs.view.id));
    assert(catalog.children.some((d) => d.id === fixtureResult.id));
  });
  await test("M39", async () => {
    const current = await get(docs.extensions);
    const second = await s.reconnect();
    try {
      assert.deepEqual(
        await call("get_document", { documentId: current.id }, false, second),
        current,
      );
    } finally {
      await second.close();
    }
  });
  await test("M40", async () => {
    const owned = await call("list_documents", { projectId: scratch.id });
    await call("delete_project", { projectId: scratch.id });
    s.manifest.scratchDeleted = true;
    await call("get_project", { projectId: scratch.id }, true);
    for (const doc of owned)
      await call("get_document", { documentId: doc.id }, true);
    const remaining = await call("list_projects");
    assert(remaining.some((p) => p.id === demo.id));
    for (const original of originalProjects)
      assert.deepEqual(
        remaining.find((p) => p.id === original.id),
        original,
      );
  });
  await test("M41", async () => {
    assert.deepEqual([...s.called].sort(), tools.map((t) => t.name).sort());
  });
}
