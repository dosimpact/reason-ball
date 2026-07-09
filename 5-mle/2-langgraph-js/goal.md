# LangGraph JS Migration Planning Document

> **Summary**: 기존 Python 예제를 원본 참고자료로 삼아 LangGraph JS/TypeScript + NestJS BFF 구조로 재구현한다.
>
> **Project**: 2-langgraph-js
> **Version**: 0.1
> **Author**: Codex
> **Date**: 2026-07-07
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

`/Users/studio/workspace/projects/reason-ball/5-mle/2-langgraph/1-langgraph-basic` 아래의 Python 예제는 동작과 예제 번호를 맞추기 위한 **원본 참고자료**로만 사용한다. 실제 대상 구현은 `@langchain/langgraph` 기반의 **LangGraph JS/TypeScript** 프로젝트이며, 1차 범위는 `graph-basic/` 예제 재구현이다. NestJS BFF를 통해 그래프 실행 API를 제공하고 LangSmith로 테스트 및 트레이싱한다.

### 1.1.1 Target Runtime

- Runtime: Node.js + TypeScript
- Graph framework: `@langchain/langgraph`
- LangChain packages: `@langchain/core`, `@langchain/openai`
- BFF framework: NestJS
- Schema validation: zod
- Test/trace: LangSmith
- Python usage: source reference only, target runtime dependency로 사용하지 않음

### 1.2 Migration Principles

- Python 원본은 수정하지 않고 동작 참조로만 사용한다.
- 대상 구현은 LangGraph JS/TypeScript로 작성하며 Python LangGraph 런타임을 사용하지 않는다.
- JS 프로젝트는 `/Users/studio/workspace/projects/reason-ball` 루트 pnpm workspace 안의 단일 BFF workspace package로 관리한다.
- 먼저 basic 예제를 안정적으로 이식한 뒤 lectures/advanced로 확장한다.
- 디렉터리 이름과 예제 번호는 기존 Python 프로젝트와 최대한 대응되게 유지한다.
- 각 작업 단계는 progress 문서에 추적 가능하게 남겨서 이후 서브에이전트가 이어받을 수 있게 한다.
- `.env`는 원본 프로젝트의 값을 그대로 가져와 JS 루트에서 사용한다.

### 1.3 Source References

- Source reference: `/Users/studio/workspace/projects/reason-ball/5-mle/2-langgraph/1-langgraph-basic`
- Target implementation: `/Users/studio/workspace/projects/reason-ball/5-mle/2-langgraph-js`
- Source examples to port: `graph-basic/*.py`
- Source helper modules to mirror in TS: `common/`, `node/`
- Source graph registry to mirror in JS: `langgraph.json`

---

## 2. Scope

### 2.1 In Scope - Phase 1

- [ ] 루트 pnpm workspace + Turborepo 기반 프로젝트 초기화
- [ ] NestJS BFF 앱 생성
- [ ] BFF 내부 LangGraph JS graph local module 생성
- [ ] 원본 `common/` 역할을 TypeScript shared 모듈로 이식
- [ ] 원본 `node/` 역할을 TypeScript node helper 모듈로 이식
- [ ] `graph-basic/01_simple_graph.py`부터 `25_approval_system.py`까지 순차 이식
- [ ] LangGraph Studio 또는 LangGraph CLI용 `langgraph.json` 구성
- [ ] `apps/bff/package.json`에 Studio/dev/build/start 스크립트 구성
- [ ] NestJS BFF에서 그래프 invoke/stream/checkpoint 관련 API 제공
- [ ] LangSmith tracing을 켠 상태로 테스트 실행
- [ ] progress 파일로 작업 상태, 담당자, 검증 결과 추적

### 2.2 Out of Scope - Phase 1

- `graph-advanced/` 전체 이식
- `graph-lectures/` 전체 이식
- Python LangGraph 런타임 또는 Python package 기반 대상 구현
- production 배포 인프라
- UI 프론트엔드
- Python 원본 리팩터링
- `.env` 값 변경 또는 신규 secret 발급

### 2.3 Later Scope

- Phase 2: `graph-lectures/` 이식
- Phase 3: `graph-advanced/` 이식
- Phase 4: BFF 운영 기능 확장, auth, persistence, observability 강화

---

## 3. Target Architecture

### 3.1 Top-Level Directory Plan

```text
2-langgraph-js/
├── apps/
│   └── bff/                         # 유일한 package.json을 가진 NestJS BFF package
│       ├── package.json
│       ├── src/
│       │   ├── graphs/              # BFF API module
│       │   └── langgraph-examples/  # LangGraph JS graph collection
│       │       ├── common/          # 원본 common/ 대응
│       │       ├── node/            # 원본 node/ 대응
│       │       ├── graph-basic/     # 원본 graph-basic/ 대응
│       │       ├── graph-lectures/  # lectures scope
│       │       └── graph-advanced/  # advanced scope
│       └── tests/
├── assets/                           # sample data, fixtures, static files
├── docs/
│   ├── migration/                    # 이식 설계 및 매핑 문서
│   └── progress/                     # 작업 추적 문서
├── langgraph.json                    # LangGraph JS graph registry
├── tsconfig.base.json
├── .env                              # 원본 프로젝트에서 그대로 복사, git ignore
└── .env.example                      # secret 없는 키 목록만 유지
```

