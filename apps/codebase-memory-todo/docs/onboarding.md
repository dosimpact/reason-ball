# Codebase memroy mcp onboarding  



## Install & Indexing 

```bash
curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash
# 설치를 진행하면 알아서 user scope mcp(codex cli)로 등록된다.  

  [mcp_servers.codebase-memory-mcp]
  command = "/Users/{USER}/.local/bin/codebase-memory-mcp"
  args = []
  env_vars = ["CBM_CACHE_DIR", "CBM_RUNTIME_DIR"] 


codebase-memory-mcp --ui=true --port=9749

# indexing
codebase-memory-mcp cli index_repository --repo-path /absolute/path/to/repo
# 1, 
codebase-memory-mcp get_architecture  
```

## Points 

### Architecture Decision Record 이라는 개념을 사용한다.  

```md
ADR = Architecture Decision Record

중요한 아키텍처 의사결정을 짧게 기록해두는 문서입니다.

예를 들어:
결정:프론트엔드 상태 관리는 Redux 대신 Zustand를 사용한다.
이유: - boilerplate가 적음 - 현재 앱 규모에 충분함 - React와 통합이 단순함
대안: - Redux Toolkit - Jotai
단점: - 대규모 상태 흐름 추적은 Redux보다 약할 수 있음

핵심은 “무엇을 선택했는가”보다 “왜 그렇게 결정했는가”를 남기는 것입니다.
보통 ADR 하나는 이런 구조입니다.

# ADR-001: Zustand 사용

Status: Accepted

## Context
현재 상태 관리가 복잡해지고 있다.

## Decision
Zustand를 사용한다.

## Alternatives
- Redux Toolkit
- Context API

## Consequences
장점: 코드가 단순해짐
단점: 복잡한 이벤트 추적 기능은 부족함
왜 필요하냐면

몇 달 뒤 코드를 보면:

"왜 이렇게 만들었지?"
"왜 Redux 안 썼지?"
"왜 이 레이어가 존재하지?"

라는 문제가 생깁니다.

코드만으로는 당시의 제약조건과 의사결정 이유를 알기 어렵습니다.

그래서:

코드 = 어떻게 구현했는가
ADR  = 왜 이렇게 설계했는가

라고 보면 가장 정확합니다.

특히 AI Agent가 코드베이스를 탐색할 때 ADR까지 가지고 있으면 현재 구조뿐 아니라 설계 의도까지 이해할 수 있다는 점이 큽니다.
```


### Node와 Edge 카탈로그

Codebase Memory는 코드 구조를 다음과 같은 **속성 그래프**로 표현합니다.

```text
(Node)-[Edge]->(Node)
```

- **Node**는 프로젝트, 파일, 함수처럼 분석 대상이 되는 개체입니다.
- **Edge**는 포함, 정의, 호출처럼 두 개체 사이의 관계입니다.
- 실제 Label과 Edge Type은 언어, 프레임워크, 인덱스 상태에 따라 달라집니다. 따라서 고정 목록을 가정하지 말고 `get_graph_schema`로 현재 스키마를 먼저 확인합니다.

이 프로젝트에서 관찰된 Node Label

| 분류 | Node Label | 의미 |
| --- | --- | --- |
| 프로젝트 | `Project` | 인덱싱된 저장소 또는 프로젝트 |
| 프로젝트 | `Branch` | 현재 인덱스가 추적하는 Git 브랜치 정보 |
| 구조 | `Folder` | 디렉터리 |
| 구조 | `File` | 소스, 설정, 문서 파일 |
| 구조 | `Module` | 언어 파서가 인식한 모듈 단위 |
| 구조 | `Section` | 문서나 구조화된 파일에서 인식한 섹션 |
| 코드 | `Class` | 클래스 |
| 코드 | `Interface` | 인터페이스 |
| 코드 | `Function` | 독립 함수 또는 함수 표현식 |
| 코드 | `Method` | 클래스나 객체에 속한 메서드 |
| 코드 | `Variable` | 변수 또는 상수 선언 |
| 실행 | `Route` | HTTP 메서드와 경로로 식별되는 라우트 |
| 실행 | `Channel` | 서버가 수신하는 전송 채널 또는 주소 |
| 설정 | `EnvVar` | 코드에서 참조하는 환경변수 |

