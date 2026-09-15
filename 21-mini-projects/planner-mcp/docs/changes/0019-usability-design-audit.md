# 사용성 개선과 최초 설계 최종 대조

날짜: 2026-09-15
상태: 로컬 사용성 개선 및 설계 대조 완료. 실계정 Figma 확인은 별도 SKIP.

## 1. 범위와 판정 기준

사용자 요청: 사용성을 개선하고 최초 설계와 비교해 누락을 확인한다. 원본은 [01 요구사항](../design/01-requirements.md)의 최초 REQ-001~027과 이후 사용자 요청으로 확정한 REQ-028~030, [10](../design/10-completion.md)·[11](../design/11-collaboration-ux.md)의 프로젝트 목록 및 협업 흐름이다. 00~09의 상세 계약도 관련 소스·테스트와 대조했다.

과거 0010의 PASS 표를 복사해 완료를 추정하지 않았다. 현재 저장소·카탈로그·MCP 등록·타입 렌더러·순수 트리 모듈·협업 화면을 읽고, 테스트의 실제 assertion과 실행 결과를 확인했다. 그래프는 2026-09-14 세대로 오래되었고 테스트가 제외되어 있어 현재 소스 확인을 병행했다. 그래프의 무결성 감사나 전 코드 경로 커버리지 100%를 주장하지 않는다.

범위 제외는 기존 계약 그대로다: 사용자 인증, 원격 팀 운영, 프로젝트/문서 삭제, 범용 첨부, 런타임 카탈로그 편집, 내부 LLM/코드 실행, 외부 파일과 서버의 무손실 동시 쓰기. 실계정 Figma 확인은 10의 지침대로 별도 검증 항목이다.

## 2. 최초 요구사항 대조

구조·기능 계약 Match Rate: **30 / 30 = 100%** (Matched 30, Partial 0, Missing 0). 아래 수치는 정의된 요구사항의 대응 여부이며 실제 Figma 계정 확인이나 모든 장애 상황의 보증을 뜻하지 않는다.

공통 근거 파일: [저장 테스트](../../tests/store.test.ts), [추가 저장 테스트](../../tests/completion-store.test.ts), [카탈로그 테스트](../../tests/catalog.test.ts), [Flow 테스트](../../tests/flow.test.ts), [기존 E2E](../../tests/e2e/workspace.spec.ts), [확장 E2E](../../tests/e2e/completion.spec.ts).

