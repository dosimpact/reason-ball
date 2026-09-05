# Codebase Memory MCP Tool Specification

이 문서는 로컬에 설치된 `codebase-memory-mcp 0.10.8`이 노출하는 MCP 도구를 정리한다.
예시는 이 저장소를 기준으로 작성했지만, 프로젝트 이름과 경로는 환경에 맞게 바꿔야 한다.

```text
PROJECT = Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo
REPO    = /Users/dosimpact/workspace/focus/reason-ball/apps/codebase-memory-todo
```

MCP 클라이언트에서 실제 도구 이름은 서버 이름이 접두사로 붙어
`mcp__codebase_memory_mcp__search_graph`처럼 보일 수 있다. 이 문서에서는 서버가 선언한
짧은 이름인 `search_graph`를 사용한다.

모든 도구는 MCP의 `CallToolResult` envelope로 응답한다.

```ts
interface CallToolResult {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
    | { type: "resource"; resource: unknown }
  >;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}
```

아래의 출력 예시는 읽기 쉽도록 `content[0].text`를 JSON 또는 tree 형식으로 디코딩한
모습이다. 서버 버전, 인덱스 모드, 저장소 상태에 따라 부가 필드와 행 수는 달라질 수 있다.
현재 MCP 선언은 도구별 **입력 schema**는 제공하지만 `content[0].text` 내부의 별도 JSON
Schema까지는 제공하지 않는다. 따라서 각 `Output schema`는 실제 응답과 도구 설명에서
확인한 핵심 필드를 문서화한 것이며, MCP wire contract 자체는 위 `CallToolResult`다.
`delete_project`, `manage_adr(update)`, `ingest_traces`처럼 상태를 바꾸는 도구의 출력은
문서 작성을 위해 실제 실행하지 않은 안전한 형태 예시다.

## 1. MCP Tool List

| 분류 | 도구 | 변경성 | 용도 |
|---|---|---:|---|
| Index | `list_projects` | 읽기 | 인덱싱된 프로젝트 목록 조회 |
| Index | `index_repository` | 쓰기 | 저장소를 지식 그래프로 인덱싱 또는 재인덱싱 |
| Index | `index_status` | 읽기 | 인덱스 상태, Git 문맥, 누락 커버리지 확인 |
| Index | `delete_project` | 삭제 | 프로젝트 인덱스 제거 |
| Orientation | `get_architecture` | 읽기 | 구조, 패키지, 라우트, 레이어, 클러스터 등 전체 개요 |
| Orientation | `get_graph_schema` | 읽기 | 노드 라벨, 엣지 타입, 속성 스키마 조회 |
| Discovery | `search_graph` | 읽기 | 이름, 자연어, semantic 검색으로 코드 심볼 발견 |
| Discovery | `search_code` | 읽기 | 문자열 검색 후 그래프 심볼로 보강 |
| Source | `get_code_snippet` | 읽기 | 정확한 qualified name의 소스 코드 조회 |
| Trace | `trace_path` | 읽기 | 호출, 데이터 흐름, cross-service 경로 추적 |
| Query | `query_graph` | 읽기 | Cypher 기반 다중 hop, 집계, 누락 그래프 질의 |
| Impact | `detect_changes` | 읽기 | Git diff에서 변경 파일과 전이 영향 범위 계산 |
| Coverage | `check_index_coverage` | 읽기 | 파일·경로 범위의 인덱싱 누락과 freshness 확인 |
| ADR | `manage_adr` | 읽기/쓰기 | Architecture Decision Record 조회·교체·목차 조회 |
| Runtime | `ingest_traces` | 쓰기 | 런타임 호출 trace를 그래프에 반영 |

권장 기본 흐름은 다음과 같다.

```text
list_projects / index_status
  -> get_architecture
  -> search_graph
  -> get_code_snippet
  -> trace_path
  -> 필요한 경우 query_graph 또는 search_code
  -> check_index_coverage
```

## 2. Tool Specifications

### 2.1 `list_projects`

인덱싱된 프로젝트를 결정적 pagination 순서로 반환한다. 세션 시작 시 현재 작업 경로와
일치하는 프로젝트 이름을 찾는 첫 호출로 사용한다.

#### Input schema

