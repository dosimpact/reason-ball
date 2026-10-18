# OpenUI Dynamic Canvas 구현 및 검증

- 날짜: 2026-10-18
- 맥락: 사용자가 analytics-template UX 전체 계승, 실제 구현·검증, Playwright MCP 사용과 테스트 후 Chrome 종료를 지시했다.
- 범위: 요구사항 B~D 및 E UX-01~08. 원본 analytics-template와 tambo 서브모듈은 참고 자료로 보존한다.
- 기준: graph canvas-ux-analytics-reference, generation 2026-10-18T10:04:54Z, Verify. Canvas/chat/bridge source paths coverage metadata_match, docs는 excluded이므로 직접 읽음. 스코프 전체 UX 감사·브라우저 비교는 진행 중이다.
- 기반 확인: 작업 트리 clean, backend-langgraph/.env 존재 및 Git 제외 확인(값 미출력). Python 2037/Next.js 3045는 착수 시 비어 있음.
- 계획: 전용 설정 → 독립 OpenUI 위젯/데이터 연결 → DuckDB 제한 SQL 서비스 → LangGraph 요청·스트림 → 전체 Canvas UX → 저장·호환성 → 단위/실제 provider/Playwright MCP 검증 → 테스트 Chrome 종료.
- 검증 상태: 미실행. 기존 6-3 기록을 현 프로젝트 결과로 사용하지 않는다.

## 구현 결정과 검증 결과 (착수 기록 이후)

stock CANVAS-001~002 / DATA-001 / SAVE-001 / CANVAS-101~103 / DATA-101 / FRESH-101 / COMPAT-101을 현재 구현으로 갱신했다. README와 각 프로젝트 실행 문서도 2037/3045로 맞췄다. reference와 형제 프로젝트는 변경하지 않았다.

- 독립 OpenUI root를 Chat·Canvas에서 공통 렌더링한다. 임의 root 내부 추출 대신 카드별 Add/drag를 제공한다.
- 기존 AG-UI 경로를 유지하고 Canvas 전용 SSE를 추가했다. 분석 프로그램은 LangGraph의 구조화된 계획으로 구성하며 일반 UI는 모델 token을 직접 스트리밍한다.
- OpenUI Query 재실행 대신 앱 소유 snapshot + 등록 CanvasData 컴포넌트를 채택했다. 데이터 갱신 동안 동일 Renderer의 program·입력 상태를 보존했다.
- SQL과 metadata는 Python runtime, Canvas 문서·snapshot·입력값은 브라우저가 소유한다. queryVersion/resultSchemaVersion/renderer/catalog와 definitionRevision/dataVersion을 구분한다.
- 타임아웃은 subprocess 자체를 종료한다. read-only 연결의 TEMP 사실 테이블에 날짜/지역 필터를 먼저 적용한 뒤 월별 집계하여 부분 월을 정확히 계산한다.
- 실제 모델 호출 중 Canvas 수정이 Chat 채널로 잘못 분류된 경우, 상대 기간을 임의 날짜로 바꾼 경우, 카운터를 SQL 없는 차트로 계획한 경우를 발견했다. 서버의 기존 위젯 채널 고정·상대 기간 정규화·계획 검증 피드백으로 보완하고 재검증했다.
- 같은 제목의 두 위젯에서 모델이 임의 대상을 고르는 실패도 발견했다. 명시적 선택/ID/전체 지시가 없으면 서버가 선택을 요청하는 규칙을 추가했다.
- 브라우저 초기 fixture의 JSON key 순서가 Zod 정규화 후 달라진 것을 상태 변경으로 오판한 테스트와 Input label을 placeholder로 찾은 selector를 수정했다. 의미 값 비교와 실제 접근성 label로 검증한다.

### 실행한 검사