대략적인 구조는 다음과 같습니다. 모든 Node가 반드시 이 트리에 포함되는 것은 아닙니다.

```text
Project
├─ Branch
└─ Folder
   └─ File
      ├─ Module
      ├─ Section
      ├─ Class
      │  └─ Method
      ├─ Interface
      ├─ Function
      └─ Variable

Route, Channel, EnvVar는 코드 심벌과 별도의 관계로 연결될 수 있습니다.
```

#### 이 프로젝트에서 관찰된 Edge Type

| 분류 | Edge Type | 의미 |
| --- | --- | --- |
| 포함 | `CONTAINS_FOLDER` | 프로젝트나 폴더가 하위 폴더를 포함 |
| 포함 | `CONTAINS_FILE` | 프로젝트나 폴더가 파일을 포함 |
| 정의 | `DEFINES` | 파일이나 모듈이 심벌을 정의 |
| 정의 | `DEFINES_METHOD` | 클래스가 메서드를 정의 |
| 의존 | `IMPORTS` | 파일이나 모듈의 import 관계 |
| 호출 | `CALLS` | 식별된 함수나 메서드 호출 관계 |
| 참조 | `CALL_REFERENCE` | 호출 가능한 심벌을 값으로 참조하며 대상까지 식별된 관계 |
| 참조 | `USAGE` | 식별자를 사용하지만 호출 관계로 확정하지 않은 관계 |
| 실행 | `HANDLES` | 핸들러가 라우트나 이벤트를 처리 |
| 실행 | `LISTENS_ON` | 서버 또는 리스너가 특정 채널에서 요청을 수신 |
| 실행 | `RAISES` | 코드가 오류나 예외를 발생시킴 |
| 타입 | `IMPLEMENTS` | 클래스 등이 인터페이스를 구현 |
| 설정 | `CONFIGURES` | 코드나 설정이 환경변수·리소스를 구성 |
| Git | `HAS_BRANCH` | 프로젝트와 인덱싱된 브랜치를 연결 |
| 의미 | `SEMANTICALLY_RELATED` | 구조적 호출과 별개로 의미가 유사한 대상을 연결 |

`HTTP_CALLS`, `ASYNC_CALLS`, `DATA_FLOWS`, `FILE_CHANGES_WITH`, `SIMILAR_TO`, `OVERRIDE`, `CONTAINS_PACKAGE` 같은 관계도 분석 대상과 수집된 정보에 따라 나타날 수 있습니다. 현재 스키마에 없다는 사실만으로 해당 관계가 코드에 존재하지 않는다고 단정해서는 안 됩니다.

#### 호출 관계를 읽는 기준

호출과 사용 관계는 다음처럼 구분합니다.

```text
caller ──CALLS─────────> save       # save()처럼 호출
caller ──CALL_REFERENCE> save       # 콜백 값으로 전달하며 대상 식별
caller ──USAGE─────────> save       # 식별자 사용은 확인했지만 호출로 확정하지 않음
```

`CALLS`에도 `confidence`, `strategy`, `via` 같은 속성이 포함될 수 있습니다. 중요한 호출 경로는 그래프 결과만으로 확정하지 말고 `get_code_snippet`, 소스 읽기, 타입 검사와 테스트로 교차 검증합니다. 특히 HTTP 및 React 관계는 정적 분석으로 추론됐을 수 있으므로, 실제로 증명된 호출 Edge와 구분해 기록합니다.

현재 카탈로그는 다음 MCP 호출로 다시 확인할 수 있습니다.

```text
get_graph_schema(project="<list_projects에서 확인한 프로젝트 이름>")
```

### 특정 비즈니스 로직을 찾기 위한 과정 