```ts
interface ListProjectsInput {
  include_details?: boolean;
  limit?: number;
  metadata_only?: boolean; // deprecated: include_details=false와 동일
  offset?: number;
}
```

- `include_details`: `true`이면 branch, 노드·엣지 수, DB 크기를 포함한다.
- `limit`, `offset`: 목록 pagination에 사용한다.

#### Input example

```json
{
  "include_details": true,
  "limit": 100,
  "offset": 0
}
```

#### Output example

```json
{
  "projects": [
    {
      "name": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo",
      "root_path": "/Users/dosimpact/workspace/focus/reason-ball/apps/codebase-memory-todo",
      "branch": "main",
      "nodes": 173,
      "edges": 321,
      "size_bytes": 2490368
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 100,
  "returned": 1,
  "has_more": false
}
```

#### Output schema

```ts
interface ListProjectsOutput {
  projects: Array<{
    name: string;
    root_path: string;
    branch?: string;
    nodes?: number;
    edges?: number;
    size_bytes?: number;
  }>;
  total: number;
  offset: number;
  limit: number;
  returned: number;
  has_more: boolean;
}
```

### 2.2 `index_repository`

저장소를 분석해 코드 지식 그래프를 생성한다. 이미 감시 중인 프로젝트는 자동 갱신되므로,
최초 등록 또는 대규모 외부 변경 직후 즉시 freshness가 필요할 때 사용한다.

#### Input schema

```ts
interface IndexRepositoryInput {
  repo_path: string;
  mode?: "full" | "moderate" | "fast" | "cross-repo-intelligence";
  name?: string;
  persistence?: boolean;
  target_projects?: string[];
}
```

- `repo_path`는 필수 절대 경로다.
- `full`: 전체 파일과 similarity/semantic 엣지를 생성한다.
- `moderate`: 필터된 파일과 similarity/semantic 엣지를 생성한다.
- `fast`: 필터된 파일만 처리하고 similarity/semantic 처리를 생략한다.
- `cross-repo-intelligence`: 코드를 다시 추출하지 않고 프로젝트 사이의 Route/Channel을
  매칭한다. 이 모드에서는 `target_projects`가 필요하다.
- `persistence=true`: `.codebase-memory/graph.db.zst` 공유 artifact를 생성한다.

#### Input example

```json
{
  "repo_path": "/Users/dosimpact/workspace/focus/reason-ball/apps/codebase-memory-todo",
  "mode": "full",
  "persistence": false
}
```

Cross-repository 예시:

```json
{
  "repo_path": "/workspace/orders-service",
  "mode": "cross-repo-intelligence",
  "target_projects": ["payments-service", "inventory-service"]
}
```

#### Output example

```json
{
  "project": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo",
  "status": "indexed",
  "mode": "full",
  "nodes": 173,
  "edges": 321,
  "parse_partial": { "count": 0, "files": [], "truncated": false },
  "skipped": { "count": 0, "files": [], "truncated": false },
  "excluded": { "count": 3 },
  "logfile": "/path/to/index-run.log"
}
```

#### Output schema

핵심 필드는 다음과 같다. 정확한 timing, persistence, cross-repository 통계는 모드에 따라
추가될 수 있다.

```ts
interface IndexRepositoryOutput {
  project: string;
  status: string;
  mode?: string;
  nodes?: number;
  edges?: number;
  parse_partial?: CoverageSummary;
  skipped?: CoverageSummary;
  excluded?: { count: number; files?: unknown[] };
  not_indexed_files?: unknown[];
  logfile?: string;
}

interface CoverageSummary {
  count: number;
  files: unknown[];
  truncated: boolean;
}
```

`parse_partial`은 일부 line range의 AST가 불완전할 수 있다는 뜻이고, `skipped`는 파일
전체가 인덱싱되지 않았다는 뜻이다. `excluded`와 `not_indexed_files`는 ignore 정책에 따른
의도적 제외다. 목록은 예시만 포함될 수 있으므로 완전한 정보는 `logfile`, `index_status`,
`query_graph(graph="missed")`로 확인한다.

### 2.3 `index_status`

프로젝트의 노드·엣지 수, 준비 상태, root path와 인덱스 커버리지 상태를 반환한다.
`verbose=true`이면 worktree와 Git SHA 정보를 추가한다.

#### Input schema

