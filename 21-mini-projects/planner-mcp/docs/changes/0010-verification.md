# 구현 검증과 요구사항 감사

날짜: 2026-09-15
상태: 로컬 MVP 검증 완료. 운영 기본값은 사용자 정책 확정과 구분한다.

후속: [0012](0012-completion.md)에서 추가 기능과 확장된 검증을 기록한다. 본 문서는 당시 결과로 보존한다.

## 변경과 이유

- 0009 구현 후 실제 MCP 클라이언트와 생산 빌드 UI로 검증했다.
- 프로젝트 간 현재·역사 문서 격리, 과거 파일 복원 후 이력 덮어쓰기 거부, widget의 다중 화면 참조와 안전한 URL 검증을 회귀 테스트로 추가했다.
- 현재 설계 09에 검증 결과와 기본값의 상태를 연결한다. 문서 분류는 현재 설계와 변경 이력 두 종류를 유지한다.

## 실행 결과

| 명령 | 결과 |
| --- | --- |
| `pnpm test` | PASS: 4개 파일, 36개 테스트 |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test:e2e` | PASS: 생산 빌드 및 Chromium 3개 시나리오 |

E2E는 `http://127.0.0.1:53801`의 전용 서버와 임시 데이터로 실행했다. 실행 스크립트는 종료 시 서버와 임시 데이터를 정리한다.
재생성 가능한 HTML 결과: `playwright-report/index.html` (Git 제외).

## 요구사항별 근거

기준: [확정 요구사항](../design/01-requirements.md). 아래는 구현 파일과 실제 실행 테스트의 교차 확인이며 코드 커버리지 백분율을 의미하지 않는다.

| 요구사항 | 결과 | 근거 |
| --- | --- | --- |
| REQ-001 Next.js·TypeScript | PASS | package.json, src/app, 생산 빌드·타입 검사 |
| REQ-002 JSON 영속 저장 | PASS | store.ts, store.test.ts 재시작·저널 복구 |
| REQ-003 SSE 변경 반영 | PASS | api/events/route.ts, E2E 외부 변경·손상·삭제·재연결 |
| REQ-004 SLAP·순수함수 | PASS | 저장 조합과 atomicJson 경계 분리, Flow parse/validate/traverse 순수 모듈과 flow.test.ts |
| REQ-005 FSD | PASS | app → widgets → features/entities → shared 책임 분리, Flow feature는 저장·MCP·SSE를 소유하지 않음 |
| REQ-006 AI 문서 작성 | PASS | mcp.ts save_document, 실제 SDK 클라이언트의 타입별 저장 |
| REQ-007 프로젝트 단위 | PASS | store.test.ts 다른 프로젝트 인덱스·현재/역사 조회 격리 |
| REQ-008 카탈로그 강제 | PASS | catalog.test.ts 미등록·누락·잘못된 내용 거부 |
| REQ-009 일곱 타입·확장 구조 | PASS | typeIds, catalog, 타입별 스키마/예시, 일곱 타입 테스트. 새 타입은 코드 등록 방식 |
| REQ-010 시각화 | PASS | E2E 일곱 렌더러, Mermaid 실제 SVG |
| REQ-011 실제 문서 인덱스 | PASS | store.test.ts 빈 목록·생성 목록, E2E 빈 화면 |
| REQ-012 MCP 조회 | PASS | mcp.ts list_projects/get_catalog/get_document_index, SDK 연결 및 조회 |
| REQ-013 MCP → 실시간 UI | PASS | E2E 생성 후 목록, 갱신 후 열린 Flow 문서 반영 |
| REQ-014 논리 경로 | PASS | Flow parser/serializer/traverse, 순서·중첩 테스트 |
| REQ-015 파싱·접기 | PASS | flow.test.ts 문법 진단, E2E 접기·검색·업데이트 후 접힘 유지 |
| REQ-016 JSON 트리 탐색 | PASS | flow.test.ts DFS·ID/부모 인덱스·조상·입력 불변성·중복 ID/순환 거부 |
| REQ-017 입력 보존 | PASS | addSource 추가 저장, store.test.ts 및 E2E 인계에서 원문 유지 |
| REQ-018 사실·가정·질문 | PASS | 공통 스키마·UI 분리, 근거 없는 사실 저장 거부 테스트 |
| REQ-019 사용자 승인 | PASS | MCP 승인 도구 없음, E2E UI 상태 전이, 미해결 차단 질문 승인 거부 |
| REQ-020 프로젝트 생성 | PASS | MCP create_project 및 UI 생성, 빈 인덱스 테스트 |
| REQ-021 검토 피드백 | PASS | E2E UI 의견·검토, get_document에 comments 포함; 본문 편집 UI 없음 |
| REQ-022 구현 에이전트 인계 | PASS | 별도 SDK 클라이언트가 새 초안 작성 이후에도 고정 승인 버전 조회 |
| REQ-023 복수 문서·scope | PASS | 동일 타입·scope 복수 저장 테스트, E2E 배지·필터 |
| REQ-024 API 공통 계약 | PASS | apiSpec 공용 스키마·렌더러, 두 타입 기존/변경 테스트 |
| REQ-025 Weblogging | PASS | 이벤트 trigger/condition/fields 스키마, E2E 필드 설명 표시 |
| REQ-026 widget | PASS | catalog.test.ts 여러 화면·surface·검증·funnel, E2E widget 렌더러 |
| REQ-027 Overview·Detail | PASS | 별도 카탈로그 타입·공통 트리와 렌더러, 두 타입 저장·시각화 |

