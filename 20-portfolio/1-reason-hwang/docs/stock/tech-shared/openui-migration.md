# OpenUI 통합 설계

## OPENUI-MIG-001 목표와 경계

기준 PoC는 `21-mini-projects/6-openui-poc/6-a-2-openui-langgraph-py-intelligent-ui`다. 메인 LangGraph가 업무 처리·도구 실행·근거 검증을 수행하고 최종 표현을 공통 OpenUI Lang 서브그래프에 위임한다. Dynamic·Fixed·Catalog·SEC 및 기존 SEC Intelligent UI는 같은 카탈로그와 출력 계층을 사용한다. CopilotKit runtime·React/Python 패키지 및 A2UI wire/adapter를 제거했다. `/a2ui/*` URL은 기존 링크 호환을 위해 유지하며 A2UI 프로토콜 사용을 뜻하지 않는다.

PoC의 컴포넌트·함수 카탈로그와 Lib Story 탐색·편집 코드를 이관했다. 호스트 FSD 통합, 업무 action, 서버 상태, SSE 프록시, 최종 출력 서브그래프는 이 저장소의 구현이다. 형제 PoC를 실행하거나 런타임 import하지 않는다. SEC 공시 저장·조회 API와 DB 스키마는 유지한다.

## OPENUI-MIG-002 최종 출력과 상태 계약

```text
Host 입력/BusinessAction
  → Next same-origin proxy
  → FastAPI 세션·revision·허용 action 검증
  → 메인 그래프 business
  → openui_output 서브그래프 (program + controls 검증)
  → commit → ui.output → RUN_FINISHED
  → 공유 OpenUI Renderer
```

`graph/primary_graphs/generative_ui/workflow.py`가 업무 그래프를 소유한다. 공통 `graph/subgraphs/openui_output/workflow.py::build_output_graph`는 완료된 question/answer/evidence를 받아 program/controls를 반환하며 업무 도구를 실행하지 않는다. Dynamic 분석·SEC 보고서는 모델이 자유롭게 구성한다. Fixed와 SEC 탐색·선택 영역은 고정 OpenUI 프로그램으로 생성하여 기존 기능을 보존한다. `BusinessAction`은 서버 소유 controls에만 제공한다.

카탈로그 파서가 모든 프로그램을 검사한다. 생성 프로그램 오류는 한 번 수정하고 재실패 시 오류로 종료한다. root는 첫 선언이어야 한다. 문법 검증은 모델 답변의 의미·수치 전체를 검증하는 기능이 아니다. SEC 인용문과 출처는 서버가 검증한 결과를 별도 영역에 표시한다.

`POST /api/generative-ui/{dynamic|fixed|sec}` 입력은 `{thread_id, message?, action?: {name, revision, context}}`다. 클라이언트는 전체 state를 전송할 수 없다. 서버는 현재 revision, 허용 action, 필드, 선택한 회사·공시·항공편의 소속을 검사한다. 업무/출력 실패 시 이전 서버 상태를 보존한다. SSE는 RUN_STARTED, CUSTOM ui.activity, CUSTOM ui.output, RUN_FINISHED를 사용하며 실패는 RUN_ERROR다. 클라이언트는 종료 이벤트까지 확인한 결과만 표시한다.

세션은 mode/thread별 메모리 상태다. 1시간 미사용 세션을 정리하고 진행 중 새 세션을 포함해 최대 200개로 제한한다. 동시 실행 10개·대기 10개, 같은 thread의 중복 실행은 409, 용량 초과는 429다. 취소는 모델 작업과 lease를 해제한다. 새 대화는 새 thread를 만든다. 새로고침 복원·다중 worker 공유·계정 인증은 제공하지 않는 로컬 단일 사용자 기능이다. 성공 commit 직후 연결이 끊어진 경우 클라이언트가 결과를 받지 못할 수 있으며, 과거 revision action은 거절된다. 새 대화 또는 새 질문으로 재진입한다.

## OPENUI-MIG-003 보존한 화면과 action

| 화면 | 업무와 사용자 action |
| --- | --- |
| `/a2ui/dynamic` | 서버 가상 매출 데이터 집계, 모델의 표·차트·설명 구성, 지역 선택 후 재조회. 전체 USD 680,000/6개, 서울 USD 360,000/3개 |
| `/a2ui/fixed` | 가상 항공편 검색·선택, 기내식만/좌석만/둘 모두 선택, 한 번 확정. 실제 예약을 수행하지 않음 |
| `/a2ui/catalog` | 등록 컴포넌트·함수·action 검색, 예제 조작, OpenUI 코드 편집·적용·초기화, 테마·해시 탐색. 예제는 실제 업무를 실행하지 않음 |
| `/a2ui/sec` | 회사 검색·페이지, 회사 선택, form/기간/저장 상태 필터·공시 페이지, 공시 선택, 요청별 보고서·정확한 원문 인용, 공시 재선택·회사 변경 |
| `/sec-chat` | 기존 대화·기업 확인·최신 10-K 준비·근거/추천 질문 유지. answer → after_answer → present 순서로 최종 UI 생성 |
| `/sec-api-agent` | 기존 AgentInterface와 SEC tools 유지. research → 공통 출력 서브그래프. `/research`의 원시 Markdown API는 유지 |