```ts
interface IndexStatusInput {
  project: string;
  verbose?: boolean;
}
```

#### Input example

```json
{
  "project": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo",
  "verbose": true
}
```

#### Output example

```json
{
  "project": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo",
  "nodes": 173,
  "edges": 321,
  "status": "ready",
  "root_path": "/Users/dosimpact/workspace/focus/reason-ball/apps/codebase-memory-todo",
  "git": {
    "branch": "main",
    "is_git": true,
    "is_worktree": true,
    "head_sha": "ac96772e..."
  },
  "parse_partial": { "files": [], "count": 0, "truncated": false },
  "skipped": { "files": [], "count": 0, "truncated": false },
  "not_indexed": {
    "dirs": [".turbo", "dist", "node_modules"],
    "dirs_count": 3,
    "files": [],
    "files_count": 0,
    "truncated": false
  }
}
```

#### Output schema

```ts
interface IndexStatusOutput {
  project: string;
  nodes: number;
  edges: number;
  status: string;
  root_path: string;
  git?: Record<string, unknown>;
  parse_partial: CoverageSummary;
  skipped: CoverageSummary;
  not_indexed: {
    dirs: string[];
    dirs_count: number;
    files: unknown[];
    files_count: number;
    truncated: boolean;
    note?: string;
  };
}
```

커버리지 목록에 없다는 사실만으로 그래프가 완전하다고 단정할 수는 없다.

### 2.4 `delete_project`

지정한 프로젝트의 저장된 인덱스를 제거한다. 소스 저장소를 삭제하는 도구는 아니지만,
복구하려면 다시 인덱싱해야 하므로 호출 전에 `list_projects`로 정확한 이름을 확인해야 한다.

#### Input schema

```ts
interface DeleteProjectInput {
  project: string;
}
```

#### Input example

```json
{
  "project": "temporary-demo-project"
}
```

#### Output example

```json
{
  "project": "temporary-demo-project",
  "status": "deleted"
}
```

#### Output schema

```ts
interface DeleteProjectOutput {
  project?: string;
  status?: string;
  deleted?: boolean;
  message?: string;
}
```

출력의 성공 메시지 형태는 서버 버전에 따라 달라질 수 있으며, 실패 시 MCP
`isError=true` 또는 오류 text가 반환된다.

### 2.5 `get_architecture`

프로젝트의 고수준 구조를 반환한다. 기본 호출은 구조 통계, 언어, 패키지, entry point를
포함하는 요약이며, `aspects`로 필요한 영역만 선택할 수 있다.

#### Input schema

```ts
type ArchitectureAspect =
  | "all"
  | "overview"
  | "structure"
  | "dependencies"
  | "routes"
  | "languages"
  | "packages"
  | "entry_points"
  | "hotspots"
  | "boundaries"
  | "layers"
  | "file_tree"
  | "clusters"
  | "cycles";

interface GetArchitectureInput {
  project: string;
  aspects?: ArchitectureAspect[];
  path?: string;
}
```

- `path`: repository-relative directory prefix로 결과를 제한한다.
- `cycles`는 `all`이나 `overview`에 자동 포함되지 않으며 명시적으로 요청해야 한다.
- `clusters`는 call/import 그래프에 Leiden community detection을 적용한다.

#### Input example

```json
{
  "project": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo",
  "aspects": ["all", "cycles"]
}
```

#### Output example

```text
project: Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo
total_nodes: 173
total_edges: 321
languages: 3
  TypeScript 14
  HTML 1
  CSS 1
packages: 3
  server 29 0 0
  client 16 0 0
  codebase-memory-proxy 6 0 0
routes: 4
  GET / -
  POST / -
  PATCH /:id -
  DELETE /:id -
cycles_total: 0
```

#### Output schema

Tree 출력은 요청한 aspect마다 표를 추가한다. JSON 출력 모델에 대응하는 핵심 구조는
다음과 같다.

```ts
interface GetArchitectureOutput {
  project: string;
  total_nodes: number;
  total_edges: number;
  node_labels?: Array<{ label: string; count: number }>;
  edge_types?: Array<{ type: string; count: number }>;
  languages?: unknown[];
  packages?: unknown[];
  entry_points?: unknown[];
  routes?: unknown[];
  hotspots?: unknown[];
  boundaries?: unknown[];
  layers?: unknown[];
  clusters?: unknown[];
  file_tree?: unknown[];
  cycles_total?: number;
  cycles?: unknown[];
}
```