### 3.2 Source-to-LangGraph-JS Mapping

| Source Path | LangGraph JS Target | Notes |
|-------------|---------------------|-------|
| `common/llm.py` | `apps/bff/src/langgraph-examples/common/llm.ts` | ChatOpenAI factory |
| `common/tools.py` | `apps/bff/src/langgraph-examples/common/tools.ts` | LangChain JS `tool()` + zod schema |
| `node/llm_node.py` | `apps/bff/src/langgraph-examples/node/llm-node.ts` | Messages state 기반 model node factory |
| `node/routing.py` | `apps/bff/src/langgraph-examples/node/routing.ts` | conditional edge router |
| `node/tool_node.py` | `apps/bff/src/langgraph-examples/node/tool-node.ts` | prebuilt ToolNode wrapper |
| `graph-basic/*.py` | `apps/bff/src/langgraph-examples/graph-basic/*.ts` | 번호 유지, snake_case는 kebab-case 권장 |
| `langgraph.json` | `langgraph.json` | JS graph entry 등록 |

### 3.3 NestJS BFF Responsibilities

- Graph 목록 조회
- Graph invoke API 제공
- Streaming API 제공
- thread/checkpoint 기반 resume API 제공
- LangSmith run metadata/tag 주입
- 테스트용 request/response DTO 관리
- `src/langgraph-examples` local module을 직접 import하여 BFF에서 실행

### 3.4 BFF `package.json` Script Plan

`apps/bff/package.json` 하나만 이 프로젝트의 package manifest로 유지한다. 실제 pnpm workspace root는 `/Users/studio/workspace/projects/reason-ball`이며, `2-langgraph-js` 안에는 별도 `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`을 두지 않는다. LangGraph Studio 실행은 공식 JS CLI인 `@langchain/langgraph-cli`를 사용하고, 그래프 코드는 BFF package 내부의 `src/langgraph-examples/` local module로 관리한다.

```json
{
  "name": "@reason-ball/langgraph-js-bff",
  "private": true,
  "type": "module",
  "scripts": {
    "studio": "langgraphjs dev --config ../../langgraph.json",
    "studio:tunnel": "langgraphjs dev --config ../../langgraph.json --tunnel",
    "dev": "tsx watch src/main.ts",
    "start": "tsx src/main.ts",
    "start:dev": "tsx watch src/main.ts",
    "start:prod": "node dist/main.js",
    "build": "tsc -p tsconfig.json",
    "lint": "tsc -p tsconfig.json --noEmit",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@langchain/core": "latest",
    "@langchain/langgraph": "latest",
    "@langchain/openai": "latest",
    "@nestjs/common": "latest",
    "@nestjs/core": "latest",
    "@nestjs/platform-express": "latest",
    "dotenv": "latest",
    "express": "latest",
    "reflect-metadata": "latest",
    "rxjs": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@langchain/langgraph-cli": "latest",
    "@types/express": "latest",
    "@types/node": "latest",
    "supertest": "latest",
    "tsx": "latest",
    "typescript": "^5.9.3",
    "vitest": "latest"
  }
}
```

Script categories:

| Category | Script | Purpose |
|----------|--------|---------|
| LangGraph Studio | `pnpm --filter @reason-ball/langgraph-js-bff studio` | `langgraph.json` 기준 local Agent Server와 Studio 연결 |
| LangGraph Studio tunnel | `pnpm --filter @reason-ball/langgraph-js-bff studio:tunnel` | localhost 연결이 어려운 환경용 secure tunnel 실행 |
| Development | `pnpm --filter @reason-ball/langgraph-js-bff dev` | NestJS BFF watch mode 실행 |
| Build | `pnpm --filter @reason-ball/langgraph-js-bff build` | BFF package production build |
| Run | `pnpm --filter @reason-ball/langgraph-js-bff start` | BFF 일반 실행 |
| Run - production | `pnpm --filter @reason-ball/langgraph-js-bff start:prod` | BFF production artifact 실행 |

Runtime dependency rule:

- LangGraph 구현 패키지는 `@langchain/langgraph`를 사용한다.
- Python 패키지인 `langgraph`, `langchain-core`, `langchain-openai`는 JS 대상 프로젝트 의존성에 추가하지 않는다.
- Python 원본의 `langgraph.json`은 그래프 ID와 예제 구성을 참고하되, 대상 `langgraph.json`은 `.ts` export를 가리킨다.

---

## 4. Requirements

