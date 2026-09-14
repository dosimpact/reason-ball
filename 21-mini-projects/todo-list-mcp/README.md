# Todo Together · MCP

Next.js 하나에서 브라우저 Todo UI, HTTP API, Streamable HTTP MCP를 실행하는 학습용 앱입니다.

## 실행

저장소 루트에서:

```bash
pnpm install
pnpm --filter todo-list-mcp dev
```

브라우저: http://127.0.0.1:3000
MCP: http://127.0.0.1:3000/api/mcp

프로덕션 실행은 `pnpm --filter todo-list-mcp build` 후 `pnpm --filter todo-list-mcp start`입니다.
Node.js 22 이상을 권장합니다. pnpm workspace 안에서만 실행하며 포트 변경은 `dev --port 3002`처럼 전달합니다.

## Codex CLI 연결

### LAN에서 개발 화면 접속

```bash
TODO_ALLOWED_HOSTS=192.168.0.45:3002 pnpm --filter todo-list-mcp dev:lan --port 3002
```

`dev:lan`은 0.0.0.0에 바인딩합니다. 브라우저와 MCP는
`http://192.168.0.45:3002`를 사용하며, API는 명시한 Host와 동일 Origin만 허용합니다.
기본 `dev`는 계속 로컬 전용입니다.

사용하는 Codex 설정에 직접 추가하세요. 앱이나 테스트는 전역 설정을 변경하지 않습니다.

```toml
[mcp_servers.todo-list]
url = "http://127.0.0.1:3000/api/mcp"
```

codex mcp add todo-list --url http://127.0.0.1:3000/api/mcp

Next.js 서버를 먼저 실행하고 Codex를 시작합니다. `/mcp`로 연결을 확인한 뒤
“우유 사기 할 일을 추가해 줘”, “방금 항목을 완료 처리해 줘”, “할 일 목록을 보여 줘”를 요청합니다.
Tool을 사용하도록 요청해야 하며 Codex가 파일을 직접 편집하는 흐름은 지원하지 않습니다.

| MCP 기능          | 이름              | 입력 / 결과                                |
| ----------------- | ----------------- | ------------------------------------------ |
| Tool              | create_todo       | title → todo, revision                     |
| Tool              | get_todo_list     | 입력 없음 → version, todos, revision       |
| Tool              | get_todo_by_id    | id → todo, revision                        |
| Tool              | update_todo       | id + title 또는 completed → todo, revision |
| Tool              | delete_todo       | id → id, revision                          |
| Resource          | todo://list       | 목록 JSON                                  |
| Resource template | todo://items/{id} | 상세 JSON                                  |
| Prompt            | review_todos      | 인자 없음, 최신 목록을 포함한 요약 지시문  |

Resource의 `resources/subscribe` / `resources/unsubscribe`를 지원합니다.
수정 알림은 `notifications/resources/updated`이며 resource를 재조회해야 최신 내용을 얻습니다.
Prompt는 모델 실행이 아니라 메시지 템플릿 반환입니다. SDK 클라이언트나 MCP Inspector로
resource와 prompt를 각각 탐색할 수 있습니다.

Codex CLI 0.154.0에서 실제 `get_todo_list` 호출에 성공했습니다.
Resource 구독과 prompt 동작은 SDK 클라이언트로 검증했습니다.
**Codex가 변경 알림을 받아 자동 재조회하거나 새 응답을 시작하는 동작은 보장하지 않습니다.**
UI 변경 이후 Codex가 다시 조회하면 최신 상태가 반환됩니다.

## 구조와 SLAP

```text
브라우저 → app/api/todos ─┐
                         ├→ server/core → server/storage → JSON
Codex → app/api/mcp ──────┘                      │
                                       저장 성공 후 이벤트
                                                ├→ UI SSE
                                                └→ MCP 구독 알림
```

- `app/api/**/route.ts`: 요청 해석과 응답. 모두 Node.js 런타임입니다.
- `server/core`: Todo 서비스와 저장소 인터페이스, 불변 상태 변경 함수.
- `server/storage`: 직렬화된 읽기/쓰기와 임시 파일→rename 저장.
- `server/mcp`: tool/resource/prompt 등록과 MCP 세션.
- `server/events`, `runtime.ts`: 공유 이벤트와 인스턴스. 별도 서버 프로세스가 아닙니다.
- `shared`: 브라우저에서도 사용하는 타입과 Zod 검증.
- `components`, `hooks`: UI와 HTTP/SSE 연결.

한 함수에서는 같은 추상화 수준을 유지합니다. 상태 계산은 순수함수로 작성하고 시간·ID를 전달합니다.
파일 I/O와 이벤트 발행은 경계에 둡니다. 서비스는 JSON 구현 대신 저장소 인터페이스에 의존합니다.

## 저장과 동기화