### 2.6 `get_graph_schema`

현재 프로젝트 그래프에 실제로 존재하는 노드 라벨, 엣지 타입, 각 속성을 반환한다.
Cypher를 작성하기 전에 호출하면 잘못된 라벨·속성 사용을 줄일 수 있다.

#### Input schema

```ts
interface GetGraphSchemaInput {
  project: string;
}
```

#### Input example

```json
{
  "project": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo"
}
```

#### Output example

```json
{
  "node_labels": [
    {
      "label": "Function",
      "count": 20,
      "properties": [
        "name",
        "qualified_name",
        "file_path",
        "start_line",
        "end_line",
        "complexity",
        "is_entry_point"
      ]
    }
  ],
  "edge_types": [
    {
      "type": "CALLS",
      "count": 36,
      "properties": ["source_id", "target_id", "args", "confidence", "strategy"]
    }
  ],
  "adr_present": false
}
```

#### Output schema

```ts
interface GetGraphSchemaOutput {
  node_labels: Array<{
    label: string;
    count: number;
    properties: string[];
  }>;
  edge_types: Array<{
    type: string;
    count: number;
    properties: string[];
  }>;
  adr_present?: boolean;
  adr_hint?: string;
}
```

### 2.7 `search_graph`

함수, 메서드, 클래스, 라우트, 변수 등 구조화된 심볼을 검색한다. 코드 정의와 구조를 찾을
때 filesystem grep보다 우선 사용한다.

#### Input schema

```ts
interface SearchGraphInput {
  project: string;
  query?: string;
  name_pattern?: string;
  semantic_query?: string[];
  qn_pattern?: string;
  label?: string;
  file_pattern?: string;
  relationship?: string;
  min_degree?: number;
  max_degree?: number;
  exclude_entry_points?: boolean;
  include_connected?: boolean;
  fields?: string[];
  detail?: "ids" | "default";
  format?: "tree" | "json";
  limit?: number;
  offset?: number;
}
```

검색 모드는 세 가지다.

- `query`: BM25 자연어·keyword 검색. 지정되면 `name_pattern`보다 우선한다.
- `name_pattern`: 이름 정규식 검색.
- `semantic_query`: 의미 유사도 검색. 문자열 하나가 아니라 keyword 배열이어야 하며
  `moderate` 또는 `full` 인덱스가 필요하다.

`in`, `out`은 `CALLS`, `USAGE`, `CALL_REFERENCE`, `INHERITS`, `IMPLEMENTS`에서 계산한
선택 degree이며 정확한 caller/callee 수가 아니다.

#### Input example

```json
{
  "project": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo",
  "query": "create todo",
  "label": "Function",
  "fields": ["signature", "complexity", "is_entry_point"],
  "format": "tree",
  "limit": 50,
  "offset": 0
}
```

#### Output example

```text
total: 2
search_mode: bm25
results: 2
Users-...src.client.api.todos-api:
  createTodo Function 39-44 1 3 "(title: string)" 1 true
Users-...src.server.services.todo-service.TodoService:
  createTodo Method 14-23 2 3 "(input: CreateTodoInput)" 2 false
has_more: false
```

#### Output schema

```ts
interface SearchGraphOutput {
  total: number;
  results: unknown[];
  semantic_results?: unknown[];
  search_mode?: string;
  has_more: boolean;
}
```

기본 `limit`은 50이다. `has_more=true`이면 `offset += limit`으로 반복 호출한다.
`format="json"`도 tree와 동일한 그룹·컬럼 모델을 구조화 JSON으로 반환한다.

### 2.8 `search_code`

문자열을 검색한 뒤 결과를 포함 함수나 심볼로 deduplicate하고 그래프 중요도로 보강한다.
URL, 에러 메시지, config 값, 비코드 파일 또는 그래프가 놓친 구문을 찾을 때 적합하다.

#### Input schema

```ts
interface SearchCodeInput {
  project: string;
  pattern: string;
  regex?: boolean;
  file_pattern?: string;
  path_filter?: string;
  mode?: "compact" | "full" | "files";
  context?: number;
  debug?: boolean;
  limit?: number;
}
```