| 항목 | 상태 | 현재 구현과 확인한 근거 |
| --- | --- | --- |
| REQ-001 Next.js·TypeScript | Matched | package.json·src/app, 생산 빌드·typecheck |
| REQ-002 JSON 영속성 | Matched | PlannerStore.open/recover/transact, 저장 후 재시작·pending 저널 복구 assertion |
| REQ-003 SSE | Matched | api/events/route.ts·store.scan, MCP/외부 수정·손상·삭제·재연결 E2E |
| REQ-004 순수 로직·조합 분리 | Matched | Flow parser/traverse/edit와 compareJson의 IO 없는 모듈, 입력 불변성·순서·경계 단위 테스트 |
| REQ-005 FSD | Matched | app/server 조합, widgets 화면, features/flow-spec-syntax, entities/document, shared 경계; parser.ts는 UI를 export하지 않음 |
| REQ-006 AI 설계 작성 | Matched | mcp.ts의 카탈로그/검증/저장 도구와 SDK 클라이언트의 실제 타입별 생성. 앱 내부 AI 실행을 뜻하지 않음 |
| REQ-007 프로젝트 소속 | Matched | 프로젝트 간 인덱스·현재/역사 문서 조회 격리 assertion |
| REQ-008 카탈로그 강제 | Matched | validateDraft·draftSchema, 미등록 타입·누락 scope·타입 불일치 거부 |
| REQ-009 일곱 타입·확장 | Matched | typeIds·contentSchemas·catalog·렌더러 등록 구조, 일곱 예시·JSON Schema 검사 |
| REQ-010 시각화 | Matched | ContentView 및 FlowSpecViewer, 일곱 타입 E2E와 실제 Mermaid SVG 확인 |
| REQ-011 실제 문서 인덱스 | Matched | store.index, 빈 목록·일부 타입·동일 타입 복수 문서 assertion |
| REQ-012 MCP 조회 | Matched | list_projects/get_catalog/get_document_index, 실제 연결 도구 호출과 E2E SDK 조회 |
| REQ-013 MCP 수정 → UI | Matched | 열린 목록의 새 프로젝트 및 열린 Flow 문서 변경을 새로고침 없이 확인 |
| REQ-014 논리 경로 | Matched | 세 layer·중첩 step/note, serializeFlowSpec·DFS 순서·UI 계층 |
| REQ-015 파싱·접힘 | Matched | parseFlowSpec의 문법 진단·LF/CRLF, 접기/검색/키보드 E2E |
| REQ-016 JSON 탐색 | Matched | indexFlow.byId/parentById/locationById, 조상·접힌 표시·중복 ID·순환·깊이/크기 검증 |
| REQ-017 원본 입력 보존 | Matched | addSource 추가 보존·sourceIds 검증, 설계 수정 후 원문 유지 및 UI 원문 펼치기 |
| REQ-018 사실·가정·질문 | Matched | 공통 메타데이터 분리·근거 없는 사실 거부, 답변/차단/해결 상태 표시 |
| REQ-019 사용자 승인 | Matched | UI API만 상태 전이 노출, draft 저장·승인 이력 분리·미해결 차단 질문 승인 거부 |
| REQ-020 생성·초기 화면 | Matched | UI/MCP 생성, 빈 문서 안내와 중앙 프로젝트 목록 E2E |
| REQ-021 피드백 | Matched | 의견·questionId 답변 저장, MCP가 의견 조회, AI 반영 전 미해결 유지 E2E |
| REQ-022 구현 인계 | Matched | get_handoff의 승인 버전 조회와 별도 SDK 클라이언트, 선택 뒤 새 초안이 생겨도 고정 인계 |
| REQ-023 복수 문서·scope | Matched | 동일 타입·scope의 고유 ID 저장, 목록·상세 scope 배지 및 필터 E2E |
| REQ-024 공통 API 계약 | Matched | upstream/bff의 apiSpec·공통 렌더러, existing/change·기준 버전 비교 |
| REQ-025 Weblogging | Matched | trigger/condition/fields 스키마, 필드 설명 렌더링 E2E |
| REQ-026 Figma widget | Matched | widget별 다중 화면 참조·surface·validation·funnel, 스키마/렌더러 테스트 |
| REQ-027 Overview/Detail | Matched | 별도 타입·목적, 공통 트리·렌더러, 선택적 고정 Overview/노드 참조 |
| REQ-028 관계·비교 | Matched | 프로젝트/타입/버전/노드 검사, incoming/outgoing·재검토 안내·역사 읽기 전용 E2E |
| REQ-029 Flow 편집 | Matched | 순수 추가/변경/이동/삭제, 충돌·ID 재사용 거부·재시작 중복 방지·접힘 보존 |
| REQ-030 Figma 수집 | Matched | fetchFigma·importFigma·UI/MCP, 모의 파일/노드 응답의 버전·시각·원문 보존 및 오류/중복 검사 |

## 3. 누락 및 UX 보완 결과