```
• 완전히 고정된 “좁혀지는 순서”는 아닙니다. 각 도구가 서로 다른 질문에 답합니다. 특히
  trace_path는 하나의 함수에서 주변 호출 관계를 펼치므로 오히려 범위를 넓힐 수도 있습니다.

  특정 비즈니스 로직을 파악할 때는 다음 흐름이 더 적절합니다.

   단계    도구                    확인하는 것
  ━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   1       get_architecture        전체 패키지, 계층, 라우트 등 큰 그림
  ──────  ──────────────────────  ──────────────────────────────────────────────
   2       search_graph            관련 함수·클래스·라우트 후보 검색
  ──────  ──────────────────────  ──────────────────────────────────────────────
   3       search_code             URL, 에러 메시지, 설정값 등 실제 문자열 검색
  ──────  ──────────────────────  ──────────────────────────────────────────────
   4       get_code_snippet        후보 함수의 정확한 구현 확인
  ──────  ──────────────────────  ──────────────────────────────────────────────
   5       trace_path              누가 호출하고 무엇을 호출하는지 추적
  ──────  ──────────────────────  ──────────────────────────────────────────────
   6       query_graph             여러 관계를 조합하거나 집계하는 특수 질문
  ──────  ──────────────────────  ──────────────────────────────────────────────
   7       check_index_coverage    조사한 파일의 인덱스 누락 여부 확인


--- 
핵심 흐름은 보통 다음과 같습니다.

  전체 구조 파악
    ↓
  관련 심볼 발견
    ↓
  실제 구현 확인
    ↓
  호출 흐름 추적
    ↓
  복잡한 관계만 별도 질의

  query_graph와 search_code는 순서가 고정되지 않습니다.

  - 함수 이름이나 역할을 찾을 때: search_graph
  - "/api/todos" 같은 URL을 찾을 때: search_code
  - CALLS, HANDLES, HTTP_CALLS를 조합할 때: query_graph
  - 정확한 함수 구현을 읽을 때: get_code_snippet

  예를 들어 “할 일 생성” 로직을 파악한다면:

  1. get_architecture로 client/server 계층 확인
  2. search_graph(query="create todo")로 관련 심볼 발견
  3. get_code_snippet으로 createTodo 구현 확인
  4. trace_path(direction="both")로 호출자와 피호출자 확인
  5. HTTP 경계는 trace_path(mode="cross_service") 또는 query_graph로 확인
  6. HTTP 엣지가 없다면 search_code(pattern="/api/todos")로 양쪽 코드를 연결
  7. 최종적으로 소스와 테스트로 검증

  이 프로젝트에서는 대략 다음 흐름을 예상할 수 있습니다.

  TodoForm
  → useTodoWorkflow
  → client createTodo
  → HTTP POST /api/todos
  → TodoController.createTodo
  → TodoService.createTodo
  → TodoRepository

  단, client → HTTP → controller 연결은 일반 CALLS 엣지가 아니라 HTTP 관계입니다. 그래프에
  HTTP_CALLS가 없다면 URL과 라우트 등록을 통해 추론해야 하며, 이때는 “증명된 호출 엣지”와
  “HTTP 경로 기반 추론”을 구분해야 합니다.

  따라서 추천 순서는:

  get_architecture
  → search_graph / search_code
  → get_code_snippet
  → trace_path
  → 필요할 때 query_graph
  → check_index_coverage + 소스 검증
```


## MCP Usage 

### codebase-memory-mcp get_architecture 명령어 수행해봐  

```
• MCP의 get_architecture를 직접 실행했습니다.

  total_nodes: 173
  total_edges: 321

  languages:
    TypeScript 14
    HTML 1
    CSS 1

  packages:
    server
    client
    codebase-memory-proxy

  entry_points: 11

  직전 아키텍처 결과와 비교하면 codebase-memory-proxy 패키지가 추가되어 있습니다. 인덱스 상태
  는 ready이며 누락 또는 부분 파싱으로 기록된 파일은 없습니다.


```
### › entry_points: 11 는 어떻게 잡힌거야? entry_points: 11는 뭐야 ?