- `compact`: signature와 메타데이터 중심의 기본 출력.
- `full`: 첫 match 주변 최대 60줄의 source를 포함한다.
- `files`: 파일 경로만 반환한다.
- `context`: `compact`에서만 grep 문맥 줄 수를 지정한다.
- `path_filter`: 결과 경로에 적용되는 정규식이다.

#### Input example

```json
{
  "project": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo",
  "pattern": "/api/todos",
  "regex": false,
  "path_filter": "^src/",
  "mode": "full",
  "limit": 20
}
```

#### Output example

```json
{
  "cols": ["qn", "label", "file", "lines", "matches", "in", "out", "source"],
  "rows": [
    [
      "Users-...src.client.api.todos-api.TODO_API_PATH",
      "Variable",
      "src/client/api/todos-api.ts",
      "1-1",
      [1],
      0,
      0,
      { "source": "export const TODO_API_PATH = \"/api/todos\";\n" }
    ]
  ],
  "total_grep_matches": 5,
  "total_results": 5,
  "elapsed_ms": 40
}
```

#### Output schema

```ts
interface SearchCodeOutput {
  cols?: string[];
  rows?: unknown[][];
  results?: unknown[];
  files?: string[];
  raw_matches?: unknown;
  directories?: unknown;
  total_grep_matches: number;
  total_results: number;
  raw_match_count?: number;
  elapsed_ms?: number;
  source_truncated?: boolean;
}
```

기본 `limit`은 10이고 `offset`은 지원하지 않는다. `total_results > limit`이면 limit을
늘리거나 `file_pattern`, `path_filter`로 범위를 좁힌다.

### 2.9 `get_code_snippet`

하나의 함수·클래스·심볼에 대한 정확한 소스 범위를 반환한다. 검색 도구가 아니므로 먼저
`search_graph`로 정확한 `qualified_name`을 찾아야 한다.

#### Input schema

```ts
interface GetCodeSnippetInput {
  project: string;
  qualified_name: string;
  include_neighbors?: boolean;
}
```

- short name도 허용하지만 중복되면 suggestion만 반환될 수 있다.
- `include_neighbors=true`이면 인접 구조 정보가 추가될 수 있다.

#### Input example

```json
{
  "project": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo",
  "qualified_name": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo.src.server.services.todo-service.TodoService",
  "include_neighbors": true
}
```

#### Output example

```json
{
  "name": "TodoService",
  "qualified_name": "Users-...src.server.services.todo-service.TodoService",
  "label": "Class",
  "file_path": "/Users/dosimpact/workspace/focus/reason-ball/apps/codebase-memory-todo/src/server/services/todo-service.ts",
  "start_line": 7,
  "end_line": 63,
  "source": "export class TodoService {\n  ...\n}\n",
  "callers": 2,
  "callees": 0,
  "caller_names": ["createApp", "tests/todo-service.test.ts"]
}
```

#### Output schema

```ts
interface GetCodeSnippetOutput {
  name: string;
  qualified_name: string;
  label: string;
  file_path: string;
  start_line: number;
  end_line: number;
  source: string;
  callers?: number;
  callees?: number;
  caller_names?: string[];
  callee_names?: string[];
  coverage_note?: string;
  suggestions?: unknown[];
}
```

`coverage_note`가 있으면 해당 파일의 표시된 line range를 직접 읽어 검증한다.

### 2.10 `trace_path`

정확한 심볼을 기준으로 caller, callee, 데이터 전달 또는 cross-service 경로를 추적한다.
먼저 `search_graph`로 정확한 이름을 찾는 것이 안전하다.

#### Input schema

```ts
interface TracePathInput {
  project: string;
  function_name: string;
  direction?: "inbound" | "outbound" | "both";
  depth?: number;
  mode?: "calls" | "data_flow" | "cross_service";
  edge_types?: string[];
  parameter_name?: string;
  include_evidence?: boolean;
  include_tests?: boolean;
  risk_labels?: boolean;
  format?: "tree" | "json";
  limit?: number;
  cursor?: string;
}
```

- `calls`: `CALLS`를 따라 caller/callee를 찾는다.
- `data_flow`: `CALLS`와 `DATA_FLOWS`를 따라 인자 표현식을 표시한다.
- `cross_service`: HTTP, async, channel, gRPC, GraphQL, tRPC 등 cross-project 엣지를
  따라간다.