### 4.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | Source basic 예제를 LangGraph JS/TypeScript로 순차 재구현한다. | High | Pending |
| FR-02 | NestJS BFF에서 graph invoke endpoint를 제공한다. | High | Pending |
| FR-03 | stream이 필요한 예제는 BFF streaming endpoint로 검증한다. | High | Pending |
| FR-04 | interrupt/checkpointer 예제는 thread_id 기반 resume 흐름을 지원한다. | High | Pending |
| FR-05 | LangSmith tracing을 테스트 실행 시 활성화한다. | High | Pending |
| FR-06 | `.env`는 원본 프로젝트에서 그대로 복사해 사용한다. | High | Pending |
| FR-07 | progress 문서에 각 예제의 이식/검증 상태를 기록한다. | High | Pending |
| FR-08 | `apps/bff/package.json`에 Studio/dev/build/start 스크립트를 제공한다. | High | Pending |
| FR-09 | 대상 프로젝트는 `@langchain/langgraph`를 사용하고 Python LangGraph 런타임을 사용하지 않는다. | High | Pending |

### 4.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Maintainability | 원본 파일과 LangGraph JS 대상 파일의 대응 관계가 명확해야 한다. | migration map review |
| Testability | 각 그래프는 CLI 또는 BFF endpoint로 실행 가능해야 한다. | pnpm test, LangSmith traces |
| Observability | LLM 호출과 graph run이 LangSmith에서 추적되어야 한다. | LangSmith project 확인 |
| Security | `.env` secret은 커밋하지 않는다. | `.gitignore`, git status 확인 |
| Compatibility | LangGraph JS 공식 API를 우선 사용한다. | typecheck, runtime smoke test |

---

## 5. Task Registry and Execution Plan

Phase 1 작업 수는 54개로 관리한다. 남은 `graph-lectures/`, `graph-advanced/` 범위는 `LECTURE-*`, `ADV-*` Task ID로 별도 추적한다. Task ID는 progress 문서, 서브에이전트 지시, 테스트 결과, LangSmith trace 기록의 공통 키로 사용한다.

| Prefix | Phase | Count | Progress File |
|--------|-------|------:|---------------|
| `BOOT` | Project Bootstrap | 8 | `docs/progress/00-bootstrap.progress.md` |
| `CORE` | Shared Foundation | 6 | `docs/progress/01-shared-foundation.progress.md` |
| `GRAPH` | Basic Graph Migration | 29 | `docs/progress/02-basic-graphs.progress.md` |
| `BFF` | NestJS BFF Integration | 6 | `docs/progress/03-bff-integration.progress.md` |
| `VALIDATE` | LangSmith Test and Validation | 5 | `docs/progress/04-langsmith-validation.progress.md` |
| `LECTURE` | Lecture Graph Migration | 6 | `docs/progress/05-remaining-scope.progress.md` |
| `ADV` | Advanced Graph Migration | 11 | `docs/progress/05-remaining-scope.progress.md` |

### 5.1 BOOT Tasks - Project Bootstrap

| Task ID | Task | Output | Status |
|---------|------|--------|--------|
| BOOT-01 | BFF 단일 `package.json` 생성 및 Studio/dev/build/start script 구성 | `apps/bff/package.json` | Pending |
| BOOT-02 | 루트 pnpm workspace 포함 확인 | `/Users/studio/workspace/projects/reason-ball/pnpm-workspace.yaml` | Pending |
| BOOT-03 | 루트 Turborepo에서 BFF package task 실행 확인 | `/Users/studio/workspace/projects/reason-ball/turbo.json` | Pending |
| BOOT-04 | TypeScript 공통 설정 | `tsconfig.base.json` | Pending |
| BOOT-05 | NestJS BFF 앱 스캐폴딩 | `apps/bff` | Pending |
| BOOT-06 | LangGraph JS local module 스캐폴딩 | `apps/bff/src/langgraph-examples` | Pending |
| BOOT-07 | LangGraph JS 의존성 추가 | `@langchain/langgraph`, `@langchain/core`, `@langchain/openai` | Pending |
| BOOT-08 | `.env` 복사 및 ignore 확인 | `.env`, `.env.example`, `.gitignore` | Pending |

### 5.2 CORE Tasks - Shared Foundation

| Task ID | Task | Output | Status |
|---------|------|--------|--------|
| CORE-01 | OpenAI LLM factory 이식 | `apps/bff/src/langgraph-examples/common/llm.ts` | Pending |
| CORE-02 | 공용 tools 이식 | `apps/bff/src/langgraph-examples/common/tools.ts` | Pending |
| CORE-03 | model node factory 이식 | `apps/bff/src/langgraph-examples/node/llm-node.ts` | Pending |
| CORE-04 | conditional routing helper 이식 | `apps/bff/src/langgraph-examples/node/routing.ts` | Pending |
| CORE-05 | ToolNode wrapper 이식 | `apps/bff/src/langgraph-examples/node/tool-node.ts` | Pending |
| CORE-06 | graph export registry 작성 | `apps/bff/src/langgraph-examples/index.ts`, `langgraph.json` | Pending |

### 5.3 GRAPH Tasks - Basic Graph Migration

각 `GRAPH-*` 작업은 원본 파일 1개, 대상 TS 파일 1개, smoke test 1개를 기본 단위로 한다. 그래프별 작업자는 공유 registry 파일을 직접 수정하지 않고, 필요한 export 이름을 progress에 기록한다. `CORE-06` 또는 통합 담당자가 registry 반영을 수행한다.