| 발견 | 변경 전 | 현재 |
| --- | --- | --- |
| 프로젝트 목록 진입·복귀 | 중앙 목록 및 협업 진입 흐름 부족 | 목록 → 프로젝트 홈 → 검토함/문서/입력/인계, 전체 목록 복귀 |
| 첫 조회·실패 복구 | SSE ready 의존·요약 조회가 목록을 지연 | 초기 조회 독립, 요약 실패 격리, 읽기 timeout·수동 재시도 |
| 인계 선택 시점 | ID만 기억하고 나중에 현재 revision 사용 | 선택한 승인 revision 유지·변경 안내·선택 해제·역사 확인 |
| 근거 확인 동선 | 제목을 보고 입력 탭에서 다시 찾아야 함 | 사실/가정/질문의 근거 원문·시각·링크를 바로 펼쳐 확인 (Extra UX) |
| 쓰기 응답 유실 | UI 재제출 시 새 requestId 가능 | 같은 본문·ID·expectedRevision으로 명시적 재시도, 확인 전 추가 저장 제한 |
| 오래된 조회 응답 | 세대 검사 구현, 순서 역전의 직접 E2E 부족 | 과거 목록 응답을 지연시켰다가 SSE 이후 반환해 최신 목록 유지 검사 |
| API 근거 표기 | 07의 sources 표기가 API content 필드로 오해될 수 있음 | 03·06과 맞춰 공통 Document.sourceIds → Project.sources 관계 명시; 데이터 모델 변경 없음 |

초기 목록·협업 개선은 0014~0016, 선택·근거 개선은 [0017](0017-handoff-and-evidence-ux.md), 응답 유실은 [0018](0018-write-response-recovery.md)에 변경 이유를 보존한다. 사용자 인증이나 앱 내부 에이전트 실행을 추가하지 않았다.

## 4. 상세 계약 검증

| 계약 | 판정 | 근거 |
| --- | --- | --- |
| 03 카탈로그/실제 인덱스 분리 | PASS | 타입별 예시 검증·프로젝트 빈 인덱스·타입 강제 테스트 |
| 04~05 트리·파서·경계·접힘 | PASS | flow.test.ts·flow-edit.test.ts·Flow E2E |
| 06 입력·피드백·승인·고정 인계 | PASS | store.test.ts·협업 E2E·선택 뒤 초안 작성 E2E |
| 07 scope·타입별 모델 | PASS | catalog.test.ts·타입별 렌더링·API 비교 E2E |
| 08 충돌·내구성·부분 성공 | PASS | 직렬 쓰기 중 하나만 성공, 재시작/중간 저널 복구, 실패 문서가 성공 문서를 취소하지 않음 |
| 08 재시도·오류·SSE 복구 | PASS | client.test.ts·실제 저장 뒤 응답 유실·초기 실패·재연결·응답 순서 역전 E2E |
| 09 실행/데이터 격리 | PASS | package scripts·scripts/e2e.mjs의 소유 서버/임시 데이터·.gitignore |
| 10 관계·편집·수집 | PASS | completion-store/figma/compare/flow-edit 테스트 및 E2E |
| 11 협업 UX | PASS | 질문 답변 → AI 반영 → 사용자 승인 → 인계, 작업 지시 복사 가능 텍스트·오류 격리 |
| 실계정 Figma API | SKIP | 실제 계정 토큰·대상 파일을 사용하지 않음. 테스트 서버만 결정적 외부 API fixture 사용 |

## 5. 실행 결과와 E2E

E2E HTML은 [playwright-report/index.html](../../playwright-report/index.html)에 생성되며 Git 제외·재생성 대상이다.

| 확인 | 결과 |
| --- | --- |
| `pnpm --filter planner-mcp test` | PASS: 10개 파일·97개 테스트 |
| `pnpm --filter planner-mcp lint` | PASS |
| `pnpm --filter planner-mcp typecheck` | PASS |
| `pnpm --filter planner-mcp test:e2e` | PASS: 생산 빌드·19개 시나리오, 54.5초 |
| 실제 3100 서비스 브라우저 | PASS: 목록 → 프로젝트 홈 → 목록 복귀 → 새로고침, JavaScript 오류 없음 |
| 연결된 planner-mcp 도구 | PASS: list_projects 2개, get_catalog 7개 실제 응답 |
| README·docs 로컬 링크 | PASS: 34개 문서·190개 링크 대상 확인, 누락 없음 |