이전 결과의 선택 영역은 비활성화하고 최신 revision에서만 업무 action을 받는다. 일반 `ToAssistant`는 후속 질문을 보내고 OpenURL·클립보드 등 카탈로그 action은 공유 처리한다. SEC 보고서는 저장된 원문을 재조회해 생성하며 수집 요청으로 해석하지 않는다. 세부 업무 요구사항은 [SEC 설계](../us-corporate-filings/a2ui-system.md)가 소유한다.

## 패키지 소유권

- [Host](1-fe-host/a2ui.md): `_pages/generative-ui`, 공유 `OutputView`, 카탈로그와 생성 명세, Next 프록시.
- [LangGraph](3-langgraph-fast/a2ui.md): `domains/generative_ui` 업무, `primary_graphs/generative_ui`, 공통 `subgraphs/openui_output`, `server/generative_ui`.
- 기존 SEC `domains/sec_chat/presentation.py::compose_ui`는 공통 출력 그래프 위임 진입점이다. 관리자 `/chat`은 `sec_deep_agent/presentation.py`에서 research와 출력을 그래프로 연결한다.
- `domains/tenk/a2ui_report*.py`는 원문 인용·보고서 계획의 기존 도메인 모듈명이다. A2UI SDK/프로토콜 의존은 없다. 과거 파일명과 환경변수 fallback을 의존성으로 오인하지 않는다.

## 운영과 검증

기본 실행 포트는 Host 2800, BFF 2801, FastAPI 8000이며 각 패키지 `.env.example`을 따른다. FastAPI는 `OPENUI_MODEL_PROVIDER`, `OPENUI_MODEL`, `OPENUI_MODEL_BASE_URL`, `OPENUI_MODEL_API_KEY`, `OPENUI_SEC_BFF_URL`을 사용한다. 기존 A2UI_* 설정은 전환 호환 fallback이다. 기존 SEC 전용 모델 환경변수는 유지한다. Host는 `GENERATIVE_UI_API_URL` 또는 `SEC_CHAT_API_URL`, validator는 `SEC_CHAT_UI_VALIDATOR_URL`을 사용한다. 자격 증명은 서버에만 둔다.

카탈로그 수정 후 `pnpm -C 1-fe-host sec-ui:generate`를 실행한다. 실제 shared library에서 프런트 spec/prompt와 `graph/subgraphs/openui_output/generated/system-prompt.txt`를 함께 생성한다. 과거 A2UI manifest/hash 계약과 생성 자산은 폐기했다.

| 검증 | 명령 또는 도구 |
| --- | --- |
| 서버 업무·상태·실패·격리·취소 | `pnpm -C 3-langgraph-fast test` |
| HTTP/실모델 | `pnpm -C 3-langgraph-fast test:generative-ui:api` (전용 환경 8010/2810, BFF 2811) |
| SSE 클라이언트 | `pnpm -C 1-fe-host test:generative-ui` |
| 순수 View | `pnpm -C 1-fe-host test:generative-ui:views`, `test:sec-chat:views` |
| 실제 UI 회귀 | `OPENUI_LIVE_BASE_URL=http://127.0.0.1:2810 pnpm -C 1-fe-host test:generative-ui:live` |
| 사용자 흐름 확인 | Playwright MCP, 실제 OAuth 모델·저장 SEC 원문 |
| 정적 검사·빌드 | Host `lint`, `typecheck`, `build`; Python `build` |

실행 결과와 정리 상태는 [검증 기록](../../flow/2026-11-08-openui-runtime-validation.md)을 따른다. 과거 A2UI 검증 결과는 이번 전환의 검증을 대신하지 않는다. [초기 추출](../../flow/2026-11-08-openui-migration.md), [업무 전환](../../flow/2026-11-08-openui-business-actions.md), [화면 전환](../../flow/2026-11-08-openui-frontend-cutover.md)은 당시 기록이다.

## 기술적 분석 출력 확장

`build_output_graph`는 선택적 `program_builder`를 받아 검증된 계산 결과에서 만든 OpenUI 프로그램을 같은 validator로 검사할 수 있다. 생략 시 기존 LLM composer를 사용한다. 기술적 분석 차트는 이 경로를 사용하며 [도메인 시스템 설계](../technical-analysis/system-design.md)가 데이터·시그널 계약을 소유한다. [검증 기록](../../flow/2026-11-08-technical-analysis-validation.md).