| 검사 | 결과 | 근거 |
|---|---|---|
| Python 단위/통합 | 53 tests PASS 후 중복 제목 회귀 1개 추가, 해당 suite 재검증 | pytest, 고정 날짜·임시 DuckDB, 실제 worker timeout/동시 접근 |
| Ruff | PASS | `uv run ruff check agent tests` |
| Python 패키지 | PASS | `uv build`, wheel/sdist에 두 프롬프트 포함 |
| 프런트 단위 | 335 PASS | 상태 명령·호환성·스트림 + 기존 함수/갤러리 계약 |
| 타입 검사 | PASS | 미지원 버전 테스트의 의도적 cast 수정 후 `npm run typecheck` |
| ESLint | 0 errors / 기존 5 warnings | 기존 map hook·img 경고 보존 |
| Next production build | PASS | 12 pages, Canvas·Chat·API 포함 |
| 기존 Chat 실제 provider | PASS | stock/search 도구, 후속 대화, 카운터, 잘못된 요청 400 |
| 실제 모델 Canvas | PASS | 두 차트 생성 → 선택한 하나의 KR/최근6개월 변경 → 설명 무변경 → Chat 표 → Add |
| 실제 모델 상호작용 | PASS | 제목/pie 변경 데이터 유지, Markdown 본문 보존, 탭 이름 변경, 카운터 클릭/Add/독립 상태/복원 |
| 전체 UX MCP suite | PASS | tabs/drag/resize/clear/delete/restore, race/hash/compat, 실패/취소, 실제 refresh/polling |

상세 MCP 기록은 `frontend/output/playwright/browser-live-1792320319332.json`, `browser-interaction-live-1792320243315.json`, `browser-ux-1792320324298.json`에 있다. 현재 shell에서 실제 @playwright/mcp 0.0.83을 MCP SDK client로 띄워 `browser_run_code_unsafe` 등 MCP 도구를 호출했다. 단순 Playwright 직접 실행을 MCP라고 표기하지 않았다.

UX suite의 refresh 구간에서 modelCalls는 12→12, queryRuns는 8→10이었다. 로컬 fixture 매출을 +1000 정정하고 실제 API로 변경값을 확인했다. program/input/다른 위젯을 유지했다. 60초 polling, hidden/snapshot 중지, 503 실패 후 이전 결과 유지와 재시도 복구도 확인했다. console의 503 한 건은 의도적으로 주입한 실패이며 해당 검사 외 브라우저 오류는 0이었다.

### 요구사항 및 SPIKE 대응

| 요구사항 / 실험 | 상태 | 검증 범위 |
|---|---|---|
| UX-01, CHAT-01~03 | PASS | 두 패널·대화 보관·진행·기존 Chat provider와 일반 OpenUI counter |
| UX-02, CANVAS-06, SPIKE-06 | PASS / 범위 제한 | 독립 root/전체 응답 Add·drag, 원본과 상태 분리. 임의 하위 root 추출은 지원하지 않음 |
| UX-03~04 | PASS | 탭 CRUD/정렬·확인창, 위젯 선택/정렬/이동/삭제/resize·복원, 390px 화면 가로 넘침 없음 |
| UX-05~06, PATCH-05~06, SPIKE-02 | PASS | pie/제목/Markdown, 기존 데이터 보존, 잘못된 OpenUI 완료 거절 |
| UX-07, SAVE-01~03, SPIKE-04 | PASS / 범위 제한 | program/입력/탭/배치/마지막 snapshot 복원, backend API 없이 조회 0. PWA 최초 오프라인 앱 로드는 제외 |
| UX-08, CANVAS-01~04, SPIKE-03 | PASS | 명시적 Canvas 직접 생성, 설명과 결과 채널 분리, 일반 질문 Canvas 무변경 |
| STREAM-01~05, SPIKE-05 | PASS | 독립 완료·부분 실패·실패 operation만 재시도, abort/늦은 완료 거절, 모델 await 취소 전파 단위 검사 |
| PATCH-01~04, SPIKE-01 | PASS | 대상 지역·기간 변경, 다른 위젯 유지, live refresh program/input 유지 |
| DATA-01~03, SPIKE-08 | PASS | 실제 집계와 독립 정답 비교, 금지 SQL, 부분 월, null/빈 결과, 500행, 5초 worker 제한, correction serialization |
| FRESH-01~04, SPIKE-09 | PASS | 모델 없는 수동/polling, snapshot, watermark/조회 시각, 늦은 응답/hash 거절, 오류 보존 |
| COMPAT-01, SPIKE-10 | PASS | v1→v2, 미지원 문서/renderer/catalog/result 계약, 원본 그대로 보존·표·백업 |
| CONTEXT-01~04, SPIKE-07 | 선택 대상·설명·없는 대상 단위 PASS, 중복 제목 모델 회귀 진행 | 마지막 추가 확인은 아래 후속 결과에 기록 |