E2E 주소는 `127.0.0.1:64018`이며 전용 서버와 임시 데이터는 종료 시 정리했다. 실제 3100 확인은 기존 데이터를 읽기만 했으며 사용자 프로젝트를 수정하지 않았다. 개발 서비스는 유지한다.

| E2E 시나리오 | 도구 | 결과 |
| --- | --- | --- |
| 저장 응답 유실: 프로젝트·입력·의견 중복 없음 | Playwright Chromium + MCP SDK | PASS |
| 늦은 이전 응답이 최신 목록을 덮지 않음 | 동일 | PASS |
| 느린 협업 요약과 목록 독립 표시 | 동일 | PASS |
| 빈 프로젝트 시작 안내 | 동일 | PASS |
| SSE 실패에도 최초 조회·선택 | 동일 | PASS |
| 초기 API 오류 후 수동 복구 | 동일 | PASS |
| 요약 실패 후 문서 조회·재시도 | 동일 | PASS |
| 열린 화면에 MCP 생성 프로젝트 표시·목록 복귀 | 동일 | PASS |
| 질문 답변·AI 반영·승인·선택 시점 고정 인계 | 동일 | PASS |
| Flow 추가·이동·삭제와 MCP 일치 | 동일 | PASS |
| HTTP/MCP 공개 경계·프로토콜 오류 | 동일 | PASS |
| 문서/탭/SSE 접힘 상태·키보드 검색 | 동일 | PASS |
| Flow 변경·낡은 revision 충돌·역사 읽기 전용 | 동일 | PASS |
| Overview/Detail 관계·재검토 안내 | 동일 | PASS |
| API 고정 버전 비교·질문 해결 상태 | 동일 | PASS |
| Figma UI/MCP 수집·오류·중복 (외부 모의 API) | 동일 | PASS |
| MCP 작성·근거 원문·검토·별도 구현 에이전트 인계 | 동일 | PASS |
| 일곱 렌더러·scope·외부 변경/손상/삭제 | 동일 | PASS |
| 오프라인 재연결·모바일 | 동일 | PASS |

## 6. 도구·스킬과 한계

- apb-gap-analysis: Matched/Partial/Extra로 구분하고 원래 요구사항과 후속 확장을 분리했다.
- apb-validation-report: PGV 템플릿이 없어 저장소 변경 이력 형식으로 근거·판정·한계를 기록했다. PGV 승인/아카이브를 주장하지 않는다.
- apb-unit-test-write·apb-playwright-e2e: 기존 작업에서 정상·실패 회귀를 추가했다. 이번 최종 대조에서는 응답 순서 역전 E2E를 추가했다.
- codebase-memory: 구조 후보 및 coverage를 확인하고 오래되거나 제외된 범위는 현재 소스로 검증했다.
- Playwright MCP 도구가 제공되지 않아 CLI Chromium을 사용했다. 사용자 Chrome의 기존 탭이나 CDP를 검사했다는 뜻은 아니다.

실계정 Figma는 토큰을 서버에 설정하고 접근 가능한 파일/노드로 가져오기를 별도 확인해야 한다. 인증·원격 운영은 미완성 구현이 아니라 명시적 제외 범위다. 이번 검증은 로컬 기능·계약에 대한 것이며 성능/부하·보안 전수 감사·전원 장애 복구 보증은 아니다.

## 7. 결론

로컬 구현·사용성·요구사항 대조는 **PASS**다. 상세 계약 표는 PASS 9, FAIL 0, SKIP 1이며 실계정 Figma까지 포함한 운영 준비 판정은 **CONDITIONAL PASS**다. 10에서 정한 모의 외부 API 검증은 완료했지만 실계정 연결 성공을 주장하지 않는다. 이번 요청의 설계 대조와 확인된 누락 보완은 완료했고, 요구사항·개선 내역·테스트·README를 함께 연결했다.