| Task ID | Source | Target | Pattern Group | Status |
|---------|--------|--------|---------------|--------|
| GRAPH-01 | `graph-basic/01_simple_graph.py` | `apps/bff/src/langgraph-examples/graph-basic/01-simple-graph.ts` | primitive | Pending |
| GRAPH-02 | `graph-basic/02_llm_graph.py` | `apps/bff/src/langgraph-examples/graph-basic/02-llm-graph.ts` | llm | Pending |
| GRAPH-03 | `graph-basic/03_tool_node.py` | `apps/bff/src/langgraph-examples/graph-basic/03-tool-node.ts` | tool | Pending |
| GRAPH-04 | `graph-basic/04_subgraph.py` | `apps/bff/src/langgraph-examples/graph-basic/04-subgraph.ts` | primitive | Pending |
| GRAPH-05 | `graph-basic/05_interrupt.py` | `apps/bff/src/langgraph-examples/graph-basic/05-interrupt.ts` | interrupt | Pending |
| GRAPH-06 | `graph-basic/06_checkpointer.py` | `apps/bff/src/langgraph-examples/graph-basic/06-checkpointer.ts` | checkpoint | Pending |
| GRAPH-07 | `graph-basic/07_streaming.py` | `apps/bff/src/langgraph-examples/graph-basic/07-streaming.ts` | streaming | Pending |
| GRAPH-08 | `graph-basic/08_map_reduce.py` | `apps/bff/src/langgraph-examples/graph-basic/08-map-reduce.ts` | primitive | Pending |
| GRAPH-09 | `graph-basic/09_structured_output.py` | `apps/bff/src/langgraph-examples/graph-basic/09-structured-output.ts` | structured-output | Pending |
| GRAPH-10 | `graph-basic/10_rag.py` | `apps/bff/src/langgraph-examples/graph-basic/10-rag.ts` | rag | Pending |
| GRAPH-11 | `graph-basic/11_1_supervisor.py` | `apps/bff/src/langgraph-examples/graph-basic/11-1-supervisor.ts` | supervisor | Pending |
| GRAPH-12 | `graph-basic/11_2_supervisor.py` | `apps/bff/src/langgraph-examples/graph-basic/11-2-supervisor.ts` | supervisor | Pending |
| GRAPH-13 | `graph-basic/11_3_supervisor_diff_state.py` | `apps/bff/src/langgraph-examples/graph-basic/11-3-supervisor-diff-state.ts` | supervisor | Pending |
| GRAPH-14 | `graph-basic/11_4_supervisor_chat_subgraph.py` | `apps/bff/src/langgraph-examples/graph-basic/11-4-supervisor-chat-subgraph.ts` | supervisor | Pending |
| GRAPH-15 | `graph-basic/12_1_reflection.py` | `apps/bff/src/langgraph-examples/graph-basic/12-1-reflection.ts` | reflection | Pending |
| GRAPH-16 | `graph-basic/12_2_reflection.py` | `apps/bff/src/langgraph-examples/graph-basic/12-2-reflection.ts` | reflection | Pending |
| GRAPH-17 | `graph-basic/13_plan_and_execute.py` | `apps/bff/src/langgraph-examples/graph-basic/13-plan-and-execute.ts` | planning | Pending |
| GRAPH-18 | `graph-basic/14_parallel_branches.py` | `apps/bff/src/langgraph-examples/graph-basic/14-parallel-branches.ts` | primitive | Pending |
| GRAPH-19 | `graph-basic/15_long_term_memory.py` | `apps/bff/src/langgraph-examples/graph-basic/15-long-term-memory.ts` | memory | Pending |
| GRAPH-20 | `graph-basic/16_command_interrupt.py` | `apps/bff/src/langgraph-examples/graph-basic/16-command-interrupt.ts` | interrupt | Pending |
| GRAPH-21 | `graph-basic/17_configurable.py` | `apps/bff/src/langgraph-examples/graph-basic/17-configurable.ts` | configurable | Pending |
| GRAPH-22 | `graph-basic/18_custom_streaming.py` | `apps/bff/src/langgraph-examples/graph-basic/18-custom-streaming.ts` | streaming | Pending |
| GRAPH-23 | `graph-basic/19_retry_policy.py` | `apps/bff/src/langgraph-examples/graph-basic/19-retry-policy.ts` | retry | Pending |
| GRAPH-24 | `graph-basic/20_history_reducer.py` | `apps/bff/src/langgraph-examples/graph-basic/20-history-reducer.ts` | reducer | Pending |
| GRAPH-25 | `graph-basic/21_long_context.py` | `apps/bff/src/langgraph-examples/graph-basic/21-long-context.ts` | long-context | Pending |
| GRAPH-26 | `graph-basic/22_evaluator_loop.py` | `apps/bff/src/langgraph-examples/graph-basic/22-evaluator-loop.ts` | evaluator | Pending |
| GRAPH-27 | `graph-basic/23_verification_flow.py` | `apps/bff/src/langgraph-examples/graph-basic/23-verification-flow.ts` | verification | Pending |
| GRAPH-28 | `graph-basic/24_qa_pipeline.py` | `apps/bff/src/langgraph-examples/graph-basic/24-qa-pipeline.ts` | qa | Pending |
| GRAPH-29 | `graph-basic/25_approval_system.py` | `apps/bff/src/langgraph-examples/graph-basic/25-approval-system.ts` | approval | Pending |