- `include_evidence`: 해석 전략(`lsp`, `language_rule`, `heuristic`, `unresolved`)과
  confidence를 포함한다.

#### Input example

```json
{
  "project": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo",
  "function_name": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo.src.client.hooks.use-todo-workflow.useTodoWorkflow",
  "direction": "both",
  "depth": 4,
  "mode": "calls",
  "include_evidence": true,
  "limit": 100
}
```

#### Output example

```text
function: Users-...useTodoWorkflow
direction: both
mode: calls
callees_total: 6
callees: 6
Users-...src.client.api.todos-api:
  createTodo 1 lsp 0.95
  deleteTodo 1 lsp 0.95
  fetchTodos 1 lsp 0.95
  request 2 lsp 0.95
  toggleTodo 1 lsp 0.95
callers_total: 1
callers: 1
Users-...src.client.pages.todo-page:
  TodoPage 1 lsp 0.95
```

#### Output schema

```ts
interface TracePathOutput {
  function: string;
  direction: string;
  mode: string;
  callees_total?: number;
  callers_total?: number;
  callees?: unknown[];
  callers?: unknown[];
  truncated?: boolean;
  next?: string;
}
```

`callees_total`, `callers_total`은 현재 page가 아니라 지정 depth 내 전체 도달 노드 수다.
`truncated=true`이면 동일한 인자와 `cursor=next`로 다음 page를 요청한다. 재인덱싱 후 기존
cursor는 만료될 수 있다.

### 2.11 `query_graph`

Cypher로 코드 그래프 또는 누락 그래프를 질의한다. 복잡한 다중 hop, 집계, cross-service
관계, 복잡도 분석에 사용한다.

#### Input schema

```ts
interface QueryGraphInput {
  project: string;
  query: string;
  graph?: "code" | "missed";
  max_rows?: number;
}
```

- `graph="code"`: 기본 코드 지식 그래프.
- `graph="missed"`: 완전히 또는 부분적으로 인덱싱하지 못한 파일만 포함하는 그래프.
- 최대 100,000행 hard ceiling이 있으므로 넓은 질의에는 Cypher `LIMIT`을 추가한다.

#### Input example

```json
{
  "project": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo",
  "graph": "code",
  "query": "MATCH (a)-[r:CALLS]->(b) WHERE a.file_path =~ 'src/.*' RETURN a.qualified_name AS caller, b.qualified_name AS callee, r.confidence AS confidence LIMIT 50",
  "max_rows": 50
}
```

누락 그래프 예시:

```json
{
  "project": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo",
  "graph": "missed",
  "query": "MATCH (f:File) WHERE f.kind = \"parse_partial\" RETURN f.file_path, f.detail LIMIT 100"
}
```

#### Output example

```text
rows: 2  (cols: caller callee confidence)
  Users-...useTodoWorkflow Users-...fetchTodos "0.95"
  Users-...fetchTodos Users-...request "0.95"
total: 2
```

#### Output schema

```ts
interface QueryGraphOutput {
  rows: unknown[];
  cols?: string[];
  total: number;
  hint?: string;
}
```

함수·메서드 노드에서는 `complexity`, `cognitive`, `loop_count`, `loop_depth`,
`transitive_loop_depth`, `linear_scan_in_loop`, `alloc_in_loop`, `recursive`,
`unguarded_recursion`, `param_count`, `max_access_depth` 등의 속성을 질의할 수 있다.

### 2.12 `detect_changes`

Git diff의 변경 파일을 그래프 심볼로 변환하고, 지정 방향으로 전이 영향 범위를 계산한다.
변경 심볼 자체는 `impacted`에서 제외된다.

#### Input schema

```ts
interface DetectChangesInput {
  project: string;
  base_branch?: string;
  since?: string;
  scope?: "files" | "impact";
  direction?: "inbound" | "outbound" | "both";
  depth?: number;
  limit?: number;
  format?: "tree" | "json";
}
```

- `since`: `HEAD~5`, `v0.5.0` 같은 ref와 `HEAD` 사이를 비교한다.
- `scope="files"`: 변경 파일만 반환한다.
- `scope="impact"`: 변경 파일과 전이 영향 심볼을 반환한다.
- 기본 방향 `inbound`는 변경 심볼의 transitive caller, 즉 blast radius다.