### 알려진 경계

- 로컬 단일 사용자 PoC, 실제 운영 계정/권한/공유/보고서/CDC/push는 범위 밖이다.
- 분석 SQL은 허용된 테이블·함수와 단일 SELECT 계약만 지원한다. 모든 SQL dialect나 임의 JOIN을 지원하지 않는다.
- 모델 계획/출력에는 실패 가능성이 있다. 잘못된 출력은 기존 위젯 대신 적용하지 않는다. 일반 UI의 의미적 정답 전체를 보장하지 않는다.
- 브라우저 abort와 그래프 취소 전파를 확인했다. 외부 모델 서버 내부의 처리/과금 종료 시점은 검증하지 않았다.
- 복원 보장은 고정 카탈로그와 명시적 fixture에 한정한다. OpenUI Query/toolProvider 기반 임의 외부 도구 자동 복원은 지원하지 않는다.
- dependency 설치 시 기존 트리의 npm audit 경고가 있었다. 이번 기능 작업에서 무관한 의존성 자동 업그레이드를 하지 않았다. 공개 배포 전 별도 의존성 검토가 필요하다.

### 소스·자산 점검

backend graph generation `2026-10-18T10:42:27Z`(203 nodes/820 edges), frontend `2026-10-18T10:42:31Z`(731/1966)로 재색인했다. 생성/수정한 서비스·UI 경로 coverage는 metadata_match/no recorded issue였다. 이는 완전성 증명이 아니다. fast-pattern으로 제외된 `src/canvas/model.test.ts`는 직접 읽고 실행했으며 이후 작은 변경도 직접 소스로 확인했다. `.env`, runtime, output, node_modules, 생성 자산은 의도적으로 제외한다.

두 생성 프롬프트의 frontend/backend `cmp` 일치, `git diff --check`, reference 변경 없음 확인. 테스트 Chrome은 실패한 실행을 포함해 매번 finally에서 MCP `browser_close`로 종료했다.

## 최종 확인 (2026-10-18)

- Python 전체 **54 passed** (53.77s), Ruff PASS. 중복 제목 회귀를 포함한 최종 소스 기준이다.
- 프런트 **335 passed**, typecheck PASS, ESLint 0 errors/기존 5 warnings, production build PASS. 타입 검사에서 미지원 버전 fixture의 cast 오류를 수정한 후 재검사했다.
- `npm run test:browser:context` PASS: 같은 이름 두 개에서 확인 요청·무변경, 존재하지 않는 대상에서 새 위젯 생성 없음. `browser-context-live-1792320457205.json`이 성공 증거이며 이전 실패 로그는 보존한다. 위 표의 SPIKE-07 ‘진행’ 상태를 이 결과로 대체한다.
- MCP harness에 새 output 디렉터리 생성과 client/transport/로그 정리의 중첩 finally를 추가한 뒤 기본 navigate/snapshot/screenshot/console/close 재검증 PASS.
- 마지막 프로세스 확인: 격리 Playwright 테스트 Chrome **0**, headless Playwright MCP **0**. 앞선 프로세스 검색에서 shell 명령문 자체가 문자열에 걸린 오탐은 executable prefix로 구분해 재확인했다. 사용자의 기존 Chrome은 종료하지 않았다.
- 앱 확인을 위해 작업 소유 Python 2037 / Next.js 3045 서버는 실행 상태로 남겼다.
- 비밀 값 미출력, `.env`/runtime/output Git 제외, 두 프롬프트 cmp 일치, reference 변경 없음, git diff --check PASS.

최종 완료 범위는 요구사항 E의 UX-01~08과 B~D의 핵심 Canvas/실제 SQL/freshness/복원 경로다. 후속 범위와 임의 root 추출 제한은 위 ‘알려진 경계’를 유지한다.