### 5.4 BFF Tasks - NestJS BFF Integration

| Task ID | Task | Output | Status |
|---------|------|--------|--------|
| BFF-01 | Graphs module 및 package import wiring | `apps/bff/src/graphs/graphs.module.ts` | Pending |
| BFF-02 | LangGraph 호출 adapter 작성 | `apps/bff/src/graphs/adapters/langgraph-runner.adapter.ts` | Pending |
| BFF-03 | Graphs service 작성 | `apps/bff/src/graphs/graphs.service.ts` | Pending |
| BFF-04 | invoke endpoint 및 DTO 작성 | `POST /graphs/:id/invoke`, `invoke-graph.dto.ts` | Pending |
| BFF-05 | stream endpoint 및 DTO 작성 | `POST /graphs/:id/stream`, `stream-graph.dto.ts` | Pending |
| BFF-06 | resume endpoint 및 DTO 작성 | `POST /graphs/:id/resume`, `resume-graph.dto.ts` | Pending |

### 5.5 VALIDATE Tasks - LangSmith Test and Validation

| Task ID | Task | Output | Status |
|---------|------|--------|--------|
| VALIDATE-01 | LangSmith env 확인 | `LANGSMITH_*` env checklist | Pending |
| VALIDATE-02 | graph smoke tests 작성 및 실행 | graph별 compile/invoke test | Pending |
| VALIDATE-03 | BFF e2e tests 작성 및 실행 | invoke/stream/resume e2e test | Pending |
| VALIDATE-04 | LangSmith trace 확인 | trace URL 또는 run id 기록 | Pending |
| VALIDATE-05 | migration parity check | source expected output vs LangGraph JS behavior | Pending |

### 5.6 Serial Execution Gates

아래 gate는 직렬로 통과해야 한다. 다음 gate는 이전 gate의 필수 작업이 `Done` 또는 `Review` 상태일 때만 시작한다.

| Gate | Required Tasks | Reason |
|------|----------------|--------|
| G0 - Bootstrap | BOOT-01 -> BOOT-02 -> BOOT-03/BOOT-04 -> BOOT-05/BOOT-06 -> BOOT-07 -> BOOT-08 | root workspace 포함, package, env 기반을 먼저 고정 |
| G1 - Core Foundation | CORE-01, CORE-02, CORE-03, CORE-04, CORE-05 -> CORE-06 | graph 구현이 공유 helper와 registry에 의존 |
| G2 - Seed Graphs | GRAPH-01 -> GRAPH-02 -> GRAPH-03 -> GRAPH-05 -> GRAPH-07 | primitive, LLM, tool, interrupt, streaming 패턴 기준 확정 |
| G3 - Parallel Graph Batches | GRAPH batch tasks | 패턴 기준 확정 후 독립 graph 파일 단위 병렬화 |
| G4 - BFF Wiring | BFF-01 -> BFF-02/BFF-03 -> BFF-04/BFF-05/BFF-06 | BFF는 local graph registry export와 runner adapter에 의존 |
| G5 - Validation | VALIDATE-01 -> VALIDATE-02/VALIDATE-03 -> VALIDATE-04 -> VALIDATE-05 | env, tests, traces, parity 순으로 검증 |

### 5.7 Parallel Execution Batches

서브에이전트 병렬 실행은 같은 파일을 수정하지 않는 작업끼리만 허용한다.

| Batch | Can Run In Parallel | Prerequisites |
|-------|---------------------|---------------|
| P0 - Bootstrap Split | BOOT-03, BOOT-04 | BOOT-01, BOOT-02 |
| P1 - App/Package Scaffold | BOOT-05, BOOT-06 | BOOT-01, BOOT-02, BOOT-04 |
| P2 - Core Helpers | CORE-01, CORE-02, CORE-03, CORE-04, CORE-05 | BOOT-06, BOOT-07 |
| P3 - Primitive Graphs | GRAPH-04, GRAPH-08, GRAPH-18, GRAPH-23 | GRAPH-01 |
| P4 - LLM/Data Graphs | GRAPH-09, GRAPH-10, GRAPH-21, GRAPH-24, GRAPH-25 | GRAPH-02, CORE-01 |
| P5 - HITL/Memory Graphs | GRAPH-06, GRAPH-19, GRAPH-20, GRAPH-29 | GRAPH-05 |
| P6 - Streaming Graphs | GRAPH-22 | GRAPH-07 |
| P7 - Agent Graphs | GRAPH-11, GRAPH-12, GRAPH-13, GRAPH-14, GRAPH-15, GRAPH-16, GRAPH-17, GRAPH-26, GRAPH-27, GRAPH-28 | GRAPH-03, GRAPH-09 |
| P8 - BFF Endpoints | BFF-04, BFF-05, BFF-06 | BFF-01, BFF-02, BFF-03 |
| P9 - Validation Split | VALIDATE-02, VALIDATE-03 | VALIDATE-01, relevant graph/BFF tasks |