#### Input example

```json
{
  "project": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo",
  "base_branch": "main",
  "scope": "impact",
  "direction": "inbound",
  "depth": 3,
  "limit": 100,
  "format": "json"
}
```

#### Output example

```json
{
  "base": "main",
  "merge_base": "550fcf1d...",
  "changed_files": ["src/server/services/todo-service.ts"],
  "impacted": [
    {
      "qualified_name": "Users-...src.server.http.todo-controller.TodoController.createTodo",
      "label": "Method",
      "hop": 1
    }
  ],
  "impacted_modules": ["src.server.http.todo-controller"],
  "impacted_total": 1,
  "truncated": false
}
```

#### Output schema

```ts
interface DetectChangesOutput {
  base?: string;
  merge_base?: string;
  changed_files: string[];
  impacted?: unknown[];
  impacted_modules?: unknown[];
  impacted_total?: number;
  truncated?: boolean;
}
```

`impacted_total`과 module rollup은 표시 `limit`과 관계없이 전체 통계를 나타낸다.

### 2.13 `check_index_coverage`

조사하거나 인용할 파일과 경로 범위가 인덱서에 의해 완전히 처리되지 못한 기록이 있는지,
그리고 현재 파일 metadata와 인덱스 generation이 일치하는지 확인한다.

#### Input schema

```ts
interface CheckIndexCoverageInput {
  project: string;
  paths?: string[];
  scopes?: string[];
  scope_limit?: number;
  scope_offset?: number;
}
```

`paths` 또는 `scopes` 중 하나 이상이 필수다. 경로는 repository-relative 형식이며 프로젝트
전체 범위는 `scopes: ["."]`로 지정한다.

#### Input example

```json
{
  "project": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo",
  "paths": [
    "src/server/services/todo-service.ts",
    "src/server/repositories/todo-repository.ts"
  ],
  "scopes": ["src/server"],
  "scope_limit": 100,
  "scope_offset": 0
}
```

#### Output example

```json
{
  "project": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo",
  "signal": "best_effort",
  "indexed_at": "2026-08-30T07:29:05Z",
  "metadata": {
    "generation": "2026-08-30T07:29:05Z",
    "index_mode": "full",
    "recording_status": "complete",
    "generation_matches": true
  },
  "paths": [
    {
      "requested_path": "src/server/services/todo-service.ts",
      "path": "src/server/services/todo-service.ts",
      "status": "no_recorded_issue",
      "freshness": "metadata_match",
      "recommended_action": "use_graph_with_best_effort_caveat",
      "coverage": []
    }
  ],
  "scopes": [
    {
      "requested_scope": "src/server",
      "scope": "src/server",
      "total": 0,
      "has_more": false,
      "entries": [],
      "status": "no_recorded_issue"
    }
  ],
  "caveat": "Best-effort signal only."
}
```

#### Output schema

```ts
interface CheckIndexCoverageOutput {
  project: string;
  signal: "best_effort" | string;
  indexed_at?: string;
  metadata: {
    generation?: string;
    index_mode?: string;
    recording_status?: string;
    generation_matches?: boolean;
    [key: string]: unknown;
  };
  paths: Array<{
    requested_path: string;
    path?: string;
    status: string;
    freshness?: string;
    recommended_action?: string;
    coverage: unknown[];
  }>;
  scopes: Array<{
    requested_scope: string;
    scope?: string;
    total: number;
    has_more: boolean;
    entries: unknown[];
    status: string;
  }>;
  caveat?: string;
}
```

`no_recorded_issue`는 알려진 누락이 없다는 뜻이지 완전성의 증명은 아니다. partial,
skipped, excluded, stale, pending, unknown 상태에서는 제시된 line range나 scope를 직접
읽어야 한다.

### 2.14 `manage_adr`

프로젝트 인덱스와 함께 유지되는 Architecture Decision Record를 조회하거나 교체한다.

#### Input schema

```ts
interface ManageAdrInput {
  project: string;
  mode?: "get" | "update" | "sections";
  content?: string;
}
```

- `get`: 전체 ADR을 조회한다.
- `sections`: 현재 ADR의 heading 목록만 조회한다.
- `update`: 기존 문서를 patch하지 않고 `content`로 완전히 교체한다.

