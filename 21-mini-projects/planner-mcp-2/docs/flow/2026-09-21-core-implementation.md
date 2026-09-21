# 핵심 구현 진행 기록

- 날짜: 2026-09-21
- 요청: 원본 요구사항을 수정하지 않고 5개 도메인의 핵심 기능 구현 및 실제 E2E 검증.
- 원본 SHA-256: `c5c100cb416e76695156f94d1d4146d119e6f7c506c5736c41d535e31a0eee0d`
- 범위: SQLite 저장, 프로젝트·단계 노드, 템플릿·인스턴스 문서, 정형 체크리스트, AI 결과 자식 문서, 사람 확인, 선택적 reopen, MCP/REST/UI 연결.
- 단순화: 단일 로컬 서버, 공통 문서 편집기, 기본 템플릿과 사용자 템플릿. 자동 AI 실행·배포·인증은 제공하지 않음.
- 검증 계획: Vitest 도메인·저장 회귀, Bruno 실제 HTTP, MCP SDK 연결, Playwright 브라우저, Storybook 뷰.
- 상태: 핵심 구현 및 아래 검증 완료. 원본 요구사항은 변경하지 않음.

## 구현 결과

- 5개 도메인을 UI·REST·MCP 22개 도구로 연결. Node.js 24 SQLite 영속 저장.
- 공용부와 체크리스트는 Markdown과 분리된 정형 데이터. 사람 확인은 UI/REST 전용.
- 템플릿 인스턴스 보존, revision 충돌, 선택적 reopen, 결과 자식 문서 재사용.
- Overview 항목별 편집 폼과 트리, 검증 문서 연결, Markdown/Mermaid 미리보기.
- 설계·구현·검증 노드, 프로젝트 및 문서 CRUD. 검증 index에서 동일 설계-검증 문서 조회.
- stock의 비즈니스·시스템 설계, 도메인 지도, 계약, 실행 기준 동기화. AGENTS.md의 패키지 명령·원본 보호 규칙 갱신.
- pnpm workspace 사용을 위해 공유 루트 pnpm-lock.yaml 갱신. 작업 전부터 존재하는 다른 프로젝트 파일은 편집하지 않음.

## 실행 증거

| 검증 | 명령/증거 | 결과 |
| --- | --- | --- |
| 순수 규칙·저장 회귀 | pnpm --filter planner-mcp-2 test | 4/4 PASS |
| 정적 검사 | pnpm --filter planner-mcp-2 lint | PASS, 경고 없음 |
| 타입 검사 | pnpm --filter planner-mcp-2 typecheck | PASS |
| 생산 빌드 | test:e2e 내부 pnpm build | PASS |
| Storybook 빌드 | test:e2e 내부 pnpm build-storybook | PASS |
| 실제 HTTP | Bruno, e2e/bruno-api-tests/reports/results.json | 20 요청·20 테스트·20 assertion PASS |
| UI·MCP·Storybook·재시작 | pnpm --filter planner-mcp-2 test:e2e | 10/10 PASS, 18.9초 |
| 요구사항 원본 | SHA-256 시작/종료 비교 | 변경 없음 |
| 문서 링크 | docs 내 상대 링크 대상 존재 확인 | PASS |

브라우저 보고서: `playwright-report/index.html`. 화면 증거: `test-results/collaboration.png`, `test-results/storybook-mermaid.png`. 최종 통합 실행 로그: `/tmp/planner2-final-e2e.log` (임시 파일). 보고서·스크린샷은 생성 산출물이므로 gitignore 대상.

## 시나리오 대조

- E2E-01: UI 프로젝트 생성·노드 선택·문서 편집/삭제 후 재생성·프로젝트 삭제.
- E2E-02 / REQ-008: UI 템플릿 변경 이후 기존 인스턴스 유지, 원본 템플릿 삭제 이후 재시작해도 문서 보존.
- E2E-03 / REQ-005·009: 실제 MCP SDK 호출로 체크리스트 추가·AI 결과 갱신, SSE로 브라우저 반영, 사람 확인 구분.
- E2E-04 / REQ-006: 두 항목 중 영향 항목만 pending·미확인으로 초기화, 다른 항목의 완료 보존.
- E2E-05 / REQ-007: 반복 검증 시 동일 자식 문서 ID 유지, 부모 카탈로그에 결과 문서 한 개.
- E2E-06: 오래된 revision·사람 확인 위조·타 프로젝트 연결·잘못된 항목 ID·외부 Origin·잘못된 JSON 거부.
- E2E-07 / REQ-001~003: Overview 트리 What·How·검증 문서 연결 및 UI 편집, Markdown/Mermaid. 실제 서버 재시작 후 SQLite 보존. MCP 외부 삭제 시 UI 복구.
- REQ-004: MCP 초기 안내·get_workflow_rules에 설계 범위 내 구현과 검증 절차 제공. 이 앱에서 AI를 자동 실행하지 않음.
- VIEW-01: Storybook 빈 체크리스트, 혼합 AI 결과·사람 확인, Overview, Mermaid를 Chromium으로 확인.

## 발견 및 수정

- Next.js 내부 URL과 실제 Host 차이로 UI 쓰기 요청이 403을 반환하던 문제 수정. 동일 출처 허용·외부 출처 거부 회귀 추가.
- 비동기 체크박스는 서버 반영 후 상태를 확인하도록 실제 클릭과 최종 상태 assertion을 분리.
- Next route announcer와 중복 텍스트를 구분하도록 실제 UI 기반 locator 수정.
- 기본 템플릿 삭제 후 서버 재시작 시 다시 생성되는 문제를 일회 초기화 표식으로 수정.
- SSE로 갱신될 때 미저장 입력 유지, 충돌 시 최신 문서 덮어쓰기 거부.
- MCP 삭제와 UI 삭제 후 선택 상태·카탈로그 복구 및 후속 생성 검증.

## 도구와 검증 한계

- codebase-memory 그래프 도구가 제공되지 않아 파일·설정 직접 조회를 사용함.
- browser 스킬의 연결을 실제 시도했으나 `No browser is available` 응답. 브라우저 MCP 탐색은 수행할 수 없었고, 대체로 Playwright Chromium 실제 탐색·스크린샷을 먼저 확인한 뒤 E2E를 작성함. MCP 프로토콜 자체는 SDK로 실제 서버에 연결해 검증함.
- apb-bruno-api-tests, apb-playwright-e2e 스킬 적용. Storybook의 use-client 번들 안내·큰 청크 경고는 빌드 비실패 안내이며 실제 뷰 렌더링은 통과함.
- 로컬 단일 사용자 기본값. AI 검증이 passed일 때만 사람 확인을 허용. 인증·자유 edge 편집·과거 검증 실행 버전 보관은 첫 구현 범위에 포함하지 않음.
- 테스트 전용 서버·임시 SQLite만 사용하고 정리함. 다른 개발 서버는 재사용하거나 종료하지 않음.