기본 파일은 패키지의 `data/todos.json`이며 없으면 빈 목록으로 생성합니다.
`TODO_DATA_FILE` 환경변수로 다른 경로를 지정할 수 있습니다. 데이터는 Git에서 제외됩니다.

```ts
type Todo = {
  id: string; // UUID
  title: string; // trim 후 1~200자
  completed: boolean;
  createdAt: string; // ISO
  updatedAt: string;
};
// 저장: { version: 1, revision: number, todos: Todo[] }
```

전체 변경은 한 큐에서 최신 상태 읽기→계산→저장→알림 순서로 실행합니다.
같은 필드는 마지막 처리 값이 적용됩니다. 저장 실패 시 변경 알림이 발생하지 않습니다.
손상된 JSON은 보존하고 오류를 반환합니다. 임시 파일 교체는 부분 JSON 노출을 막지만,
전원 장애까지 보장하는 데이터베이스 트랜잭션은 아닙니다.

UI는 SSE를 받은 뒤 최신 목록을 재조회합니다. 재연결·온라인 복귀 시에도 다시 조회하며
오래된 revision의 응답을 적용하지 않습니다. 변경 이력 재생은 제공하지 않습니다.

**단일 로컬 프로세스 전용**입니다. 같은 파일을 공유하는 서버를 여러 개 실행하거나 실행 중
JSON을 직접 수정하지 마세요. 서버리스/Edge/다중 인스턴스 배포는 지원하지 않습니다.
서버는 127.0.0.1에 바인딩하며 로컬 Host와 동일 Origin을 검사합니다.
인증 없는 로컬 학습용이므로 외부 공개 배포는 범위 밖입니다.

## HTTP API

| 요청                     | 결과                             |
| ------------------------ | -------------------------------- |
| GET /api/todos           | 목록 + revision                  |
| POST /api/todos          | 생성 (201)                       |
| GET /api/todos/{id}      | 상세 + revision                  |
| PATCH /api/todos/{id}    | 제목/완료 수정                   |
| DELETE /api/todos/{id}   | 삭제 ID + revision               |
| GET /api/events          | SSE ready + 변경 알림            |
| POST/GET/DELETE /api/mcp | MCP 초기화·요청·스트림·세션 종료 |

오류 상태: 입력 400, 없는 ID 404, 저장 오류 500, 허용하지 않는 Host/Origin 403.
조회는 캐시하지 않습니다.

## 검증과 정리

```bash
pnpm --filter todo-list-mcp test
pnpm --filter todo-list-mcp typecheck
pnpm --filter todo-list-mcp lint
pnpm --filter todo-list-mcp build
pnpm --filter todo-list-mcp exec playwright install chromium
pnpm --filter todo-list-mcp test:e2e
# 선택: 기존 Codex 로그인과 모델 호출을 사용하는 실제 연결 테스트
pnpm --filter todo-list-mcp test:codex
```

- Vitest: 정규화·불변성·없는 ID·파일 복구·동시 저장·손상 파일·저장 실패 검증.
- Playwright: 프로덕션 빌드 후 Chromium **headless**, 1 worker, 전용 포트 3137.
- E2E에는 HTTP/MCP 실제 통신, resource 구독, prompt, UI CRUD, 양방향 데이터 공유,
  두 브라우저 동기화, 오프라인 복구, 입력·Origin 오류를 포함합니다.
- 테스트 서버는 `webServer`로 실행하며 `reuseExistingServer: false`입니다.
- 임시 디렉터리의 JSON만 사용하고 실제 Todo 파일은 건드리지 않습니다.
- MCP 세션은 DELETE 후 close, 브라우저는 fixture/context 종료로 정리합니다.
- 성공·실패 시 서버를 종료하고 포트를 확인한 뒤 임시 데이터를 제거합니다.
- SIGINT/SIGTERM에는 생성한 프로세스 그룹만 종료합니다.
  SIGKILL/전원 종료로 정리 코드가 실행되지 못하는 경우는 보장할 수 없습니다.
- HTML 보고서: `playwright-report/index.html`. 실패 시 trace와 screenshot을 보관합니다.
- Codex smoke는 별도 포트 3139, 임시 데이터, 일회성 CLI 설정을 사용하며 60초 제한이 있습니다.
  인증/모델 접근이 필요하므로 일반 자동 테스트에는 포함하지 않습니다.

구현 시 확인: Vitest 5개, headless E2E 4개, Codex MCP smoke 통과.
테스트 실패 경로에서도 3137 포트 해제와 임시 데이터 정리를 확인했습니다.

## 공식 참고 자료

- [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Codex MCP 설정](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

호환성을 위해 유지보수 중인 MCP SDK 1.x를 고정 사용합니다.


```
  codex mcp remove todo-list
  codex mcp add todo-list --url http://127.0.0.1:3002/api/mcp
  codex mcp list
```