#### Input example

조회:

```json
{
  "project": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo",
  "mode": "get"
}
```

교체:

```json
{
  "project": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo",
  "mode": "update",
  "content": "# PURPOSE\nTodo 관리 구조 분석 fixture\n\n# ARCHITECTURE\nclient -> HTTP -> controller -> service -> repository\n"
}
```

#### Output example

ADR이 없는 경우:

```json
{
  "project": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo",
  "adr_present": false,
  "content": null
}
```

`sections` 예시:

```json
{
  "project": "demo",
  "sections": ["PURPOSE", "ARCHITECTURE", "TRADEOFFS"]
}
```

#### Output schema

```ts
interface ManageAdrOutput {
  project?: string;
  mode?: string;
  adr_present?: boolean;
  content?: string | null;
  sections?: string[];
  status?: string;
  message?: string;
}
```

`update`는 전체 문서를 대체하므로 기존 내용을 먼저 `get`으로 읽고 병합한 뒤 호출해야 한다.

### 2.15 `ingest_traces`

관측된 런타임 caller/callee trace와 호출 횟수를 그래프에 반영한다. 정적 분석에서 확인하기
어려운 동적 dispatch나 프레임워크 호출 관계를 보강할 때 사용한다.

#### Input schema

```ts
interface IngestTracesInput {
  project: string;
  traces: Array<{
    caller?: string;
    callee?: string;
    count?: number;
  }>;
}
```

`caller`, `callee`에는 가능한 한 그래프의 정확한 qualified name을 사용한다.

#### Input example

```json
{
  "project": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo",
  "traces": [
    {
      "caller": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo.src.client.hooks.use-todo-workflow.useTodoWorkflow",
      "callee": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo.src.client.api.todos-api.fetchTodos",
      "count": 12
    }
  ]
}
```

#### Output example

```json
{
  "project": "Users-dosimpact-workspace-focus-reason-ball-apps-codebase-memory-todo",
  "status": "ingested",
  "received": 1,
  "matched": 1,
  "unmatched": 0
}
```

#### Output schema

```ts
interface IngestTracesOutput {
  project?: string;
  status?: string;
  received?: number;
  matched?: number;
  unmatched?: number;
  created_edges?: number;
  updated_edges?: number;
  message?: string;
}
```

이 도구는 그래프 상태를 변경한다. 대량 trace를 넣기 전에 프로젝트 이름과 qualified name
매칭률을 작은 표본으로 검증하는 것이 안전하다.

## 3. Pagination, Coverage, and Evidence Rules

1. 세션 시작 시 `list_projects` 또는 `index_status`로 프로젝트와 freshness를 확인한다.
2. `search_graph`는 `has_more`가 `false`가 될 때까지 `offset`을 증가시킨다.
3. `trace_path`는 `truncated=true`이면 `next`를 동일 인자와 함께 `cursor`로 전달한다.
4. `search_code`에는 `offset`이 없으므로 limit을 높이거나 검색 범위를 좁힌다.
5. 조사한 모든 파일은 마지막에 `check_index_coverage(paths=[...])`로 확인한다.
6. 부재·완전성 주장은 `scopes`도 함께 검사하고, 알려진 누락 범위는 직접 소스를 읽는다.
7. `indexed_no_recorded_gap` 또는 `no_recorded_issue`는 best-effort 신호이지 완전성 증명이
   아니다.
8. React callback, reflection, dependency injection, HTTP 경계 같은 런타임 관계는 정적
   `CALLS` 엣지와 구분하고 소스·라우트·trace로 보강한다.

## 4. Common Edge Types

```text
CALLS
HTTP_CALLS
ASYNC_CALLS
DATA_FLOWS
IMPORTS
DEFINES
DEFINES_METHOD
HANDLES
IMPLEMENTS
OVERRIDE
USAGE
CALL_REFERENCE
CONFIGURES
FILE_CHANGES_WITH
SIMILAR_TO
SEMANTICALLY_RELATED
CONTAINS_FILE
CONTAINS_FOLDER
CONTAINS_PACKAGE
```

실제 프로젝트에 존재하는 라벨, 엣지와 속성은 항상 `get_graph_schema` 결과를 기준으로 한다.
