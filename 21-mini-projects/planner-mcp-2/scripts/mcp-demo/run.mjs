import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { openSession } from "./session.mjs";
import { runCases } from "./suite.mjs";
import { cases, requirements, groups } from "./cases.mjs";
import { extensions, markdown } from "./fixtures.mjs";

const master = await readFile("master-requirement.md", "utf8");
const masterHash = createHash("sha256").update(master).digest("hex");
const masterExample = master
  .split(/\r?\n\[CodeWeave 요구사항\]\r?\n/)[1]
  .match(/\x60\x60\x60text\n([\s\S]*?)\n  \x60\x60\x60/)[1]
  .split("\n")
  .map((line) => line.slice(2))
  .join("\n");
const table = (list) =>
  "| ID | 요구 | 케이스 | 절차 | 기대 결과 |\n| --- | --- | --- | --- | --- |\n" +
  list
    .map(
      (c) =>
        "| " +
        [c.id, c.requirements.join(", "), c.title, c.steps, c.expected]
          .map((v) => v.replaceAll("|", "/"))
          .join(" | ") +
        " |",
    )
    .join("\n");
const catalog =
  "# MCP-only 종합 테스트 케이스\n\n기준: master-requirement.md · SHA-256 " +
  masterHash +
  "\n\n27개 요구사항 추적 그룹, MCP 41개 + 사람 확인 14개 = 총 55개. 케이스 연결은 요구 충족 판정과 다릅니다. MCP는 UI 조작·사람 확인·템플릿 원본 변경·서버 재시작을 증명할 수 없습니다.\n\n" +
  "## 요구사항 대응\n\n| ID | 원본 위치 | 완료 조건 | 테스트 |\n| --- | --- | --- | --- |\n" +
  requirements
    .map(
      ([id, anchor, acceptance]) =>
        "| " +
        [
          id,
          anchor,
          acceptance,
          cases
            .filter((c) => c.requirements.includes(id))
            .map((c) => c.id)
            .join(", "),
        ].join(" | ") +
        " |",
    )
    .join("\n") +
  "\n\n## MCP 실행\n\n" +
  table(cases.filter((c) => c.mode === "MCP")) +
  "\n\n## 사람 확인 대기\n\n" +
  table(cases.filter((c) => c.mode === "HUMAN")) +
  "\n";