```
• 정확히 말하면 entry_points: 11은 실행 시작점이 11개라는 뜻이 아니라, 인덱서가
  is_entry_point=true로 표시한 함수 노드가 11개라는 뜻입니다.

  설치된 codebase-memory-mcp 0.10.8의 판정 규칙은 다음과 같습니다.

  1. JavaScript/TypeScript/TSX 함수가 export_statement 아래에 있으면 엔트리 포인트로 표시
  2. 이름이 main인 함수는 언어와 관계없이 표시
  3. 결과를 만들 때 테스트 함수와 경로에 test가 포함된 항목은 제외
  4. 최대 20개까지 출력

  이 규칙은 공식 소스의 export 판정
  (https://github.com/DeusData/codebase-memory-mcp/blob/v0.10.8/internal/cbm/extract_defs.c#L1204-L1207),
  is_entry_point 설정
  (https://github.com/DeusData/codebase-memory-mcp/blob/v0.10.8/internal/cbm/extract_defs.c#L3768-L3780),
  아키텍처 조회
  (https://github.com/DeusData/codebase-memory-mcp/blob/v0.10.8/src/store/store.c#L5772-L5821)에서
  확인했습니다.

  이 프로젝트에서는 다음 11개가 해당됩니다.

  fetchTodos
  createTodo
  toggleTodo
  deleteTodo
  TodoForm
  submitTodo
  TodoList
  useTodoWorkflow
  TodoPage
  createApp
  asyncErrorBoundary

  특히 submitTodo는 직접 export된 함수가 아닙니다. 하지만 src/client/components/todo-
  form.tsx:8의 export function TodoForm(...) 내부에 있으므로, AST상 export_statement 조상을 가
  진 함수로 판정되어 포함됩니다.

  반대로 request, parseTodoId 같은 별도 내부 헬퍼는 export 구문 아래에 있지 않아 제외됩니다.

  따라서 이 결과는 다음처럼 이해하는 게 정확합니다.

  > 정적 분석기가 export 구문이나 main 이름을 기준으로 잡은 진입점 후보 11개

  실제 런타임 시작점, HTTP 엔드포인트 또는 사용자 요청 흐름의 시작점이 정확히 11개라는 뜻은 아
  닙니다.

  Learning Points

  - entry_points는 그래프 노드의 is_entry_point 속성을 집계한 결과입니다.
  - TypeScript에서는 주로 export AST 구조로 판정합니다.
  - 중첩 함수도 export 구문의 자손이면 포함될 수 있습니다.
  - 실제 런타임 진입점보다 넓은 정적 분석 휴리스틱입니다.

  Next Step

  실제 실행 흐름만 보려면 createApp, TodoPage를 시작으로 MCP의
  trace_path(direction="outbound")를 실행하는 것이 적절합니다.

```

### get_graph_schema 실행해봐 

```
• MCP의 get_graph_schema를 직접 실행했습니다.

  현재 그래프:

  - 노드: 173개
  - 엣지: 321개
  - 상태: ready
  - ADR: 없음

  주요 노드 타입:

  Section    28
  Variable   23
  File       22
  Module     22
  Function   20
  Method     17
  Folder     14
  Interface   9
  Class       5
  EnvVar      5
  Route       4
  Channel     2
  Branch      1
  Project     1

  주요 관계 타입:

  DEFINES              124
  USAGE                  59
  CALLS                  36
  IMPORTS                32
  CONTAINS_FILE          22
  DEFINES_METHOD         17
  CONTAINS_FOLDER        13
  CONFIGURES              5
  HANDLES                 4
  RAISES                  3
  LISTENS_ON              2
  CALL_REFERENCE          1
  HAS_BRANCH              1
  IMPLEMENTS              1
  SEMANTICALLY_RELATED    1

  이전 조회의 144개 노드·274개 엣지보다 증가했습니다. 감시 중인 인덱스가 소스 변경을 자동 반영
  한 것으로 보입니다.
```

### 그러면 codebase memory mcp를 적극 활용해서, '/codebase-memory-todo/ --- todo list 관리를 어떻게 하는지 end to end 로 찾아줘.