### 5.8 Parallel Safety Rules

- 한 서브에이전트는 한 번에 하나의 Task ID만 담당한다.
- 병렬 graph 작업자는 자기 graph 파일, 자기 test 파일, 자기 progress block만 수정한다.
- `apps/bff/package.json`, `tsconfig.base.json`, `langgraph.json`, `apps/bff/src/langgraph-examples/index.ts`는 공유 파일이므로 지정된 BOOT/CORE 담당자만 수정한다.
- graph 작업자가 export 또는 registry 변경이 필요하면 직접 공유 파일을 수정하지 않고 progress의 `Next`에 요청을 남긴다.
- BFF 작업자는 `apps/bff/src/graphs/` 하위의 자기 책임 파일만 수정한다.
- 병렬 작업 완료 후 통합 담당자가 `pnpm --filter @reason-ball/langgraph-js-bff typecheck`, `pnpm --filter @reason-ball/langgraph-js-bff test`, `pnpm --filter @reason-ball/langgraph-js-bff build`를 순서대로 실행한다.

### 5.9 Remaining Scope Dependency Marking

남은 작업에서 말하는 "외부 의존성"은 현재 Phase 1 기본 `.env`로 이미 쓰는 OpenAI/LangSmith를 제외한 추가 API, DB, vector store, Docker runtime, 별도 HTTP server, webhook, auth/JWT, sandbox를 뜻한다. `External` 또는 `External-Optional` 항목은 다음 구현 범위에서 제외한다.

| Class | Meaning | Next Action |
|-------|---------|-------------|
| Ready | 추가 외부 인프라 없이 TS 이식 가능 | 다음 작업 포함 |
| LLM-only | 기존 OpenAI/LangSmith `.env`만 사용 | 다음 작업 포함 |
| External-Optional | 외부 도구 fallback은 있지만 원본 의미가 외부 도구에 의존 | 기본 제외, stub 허용 시 재분류 |
| External | 추가 외부 API/DB/Docker/vector store/server 필요 | 다음 작업 제외 |

### 5.10 LECTURE Tasks - Remaining Graph Lectures

| Task ID | Source | Target | Dependency Class | External Mark | Next Status |
|---------|--------|--------|------------------|---------------|-------------|
| LECTURE-01 | `graph-lectures/01_reflection_graph.py` | `apps/bff/src/langgraph-examples/graph-lectures/01-reflection-graph.ts` | LLM-only | None | Done |
| LECTURE-02 | `graph-lectures/02_react_agent.py` | `apps/bff/src/langgraph-examples/graph-lectures/02-react-agent.ts` | External-Optional | Tavily web search | Excluded |
| LECTURE-03 | `graph-lectures/03_react_function_calling.py` | `apps/bff/src/langgraph-examples/graph-lectures/03-react-function-calling.ts` | External-Optional | Tavily web search | Excluded |
| LECTURE-04 | `graph-lectures/04_search_agent.py` | `apps/bff/src/langgraph-examples/graph-lectures/04-search-agent.ts` | External | Tavily search API | Excluded |
| LECTURE-05 | `graph-lectures/05_reflexion_agent.py` | `apps/bff/src/langgraph-examples/graph-lectures/05-reflexion-agent.ts` | External | Tavily batch search | Excluded |
| LECTURE-06 | `graph-lectures/06_agentic_rag.py` | `apps/bff/src/langgraph-examples/graph-lectures/06-agentic-rag.ts` | External | Agentic RAG, retriever, optional Tavily web search | Excluded |

### 5.11 ADV Tasks - Remaining Advanced Graphs