await mkdir("docs/validation/mcp-demo", { recursive: true });
await writeFile("docs/validation/mcp-demo/test-cases.md", catalog);
const s = await openSession();
let demo, scratch;
const docs = { groups: {}, domains: [] };
try {
  const tools = await s.listTools();
  const rules = await s.call("get_workflow_rules");
  const templates = await s.call("list_templates");
  const originalProjects = await s.call("list_projects");
  demo = await s.call("create_project", {
    title: "MCP 종합 데모 · Planner MCP 2 · 설계→구현→검증",
  });
  s.manifest.demoId = demo.id;
  s.manifest.url = "http://dodonet.iptime.org:14000/projects/" + demo.id;
  s.manifest.masterHash = masterHash;
  await s.save();
  console.log("DEMO", s.manifest.url);
  for (const idx of demo.indexes) {
    await s.patch(idx, {
      body:
        "# " +
        { design: "설계", implementation: "구현", verification: "검증" }[
          idx.phase
        ] +
        " 단계\n\n이 프로젝트의 모든 데이터는 실제 MCP interface만으로 작성되었습니다.\n\n- 설계: Overview → 5개 도메인 → View/API/E2E 및 확장 예시\n- 구현: 기존 Planner 구현 구조와 이번 MCP 실행 방법\n- 검증: 전체 테스트 목록 → 그룹별 정형 체크리스트 → AI 결과 자식 문서\n\n사람 확인은 아직 수행하지 않았습니다. MCP 결과와 UI·Storybook·Bruno 확인 범위를 구분해서 봅니다.",
    });
  }
  docs.overview = await s.create(
    demo,
    "01 · 비즈니스 Overview · What / How",
    "design",
    "overview",
    {
      body: "# 설계 중심 AI 개발\n\n**What**: 사람은 의도와 완료 조건을 정하고, AI는 MCP로 설계된 범위의 문서를 읽어 구현과 1차 검증을 수행합니다.\n\n**How**: 5개 도메인, 단계별 index, 독립 템플릿 snapshot, 정형 체크리스트와 결과 자식 문서로 연결합니다.\n\n이번 데모는 기존 Planner MCP 2 자체를 설명합니다. 별도 앱의 코드를 새로 구현했다는 의미가 아닙니다. 아래 Overview 항목에서 What/How와 연결된 검증 방법을 확인합니다.",
    },
  );
  const domainDescriptions = [
    [
      "프로젝트 관리",
      "프로젝트 생성부터 단계별 설계·구현·검증 탐색",
      "create_project가 3개 index와 기본 흐름 노드를 생성한다. 프로젝트별 문서 참조를 제한하고 삭제 시 하위 자료를 정리한다.",
      "M03, M04, M16, M17, M19, M40 / H02",
    ],
    [
      "템플릿 관리",
      "반복 가능한 문서 양식과 작성 지침",
      "list_templates/get_template으로 본문·예시·prompt를 읽고 create_document에서 snapshot을 복제한다. 기존 문서는 원본 변경과 독립적이다.",
      "M05, M06 / H03, H05",
    ],
    [
      "문서 관리",
      "계층 문서와 What/How, 다중 확장",
      "parentId 기반 catalog와 overview 배열, Markdown body, React Flow/CodeWeave extensions를 저장한다. 수정 시 최신 revision을 전달한다.",
      "M07, M08, M09, M18, M21~M36 / H04, H09, H11",
    ],
    [
      "진행·검증 관리",
      "AI 결과와 사람 최종 확인을 독립적으로 관리",
      "AI는 checklist.aiResult만 기록한다. 사람은 UI에서 확인한다. record_verification은 동일 결과 자식을 갱신하고 reopen_document는 영향 항목만 초기화한다.",
      "M10~M15 / H01, H08",
    ],
    [
      "AI 작업 안내",
      "AI가 필요한 설계와 인터페이스를 찾기",
      "get_workflow_rules → 단계 index → 하위 문서 → 구현 기록 → 항목별 AI 결과 순서. 실제 tools/list가 안내 명세의 기준이다.",
      "M01, M02, M37~M39, M41 / H10, H12~H14",
    ],
  ];
  for (const [i, [title, what, how, tests]] of domainDescriptions.entries()) {
    docs.domains.push(
      await s.create(demo, "0" + (i + 2) + " · " + title, "design", "view", {
        body:
          "# " +
          title +
          "\n\n## 비즈니스 설계 · What\n\n" +
          what +
          "\n\n## 시스템 설계 · How\n\n" +
          how +
          "\n\n## 완료 조건과 검증\n\n" +
          tests +
          "\n\n자동 검사 결과는 검증 단계의 그룹 문서에서 확인합니다. 화면 동작과 사람 확인은 아직 검증 대기입니다.",
      }),
    );
  }
  docs.view = await s.create(
    demo,
    "View 설계·검증 · 문서 상세와 체크리스트",
    "design",
    "design-verification-view",
    {
      parentId: docs.domains[2].id,
      body: "# View 설계·검증\n\n## React 설계 메타\n\n| 항목 | 계약 |\n| --- | --- |\n| 대상 | 문서 상세 / 정형 체크리스트 / 확장 viewer |\n| 입력 | document, checklist, extensions, revision |\n| 이벤트 | 저장, 항목 확인/해제, 확장 선택, 상세 닫기 |\n| 상태 | loading, empty, ready, error, stale revision |\n| 접근성 | 레이블, 키보드 이동, 확인 상태 안내 |\n\n## AI 검증\n\nM07/M08/M10/M11/M21/M36으로 반환 데이터 계약을 확인합니다. 이는 실제 React 렌더링 검증을 대신하지 않습니다.\n\n## 사람 검증 · H04/H05/H06/H11\n\nStorybook에서 기본·빈·오류 상태를 확인합니다. 본문 서식/원문 전환, React Flow, CodeWeave 접기와 주석 상세, AI pending에서 사람 체크를 확인한 뒤 정형 체크리스트에 표시합니다.",
    },
  );
  docs.api = await s.create(
    demo,
    "API 설계·검증 · 문서 저장과 충돌",
    "design",
    "design-verification-api",
    {
      parentId: docs.domains[0].id,
      body: "# API 설계·검증\n\n## 설계 계약\n\ncreate_document(projectId, phase, templateName, parentId)로 문서를 생성합니다. update_document(documentId, expectedRevision, body/overview/extensions)는 최신 revision을 요구합니다.\n\n- 성공: 저장된 문서와 새 revision\n- 잘못된 입력: 400 / MCP isError\n- 없는 리소스: 404 / MCP isError\n- 오래된 revision/source: 409 / MCP isError\n- 다른 프로젝트 부모·검증 링크·노드 참조: 거부\n\n## AI 검증\n\nM03/M06/M10/M12/M15/M17/M18/M20/M22/M33/M35를 실제 Streamable HTTP MCP로 실행합니다.\n\n## 사람 검증 · H07\n\nBruno에서 대응 REST의 정상/실패 응답과 상태코드를 직접 확인합니다. 이 실행에서는 REST를 사용하지 않았으므로 Bruno 검증은 대기입니다.",
    },
  );
  docs.e2e = await s.create(
    demo,
    "E2E 설계·검증 · 설계부터 최종 확인까지",
    "design",
    "design-verification-e2e",
    {
      parentId: docs.domains[3].id,
      body: "# E2E 설계·검증\n\n## 사용자 여정 설계\n\n1. 프로젝트를 선택하고 설계 index에서 Overview와 하위 설계를 읽는다.\n2. 구현 단계에서 실제 구현 범위와 연결된 검증 케이스를 확인한다.\n3. 검증 단계의 그룹 문서를 열고 AI 결과 자식 문서를 읽는다.\n4. 사람 확인 대기 항목을 Storybook/Bruno/브라우저에서 확인한 뒤 체크한다.\n5. 변경이 필요하면 AI에 요청하고 영향 항목만 reopen한다.\n\n## AI 1차 검증\n\nM37/M38/M39가 문서 연결과 저장 재조회를 확인합니다. M14는 A만 reopen하는 상태 전이 fixture입니다.\n\n## 사람 검증 · H01/H02/H08/H12/H13\n\n브라우저에서 프로젝트 URL 새로고침, 하위 문서 선택, 3패널 이동, 드래그, 결과 조회를 확인합니다. Playwright/Chrome CDP, 서버 재시작, 사람 확인 true 유지 시험은 이 MCP-only 실행 범위 밖입니다.",
    },
  );
  docs.extensions = await s.create(
    demo,
    "확장 예시 · React Flow + CodeWeave × 2",
    "design",
    "view",
    {
      parentId: docs.domains[2].id,
      body:
        markdown +
        "\n## 확장 확인 방법\n\n첫 확장은 설계→구현→검증 다이어그램입니다. 두 번째는 레이어·사용자 Prefix·변경 표시·주석을 포함한 CodeWeave이고, 세 번째는 별도 검증 흐름입니다.\n\nCodeWeave의 (+)/(-)는 작성자가 표현한 변경 예정 표시입니다. 실제 코드의 완료 상태가 아닙니다.",
      extensions,
    },
  );
  docs.implementation = await s.create(
    demo,
    "01 · 기존 구현 구조와 이번 실행 범위",
    "implementation",
    "implementation",
    {
      body: "# 기존 구현 설명\n\n이번 프로젝트는 이미 실행 중인 Planner MCP 2의 설계와 기존 구현을 설명하고 MCP 기능을 시험합니다. 별도 제품 코드를 신규 개발했다고 주장하지 않습니다.\n\n## 기존 구현 구조\n\n- Next.js Route Handler: HTTP/MCP 입출력 경계\n- MCP SDK + Zod: tools/list 명세와 입력 검증\n- entities/planner: 정형 문서·체크리스트 계약과 규칙\n- app/server: 저장과 revision 검사, SQLite 및 변경 알림\n- widgets/workspace: React Flow와 문서 상세 화면 조합\n- CodeWeave core: 독립 컴파일·조회·수정; adapter가 문서 저장을 담당\n\n## 이번에 수행한 구현 작업\n\nscripts/mcp-demo의 SDK harness를 작성했습니다. 실제 MCP tools/call로만 데모 문서를 생성하고, 정상·오류 케이스를 검증하고, 동일 인터페이스로 결과를 기록합니다. 원본 요구사항과 기존 사용자 프로젝트는 수정하지 않습니다.\n\n## 확인 범위\n\nMCP 응답·저장·데이터 계약은 이번 실행으로 검증합니다. 기술 버전/SLAP/FSD 검토는 H14, UI 렌더링은 H04/H06/H11/H13에 남깁니다.",
    },
  );
  await s.create(
    demo,
    "저장 경로 · revision과 부분 수정",
    "implementation",
    "implementation",
    {
      parentId: docs.implementation.id,
      body: "# 구현 흐름\n\nMCP 입력 → 스키마 검증 → 문서 조회 → expectedRevision/expectedSource 검사 → 규칙 적용 → 저장 → 새 문서 응답.\n\n체크리스트와 Markdown 본문은 서로 다른 필드입니다. extensions를 생략하면 보존하고 []를 보내면 모두 제거합니다. CodeWeave는 source에서 매번 컴파일하므로 수정 후 line ID를 다시 조회합니다.\n\n검증 연결: M10, M15, M21, M30~M35. 사람이 확인한 상태의 선택적 보존은 H08에서 확인합니다.",
    },
  );
  await s.create(
    demo,
    "테스트 실행기 · 호출 기록과 데이터 격리",
    "implementation",
    "implementation",
    {
      parentId: docs.implementation.id,
      body:
        "# 실행기 구현\n\nClient + StreamableHTTPClientTransport로 /mcp에 연결합니다. 모든 응답은 순번과 입력·출력을 JSONL로 기록합니다. mutation guard는 이번 실행에서 생성한 프로젝트·문서만 수정/삭제하도록 제한합니다.\n\n기존 프로젝트는 목록 기준으로 보존 여부를 검사합니다. 삭제/오류 시험용 임시 프로젝트만 정리하고 이 데모는 유지합니다.\n\n증거 디렉터리: " +
        s.evidence +
        "\n\n재실행은 새 데모 프로젝트를 생성합니다. 사람 체크를 자동으로 조작하지 않습니다.",
    },
  );
  docs.catalog = await s.create(
    demo,
    "00 · 전체 요구사항과 55개 테스트 케이스",
    "verification",
    "view",
    { body: catalog },
  );
  for (const group of groups) {
    docs.groups[group.id] = await s.create(
      demo,
      group.title + " · 검증 체크리스트",
      "verification",
      "view",
      {
        body:
          "# " +
          group.title +
          "\n\n각 정형 체크리스트 항목은 아래 테스트에 대응합니다. AI 결과와 사람 확인은 별개입니다. HUMAN 케이스는 미실행이므로 AI skipped로 기록합니다. 결과 자식 문서에서 호출 번호와 판정을 확인하세요.\n\n" +
          table(cases.filter((c) => group.cases.includes(c.id))),
      },
    );
  }
  await s.patch(docs.overview, {
    overview: domainDescriptions.map(([title, what, how], i) => ({
      id: rules.domains[i],
      parentId: i === 0 ? null : rules.domains[0],
      title,
      what,
      how,
      verificationDocumentId:
        docs.groups[
          ["project", "template", "template", "progress", "progress"][i]
        ].id,
    })),
  });
  s.manifest.documentsByRole = Object.fromEntries(
    Object.entries(docs).map(([key, value]) => [
      key,
      key === "groups"
        ? Object.fromEntries(Object.entries(value).map(([k, d]) => [k, d.id]))
        : key === "domains"
          ? value.map((d) => d.id)
          : value.id,
    ]),
  );
  await s.save();
  scratch = await s.call("create_project", {
    title: "MCP 실행 임시 · " + s.runId,
  });
  s.manifest.scratchId = scratch.id;
  await s.save();
  await runCases(
    s,
    demo,
    scratch,
    docs,
    masterExample,
    templates,
    tools,
    originalProjects,
  );
  for (const c of cases.filter((c) => c.mode === "HUMAN"))
    s.results.push({
      id: c.id,
      status: "MANUAL",
      detail: "MCP-only 범위 밖 · 사람 확인 대기",
    });
  await s.save();
  for (const group of groups) {
    const doc = docs.groups[group.id];
    for (const item of (await s.get(doc)).checklist) {
      const current = await s.get(doc);
      await s.call("delete_checklist_item", {
        documentId: doc.id,
        itemId: item.id,
        expectedRevision: current.revision,
      });
    }
    for (const id of group.cases) {
      const c = cases.find((c) => c.id === id),
        result = s.results.find((r) => r.id === id);
      await s.add(doc, "[" + id + "] " + c.title);
      const item = (await s.get(doc)).checklist.find((c) =>
        c.label.startsWith("[" + id + "]"),
      );
      await s.check(doc, item.id, {
        aiResult: { PASS: "passed", FAIL: "failed", MANUAL: "skipped" }[
          result.status
        ],
      });
    }
    const current = await s.get(doc);
    const body =
      "# " +
      group.title +
      " · AI 1차 검증 결과\n\n실행: " +
      s.runId +
      "\n\n실제 MCP 응답 기반 결과입니다. 사람 확인은 전부 미확인입니다.\n\n| ID | 결과 | 호출 번호 | 상세 |\n| --- | --- | --- | --- |\n" +
      group.cases
        .map((id) => {
          const r = s.results.find((r) => r.id === id);
          return (
            "| " +
            [
              id,
              r.status,
              r.calls?.join("–") || "—",
              (r.detail || "기대 응답 및 저장 상태 assertion 통과")
                .replaceAll("\n", " ")
                .replaceAll("|", "/"),
            ].join(" | ") +
            " |"
          );
        })
        .join("\n") +
      "\n\n호출 원문: " +
      s.evidence +
      "/calls.jsonl\n\n재검증 시 record_verification으로 이 결과 자식 문서를 갱신합니다.";
    const resultDoc = await s.call("record_verification", {
      documentId: doc.id,
      expectedRevision: current.revision,
      body,
    });
    assert.equal((await s.get(resultDoc)).body, body);
    assert((await s.get(doc)).checklist.every((c) => !c.humanConfirmed));
  }
  const counts = Object.fromEntries(
    ["PASS", "FAIL", "MANUAL"].map((status) => [
      status,
      s.results.filter((r) => r.status === status).length,
    ]),
  );
  const summary =
    "# MCP-only 데모 실행 결과\n\n실행: " +
    s.runId +
    "\n\n**PASS " +
    counts.PASS +
    " / FAIL " +
    counts.FAIL +
    " / 사람 확인 대기 " +
    counts.MANUAL +
    "**\n\n- 등록된 MCP 도구 24개 실제 호출\n- 요구사항 27개 추적 그룹, 케이스 55개\n- 데이터 작성·수정·삭제·조회는 MCP만 사용\n- 원본 요구사항과 기존 사용자 프로젝트 보존\n- 임시 테스트 프로젝트 삭제, 이 데모 프로젝트 유지\n- 사람 확인은 모두 미확인. 전체 요구사항의 최종 충족 판정은 보류\n\n## 보는 순서\n\n1. 설계 → 비즈니스 Overview → 5개 도메인 및 View/API/E2E 설계\n2. 문서 관리 하위의 확장 예시 → React Flow와 CodeWeave\n3. 구현 → 기존 구현 구조 → 저장 경로와 테스트 실행기\n4. 검증 → 전체 케이스 → 4개 그룹별 체크리스트 → AI 결과 자식\n5. 사람은 H01~H14의 실제 화면/Storybook/Bruno 검증 후 확인 체크\n\n## 실행 증거\n\n" +
    s.evidence +
    "/calls.jsonl\n\n프로젝트: " +
    s.manifest.url +
    "\n\nMCP로 시각적 렌더링, 사람 체크, 템플릿 원본 관리, 서버 재시작을 시험할 수는 없습니다. 대응 HUMAN 케이스에 절차와 기대 결과를 기록했습니다.";
  const verificationIndex = demo.indexes.find(
    (d) => d.phase === "verification",
  );
  await s.patch(verificationIndex, { body: summary });
  const summaryDoc = await s.create(
    demo,
    "00 · 실행 결과 · PASS " +
      counts.PASS +
      " / 사람 확인 대기 " +
      counts.MANUAL,
    "verification",
    "view",
    { body: summary },
  );
  await s.patch(
    demo.indexes.find((d) => d.phase === "design"),
    {
      body:
        summary +
        "\n\n## 설계의 기준\n\n원본 요구사항을 27개 추적 그룹에 연결했습니다. 검증 단계의 전체 케이스 문서에서 요구사항별 연결을 확인하세요.",
    },
  );
  const allDocs = await s.call("list_documents", { projectId: demo.id });
  assert(allDocs.every((d) => d.checklist.every((c) => !c.humanConfirmed)));
  s.manifest.summaryDocumentId = summaryDoc.id;
  s.manifest.counts = counts;
  s.manifest.callCount = s.sequence;
  s.manifest.documentCount = allDocs.length;
  s.manifest.status = "complete";
  await s.save();
  await writeFile(
    "docs/validation/mcp-demo/latest-run.json",
    JSON.stringify({ ...s.manifest, results: s.results }, null, 2),
  );
  await writeFile(
    "docs/validation/mcp-demo/results.md",
    summary +
      "\n\n최종 호출 수: " +
      s.sequence +
      " · 보존 문서 수: " +
      allDocs.length +
      "\n",
  );
  console.log(
    "FINAL",
    JSON.stringify({
      url: s.manifest.url,
      counts,
      calls: s.sequence,
      documents: allDocs.length,
      evidence: s.evidence,
    }),
  );
  if (counts.FAIL) process.exitCode = 1;
} catch (error) {
  s.manifest.status = "interrupted";
  s.manifest.error = error.message;
  await s.save();
  console.error(error);
  process.exitCode = 1;
} finally {
  if (scratch && !s.manifest.scratchDeleted) {
    try {
      await s.call("delete_project", { projectId: scratch.id });
      s.manifest.scratchDeleted = true;
      await s.save();
    } catch (error) {
      console.error("Owned scratch cleanup failed:", scratch.id, error.message);
      process.exitCode = 1;
    }
  }
  await s.client.close();
}