근거 파일: [단위 저장 테스트](../../tests/store.test.ts), [카탈로그 테스트](../../tests/catalog.test.ts), [Flow 테스트](../../tests/flow.test.ts), [HTTP 테스트](../../tests/http.test.ts), [브라우저 시나리오](../../tests/e2e/workspace.spec.ts).

## 추가 저장·통신 계약

- 동시 수정: 같은 revision의 두 요청 중 하나만 성공한다.
- 재시도: 동일 requestId는 재시작 후에도 원래 결과를 반환하고 다른 payload는 거부한다.
- 부분 성공: 한 문서의 검증 실패가 다른 문서의 성공을 취소하지 않는다.
- 손상: 마지막 정상 문서와 오류를 함께 표시하고 잘못된 현재 파일에 쓰기를 거부한다.
- 인계: 초안 인계 및 잘못된 승인 전이를 거부하고 과거 기록을 덮어쓰지 않는다.
- 연결: 생산 브라우저에서 연결 해제 중 변경 후 재연결 및 모바일 너비를 확인했다.

## 범위와 한계

- 개인 로컬 단일 Node 서버 기본값으로 검증했다. 팀 인증·권한, 악의적인 로컬 프로세스 방어, 원격 운영·성능 보장은 하지 않는다.
- UI 승인 분리는 업무 흐름의 분리이며 같은 컴퓨터에서 실행되는 다른 프로그램을 인증하는 보안 경계가 아니다.
- Figma 자동 수집과 외부 LLM 호출은 포함하지 않는다. 외부 설계 AI가 전달받은 자료를 가공해 MCP로 작성하는 구조다.
- 문서 관계 자동 영향 추적, 원격 협업, 서버와 외부 파일의 무손실 동시 쓰기는 미확정 확장 범위다.
- 내구성 테스트는 프로세스 재시작·중간 저널 복구를 다룬다. 운영체제 전원 장애나 손상된 백업의 복구를 보증하지 않는다.
- 전용 PGV 보고서·갭 분석 산출물은 없으므로 PGV 승인이나 별도 커버리지 수치를 주장하지 않는다.

## 스킬과 결론

- codebase-memory: 인덱스 목록 확인. Planner 미등록으로 직접 소스 확인을 사용했다.
- apb-unit-test-write: 경계·실패 조건을 포함한 회귀 테스트 보강.
- apb-playwright-e2e: 기존 실제 UI 시나리오를 생산 빌드에서 실행하고 결과 확인.
- apb-validation-report: PGV 선행 산출물이 없어 이력 문서로 대체하고 요구사항별 근거·결과·한계를 기록.

결론: 확정된 로컬 MVP 요구사항 27개를 위 근거로 확인했다. 실행 검사 실패는 없으며, 사용자 미확정 운영 정책을 승인된 요구사항으로 승격하지 않는다.