| Task ID | Source Module | Target Module | Dependency Class | External Mark | Next Status |
|---------|---------------|---------------|------------------|---------------|-------------|
| ADV-01 | `graph-advanced/01_semantic_cache/` | `apps/bff/src/langgraph-examples/graph-advanced/01-semantic-cache/` | External | Embeddings, semantic cache backend | Excluded |
| ADV-02 | `graph-advanced/02_tool_rag/` | `apps/bff/src/langgraph-examples/graph-advanced/02-tool-rag/` | External | Embeddings, tool RAG, vector index | Excluded |
| ADV-03 | `graph-advanced/03_async_webhook/` | `apps/bff/src/langgraph-examples/graph-advanced/03-async-webhook/` | External | Webhook server, Postgres, Docker, HTTP callback | Excluded |
| ADV-04 | `graph-advanced/04_graceful_degradation/` | `apps/bff/src/langgraph-examples/graph-advanced/04-graceful-degradation/` | Ready | Simulated flaky tools only | Done |
| ADV-05 | `graph-advanced/05_code_sandbox/` | `apps/bff/src/langgraph-examples/graph-advanced/05-code-sandbox/` | External | Docker/subprocess sandbox | Excluded |
| ADV-06 | `graph-advanced/06_postgres_checkpointer/` | `apps/bff/src/langgraph-examples/graph-advanced/06-postgres-checkpointer/` | External | Postgres checkpointer, Docker | Excluded |
| ADV-07 | `graph-advanced/07_vectordb_rag/` | `apps/bff/src/langgraph-examples/graph-advanced/07-vectordb-rag/` | External | Qdrant, embeddings, BM25/RRF, Docker | Excluded |
| ADV-08 | `graph-advanced/08_eval_harness/` | `apps/bff/src/langgraph-examples/graph-advanced/08-eval-harness/` | LLM-only | Existing OpenAI/LangSmith only | Done |
| ADV-09 | `graph-advanced/09_observability/` | `apps/bff/src/langgraph-examples/graph-advanced/09-observability/` | LLM-only | Existing LangSmith tracing only | Done |
| ADV-10 | `graph-advanced/10_async_sse/` | `apps/bff/src/langgraph-examples/graph-advanced/10-async-sse/` | External | Separate SSE HTTP server/static UI | Excluded |
| ADV-11 | `graph-advanced/11_multitenancy/` | `apps/bff/src/langgraph-examples/graph-advanced/11-multitenancy/` | External | Postgres store/checkpointer, JWT, Docker, HTTP server | Excluded |

### 5.12 Next Implementation Batches - Excluding External Dependencies

외부 의존성 제외 원칙에 따라 다음 구현은 아래 4개 Task ID만 대상으로 했고, 2026-07-07에 완료했다.

| Batch | Can Run In Parallel | Prerequisites | Notes |
|-------|---------------------|---------------|-------|
| R0 - Lecture Seed | LECTURE-01 | Phase 1 Done | reflection lecture 이식 기준 확정 |
| R1 - Advanced No-Infra | ADV-04 | Phase 1 Done | retry/degradation 패턴, deterministic tests 우선 |
| R2 - Eval/Observability | ADV-08, ADV-09 | Phase 1 Done, ADV-04 optional | LangSmith trace와 평가 harness만 사용 |
| R3 - Integration | registry update, tests, `langgraph.json` update | R0, R1, R2 | 공유 파일은 통합 담당자가 단독 수정 |

Excluded Task IDs for next work:

- `LECTURE-02`, `LECTURE-03`, `LECTURE-04`, `LECTURE-05`, `LECTURE-06`
- `ADV-01`, `ADV-02`, `ADV-03`, `ADV-05`, `ADV-06`, `ADV-07`, `ADV-10`, `ADV-11`

---

## 6. Progress Management

### 6.1 Progress Directory

모든 진행 상황은 `docs/progress/`에 기록한다. 서브에이전트가 작업을 이어받을 수 있도록 각 문서는 체크박스, 담당자, 근거 파일, 검증 명령, 결과를 포함해야 한다.

```text
docs/progress/
├── 00-bootstrap.progress.md
├── 01-shared-foundation.progress.md
├── 02-basic-graphs.progress.md
├── 03-bff-integration.progress.md
├── 04-langsmith-validation.progress.md
└── 05-remaining-scope.progress.md
```

### 6.2 Progress Status Values

| Status | Meaning |
|--------|---------|
| Pending | 아직 시작하지 않음 |
| In Progress | 진행 중 |
| Blocked | 외부 입력 또는 결정 필요 |
| Review | 구현 완료, 검토/검증 필요 |
| Done | 구현 및 검증 완료 |
| Excluded | 의도적으로 다음 작업 범위에서 제외 |

### 6.3 Per-Task Progress Template

```markdown
## Task ID

- Status:
- Owner:
- Depends On:
- Parallel Batch:
- Source:
- Target:
- Commands:
- LangSmith Trace:
- Notes:
- Next:
```

### 6.4 Subagent Handoff Rules

- 서브에이전트는 작업 시작 전 `goal.md`와 관련 `docs/progress/*.progress.md`를 먼저 읽는다.
- 한 번에 하나의 예제 또는 하나의 모듈만 담당한다.
- 작업 시작 전 해당 Task ID의 `Depends On`이 `Done` 또는 `Review`인지 확인한다.
- 원본 파일 경로와 대상 TS 파일 경로를 progress에 남긴다.
- 실행한 명령과 결과를 progress에 기록한다.
- 실패한 경우 `Blocked`로 표시하고 재현 명령을 남긴다.
- `.env` 내용은 progress에 기록하지 않는다.

---

## 7. Environment Plan

### 7.1 Env Copy Rule

- 원본 프로젝트의 `.env`를 JS 프로젝트 루트로 그대로 복사한다.
- `.env`는 커밋하지 않는다.
- `.env.example`에는 key 이름만 유지하고 secret 값은 넣지 않는다.

### 7.2 Expected Env Keys

