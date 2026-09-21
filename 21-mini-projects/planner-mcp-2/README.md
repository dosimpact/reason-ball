# Planner MCP 2

사람이 설계하고 AI가 구현·1차 검증한 뒤, 사람이 최종 확인하는 로컬 작업 공간입니다. 프로젝트·문서·템플릿·정형 체크리스트를 SQLite에 저장하고 UI, REST, MCP가 같은 업무 규칙을 사용합니다.

## 실행

Node.js 24 이상과 pnpm 10을 사용합니다. 저장소 루트에서 실행합니다.

```sh
pnpm install
pnpm --filter planner-mcp-2 dev
```

UI: `http://127.0.0.1:4000`, MCP Streamable HTTP: `http://127.0.0.1:4000/mcp`.
데이터는 패키지의 `.data/planner.sqlite`에 저장합니다. `PLANNER_DATA_DIR`로 디렉터리를 변경할 수 있습니다. 외부 접속은 `PLANNER_ALLOWED_ORIGINS`에 명시한 주소만 허용합니다. 현재 외부 주소는 `http://dodonet.iptime.org:14000`이며 별도 사용자 인증은 없습니다.

## 사용 흐름

1. 프로젝트를 만들면 설계·구현·검증 index와 단계 노드가 생성됩니다.
2. 기본 템플릿(view, api, e2e, implementation, overview) 또는 직접 만든 템플릿으로 문서를 생성합니다.
3. 연결된 AI가 MCP로 설계·체크리스트를 조회하고, 설계된 범위만 구현한 뒤 항목별 AI 결과와 결과 자식 문서를 갱신합니다.
4. 사람은 Storybook·Bruno·브라우저에서 확인하고 UI의 사람 확인란에 체크합니다.
5. 설계 변경 시 AI가 영향받은 항목만 reopen합니다. UI에서도 항목별 재검증을 요청할 수 있습니다.

Overview는 What·How와 검증 문서를 연결하는 트리이며 항목별 폼으로 편집합니다. 원본 템플릿이 변경되어도 기존 인스턴스는 유지됩니다. 문서 갱신은 revision을 확인하며, 다른 작업이 먼저 갱신했으면 입력을 보존하고 충돌을 알립니다.

## 검증

```sh
pnpm --filter planner-mcp-2 test
pnpm --filter planner-mcp-2 lint
pnpm --filter planner-mcp-2 typecheck
pnpm --filter planner-mcp-2 test:e2e
```

`test:e2e`는 생산 빌드·Storybook 빌드 → 임시 SQLite와 소유 서버 → Bruno HTTP → MCP SDK·Playwright·Storybook 브라우저 검증 순으로 실행합니다. 재시작 테스트는 별도 소유 서버를 재시작합니다. 종료 시 테스트 서버·임시 DB를 정리합니다. Chromium이 없으면 `pnpm --filter planner-mcp-2 exec playwright install chromium`을 실행합니다.

- HTTP만: `pnpm --filter planner-mcp-2 test:api`
- 컴포넌트 확인: `pnpm --filter planner-mcp-2 storybook` (6106)
- HTML 결과: `playwright-report/index.html`
- HTTP 결과: `e2e/bruno-api-tests/reports/results.json`
- [설계 문서 지도](docs/INDEX.md), [MCP·REST 계약](docs/stock/tech-shared/interfaces.md)

## 첫 구현의 범위

단일 로컬 서버, 단계별 기본 흐름, Markdown/Mermaid, Overview 트리, 체크리스트와 검증 문서에 집중합니다. AI 실행은 연결된 도구가 수행합니다. 재검증 결과 문서는 최신 내용으로 갱신하며 이전 실행의 버전 보관·다중 사용자 권한·자유로운 그래프 edge 편집은 포함하지 않습니다.

## CodeWeave core

`src/modules/codeweave/core`에 프레임워크 독립 파서·트리 표시 모델·검색·수정 API가 있습니다. Next.js와 MCP는 향후 이 모듈을 소비합니다. [설계 및 사용 계약](docs/stock/codeweave/INDEX.md)을 참고하세요.

```sh
pnpm --filter planner-mcp-2 test:codeweave
pnpm --filter planner-mcp-2 check:codeweave
```