```

• Todo 관리는 다음 단일 흐름으로 구성됩니다.

  React 화면
  → useTodoWorkflow 상태/업무 흐름
  → Fetch API
  → Vite /api 프록시
  → Express Controller
  → TodoService
  → TodoRepository 인터페이스
  → InMemoryTodoRepository(Map)
  → JSON 응답
  → React 상태 갱신 및 재렌더링

  ## 전체 구성

   계층               역할                            핵심 파일
  ━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   화면               폼, 목록, 요약, 오류 표시       src/client/pages/todo-page.tsx:5
  ─────────────────  ──────────────────────────────  ─────────────────────────────────────────
   UI 컴포넌트        생성 폼, 토글·삭제 목록         src/client/components/todo-form.tsx:8,
                                                      src/client/components/todo-list.tsx:9
  ─────────────────  ──────────────────────────────  ─────────────────────────────────────────
   클라이언트 로직    상태, 로딩, CRUD 조정           src/client/hooks/use-todo-
                                                      workflow.ts:16
  ─────────────────  ──────────────────────────────  ─────────────────────────────────────────
   HTTP 클라이언트    Fetch 요청과 오류 변환          src/client/api/todos-api.ts:14
  ─────────────────  ──────────────────────────────  ─────────────────────────────────────────
   HTTP 서버          라우팅, 요청 파싱, 상태 코드    src/server/http/todo-controller.ts:12
  ─────────────────  ──────────────────────────────  ─────────────────────────────────────────
   비즈니스 로직      검증, 생성·수정·삭제 규칙       src/server/services/todo-service.ts:7
  ─────────────────  ──────────────────────────────  ─────────────────────────────────────────
   저장소             Map 기반 메모리 저장            src/server/repositories/todo-
                                                      repository.ts:3

  ## 애플리케이션 시작

  클라이언트는 src/client/main.tsx:1에서 TodoPage를 렌더링합니다.

  서버는 src/server/main.ts:1에서 기본 포트 4200으로 실행됩니다. createApp()이 다음 객체를 한
  번씩 생성해 연결합니다.

  InMemoryTodoRepository
  → TodoService(repository)
  → TodoController(service)
  → Express /api/todos

  이 조립 과정은 src/server/app.ts:7에 있습니다.

  개발 중 브라우저의 /api/* 요청은 vite.config.ts:4에 의해 http://localhost:4200으로
  전달됩니다.

  ## CRUD 흐름

   기능         HTTP                     서버 응답
  ━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━
   목록 조회    GET /api/todos           200 + Todo 배열
  ───────────  ───────────────────────  ───────────────────
   생성         POST /api/todos          201 + 생성된 Todo
  ───────────  ───────────────────────  ───────────────────
   완료 토글    PATCH /api/todos/:id     200 + 수정된 Todo
  ───────────  ───────────────────────  ───────────────────
   삭제         DELETE /api/todos/:id    204

  ### 1. 목록 조회

  TodoPage 렌더링
  → useTodoWorkflow의 useEffect
  → reloadTodos()
  → fetchTodos()
  → GET /api/todos
  → TodoController.listTodos()
  → TodoService.listTodos()
  → repository.findAll()
  → setTodos(응답)

  저장소는 ID 내림차순으로 정렬하므로 최근 생성 항목이 앞에 옵니다.

  ### 2. Todo 생성

  TodoForm submit
  → onAdd(title)
  → workflow.addTodo(title)
  → POST /api/todos { title }
  → controller.createTodo()
  → service.createTodo()
  → repository.save()
  → 생성 결과 반환
  → React 배열 맨 앞에 추가

  서비스의 생성 규칙:

  - 제목 앞뒤 공백 제거
  - 빈 제목 거부
  - 120자 초과 거부
  - ID는 1부터 증가
  - completed: false
  - createdAt: ISO 날짜 문자열

  생성 중에는 submitting=true가 되어 버튼이 비활성화됩니다.

  ### 3. 완료 상태 토글

  TodoList 체크박스
  → workflow.changeCompletion(todo)
  → PATCH /api/todos/:id
     { completed: !todo.completed }
  → controller.updateTodo()
  → parseTodoId()
  → service.updateTodo()
  → repository.findById()
  → repository.save(updated)
  → React 배열의 동일 ID 항목 교체

  서버는 먼저 Todo가 존재하는지 확인하고, 전달된 필드만 변경합니다.

  ### 4. 삭제

  TodoList Delete 버튼
  → workflow.removeTodo(id)
  → DELETE /api/todos/:id
  → controller.deleteTodo()
  → parseTodoId()
  → service.requireTodo()
  → repository.deleteById()
  → 204 No Content
  → React 배열에서 해당 ID 제거

  클라이언트의 공통 request() 함수는 204 응답을 별도로 처리해 JSON 파싱을 시도하지 않습니다.

  ## 상태와 오류 관리

  클라이언트 훅은 다음 상태를 가집니다.

  - todos
  - loading
  - submitting
  - error

  total, completed, remaining 요약은 서버에서 받지 않고 현재 todos 배열에서 useMemo로 계산합니
  다.

  서버 오류 처리:

  - 존재하지 않는 Todo: 404
  - 잘못된 ID·제목: 400
  - 응답 본문: { message }

  클라이언트는 실패 응답의 message를 읽어 TodoPage의 오류 배너에 표시합니다. Retry 버튼은 전체
  목록을 다시 가져옵니다.

  ## 저장 특성

  저장소는 데이터베이스가 아니라 프로세스 메모리의 Map<number, Todo>입니다.

  따라서:

  - 서버를 재시작하면 모든 Todo가 사라짐
  - 동시 서버 인스턴스끼리 데이터가 공유되지 않음
  - 별도의 영속성이나 트랜잭션이 없음
  - ID는 서버 프로세스가 시작될 때 다시 1부터 시작

  ## MCP 조사 결과와 한계

  확인된 그래프 결과:

  - TodoPage → useTodoWorkflow
  - useTodoWorkflow → fetch/create/toggle/deleteTodo
  - 네 API 함수 모두 request() 호출
  - main → createApp
  - createApp → Repository, Service, Controller
  - 라우트 4개 확인
  - 순환 CALLS 관계 없음

  다만 현재 그래프에는 HTTP_CALLS가 0개입니다. 따라서 클라이언트와 서버 연결은 그래프에서 직접
  증명된 호출 엣지가 아니라, 양쪽의 /api/todos 경로와 Vite 프록시 설정을 소스로 대조해 확인했
  습니다.

  또한 동일한 메서드 이름 때문에 일부 HANDLES 엣지가 Controller가 아닌 Service 메서드로 연결되
  어 있었습니다. controller → service → repository 관계도 호출 그래프가 완전히 잡지 못했지만,
  정확한 클래스 소스에서 직접 검증했습니다.

  검증 결과:

  - 인덱스 모드: full
  - 조사한 14개 파일: 기록된 커버리지 문제 없음
  - src/, tests/: 기록된 누락 없음
  - 타입체크: PASS
  - 단위 테스트: 3/3 PASS
  - 프로덕션 빌드: PASS
  - 소스 수정: 없음

  테스트는 tests/todo-service.test.ts:6에서 생성→완료→삭제, 빈 제목, 존재하지 않는 Todo를 검증
  합니다.

  Learning Points

  - useTodoWorkflow가 클라이언트 비즈니스 흐름의 중심입니다.
  - 핵심 서버 규칙은 TodoService에 있고 Controller는 HTTP 변환을 담당합니다.
  - 저장소 인터페이스 덕분에 메모리 저장소를 DB 구현으로 교체할 수 있습니다.
  - HTTP·React 콜백 관계는 일반 CALLS 그래프만으로 완전히 표현되지 않습니다.
  - 그래프 결과는 소스·커버리지·테스트와 함께 검증해야 합니다.

  Next Step

  실제로 동작을 확인하려면 저장소 루트에서 pnpm --filter @reason-ball/codebase-memory-todo
  dev를 실행하고 http://localhost:5174에서 생성·토글·삭제 흐름을 테스트하세요.
```