```bash
OPENAI_API_KEY=
OPENAI_MODEL_DEFAULT=
OPENAI_MODEL_FAST=
OPENAI_MODEL_NORMAL=
OPENAI_MODEL_SMART=
OPENAI_MODEL_REASONING=
LANGGRAPH_MODEL=
LANGSMITH_TRACING=
LANGSMITH_API_KEY=
LANGSMITH_PROJECT=
```

---

## 8. LangSmith Test Strategy

### 8.1 Test Levels

| Level | Purpose | Tool |
|-------|---------|------|
| Unit | node/helper 함수 검증 | Vitest or Jest |
| Graph smoke | 각 graph invoke 가능 여부 확인 | LangGraph JS |
| BFF e2e | NestJS endpoint 동작 검증 | Supertest |
| Trace validation | LangSmith run 생성 여부 확인 | LangSmith UI/API |

### 8.2 Required Validation Per Graph

- graph가 compile 되는가
- minimal input으로 invoke 되는가
- LLM 사용 graph는 LangSmith trace가 생성되는가
- tool graph는 tool call cycle이 정상 종료되는가
- interrupt graph는 `thread_id` 기반 resume이 가능한가
- streaming graph는 chunk/event를 반환하는가

---

## 9. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Source API와 LangGraph JS API 차이 | High | High | 예제별 parity 기준을 progress에 기록 |
| LangGraph JS 버전 변경 | Medium | Medium | package version lock, 공식 문서 기준 구현 |
| interrupt/checkpointer 동작 차이 | High | Medium | 작은 예제부터 thread_id resume smoke test 작성 |
| LangSmith env 누락 | Medium | Medium | bootstrap 단계에서 env checklist 작성 |
| advanced 범위 조기 확장 | Medium | High | Phase 1에서는 basic만 완료 기준으로 관리 |
| `.env` secret 노출 | High | Low | `.gitignore` 확인, progress에는 env 값 기록 금지 |

---

## 10. Definition of Done

### Phase 1 Done

- [x] 루트 pnpm workspace에 포함된 단일 BFF package로 NestJS BFF가 생성되어 `pnpm --filter @reason-ball/langgraph-js-bff build`가 통과한다.
- [x] `apps/bff/package.json`에서 `studio`, `dev`, `build`, `start`가 정의되어 있다.
- [x] 대상 프로젝트 의존성은 `@langchain/langgraph` 기반이며 Python LangGraph 런타임을 포함하지 않는다.
- [x] `apps/bff/src/langgraph-examples`에서 basic graph가 export된다.
- [x] `GRAPH-01`부터 `GRAPH-29`까지 TypeScript 파일과 smoke test가 존재한다.
- [x] 각 basic graph의 smoke test가 존재한다.
- [x] NestJS BFF에서 invoke/stream/resume API가 동작한다.
- [x] LangSmith tracing env로 deterministic graph invoke가 성공한다.
- [x] `docs/progress/`에 모든 작업 상태와 검증 결과가 기록되어 있다.
- [x] `.env`는 복사되어 로컬 실행에 사용되지만 git에 포함되지 않는다.

### Implementation Status - 2026-07-07

| Area | Status | Evidence |
|------|--------|----------|
| BOOT | Done | `docs/progress/00-bootstrap.progress.md` |
| CORE | Done | `docs/progress/01-shared-foundation.progress.md` |
| GRAPH | Done | `docs/progress/02-basic-graphs.progress.md` |
| BFF | Done | `docs/progress/03-bff-integration.progress.md` |
| VALIDATE | Done | `docs/progress/04-langsmith-validation.progress.md` |

Final validation commands:

```bash
pnpm --filter @reason-ball/langgraph-js-bff build
pnpm --filter @reason-ball/langgraph-js-bff typecheck
pnpm --filter @reason-ball/langgraph-js-bff test
pnpm --filter @reason-ball/langgraph-js-bff lint
```

---

## 11. Immediate Next Steps

1. `External` 또는 `External-Optional`로 표시된 Task ID의 의존성 정책을 별도 결정한다.
2. Tavily/RAG/Postgres/Qdrant/Docker/SSE/JWT/sandbox 항목은 승인 전까지 제외 상태를 유지한다.
3. 추가 구현 전 `docs/progress/05-remaining-scope.progress.md`의 상태와 dependency class를 먼저 갱신한다.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-07-07 | Initial migration plan | Codex |
| 0.2 | 2026-07-07 | Add root package.json script plan for Studio, dev, build, and run | Codex |
| 0.3 | 2026-07-07 | Clarify LangGraph JS target runtime and Python source-reference-only rule | Codex |
| 0.4 | 2026-07-07 | Add Task ID registry and serial/parallel execution plan | Codex |
| 1.0 | 2026-07-07 | Complete Phase 1 implementation and validation | Codex |
| 1.1 | 2026-07-07 | Add remaining LECTURE/ADV Task IDs and external-dependency exclusions | Codex |
| 1.2 | 2026-07-07 | Complete non-external remaining LECTURE/ADV tasks | Codex |
| 1.3 | 2026-07-08 | Align pnpm and Turbo configuration with repository root workspace | Codex |
| 1.4 | 2026-07-08 | Collapse LangGraph examples and shared packages into single BFF package | Codex |
