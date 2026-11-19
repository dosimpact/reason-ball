# OpenUI 통합 설계

## OPENUI-MIG-001 목표와 경계

기준 PoC는 `21-mini-projects/6-openui-poc/6-a-2-openui-langgraph-py-intelligent-ui`다. 메인 LangGraph가 업무 처리·도구 실행·근거 검증을 수행하고 최종 표현을 공통 OpenUI Lang 서브그래프에 위임한다. Dynamic·Fixed·Catalog 및 기존 SEC Intelligent UI는 같은 카탈로그와 출력 계층을 사용한다. 화면 경로는 `/open-ui/*`로 통일한다. 이전 UI 프로토콜의 runtime·adapter와 이전 URL 호환 경로는 제공하지 않는다.

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

`graph/primary_graphs/generative_ui/workflow.py`가 업무 그래프를 소유한다. 공통 `graph/subgraphs/openui_output/workflow.py::build_output_graph`는 완료된 question/answer/evidence를 받아 program/controls를 반환하며 업무 도구를 실행하지 않는다. Dynamic 분석과 기존 SEC 채팅의 최종 출력은 모델이 구성한다. Fixed 선택 영역은 고정 OpenUI 프로그램으로 생성한다. `BusinessAction`은 서버 소유 controls에만 제공한다.

카탈로그 파서가 모든 프로그램을 검사한다. 생성 프로그램 오류는 한 번 수정하고 재실패 시 오류로 종료한다. root는 첫 선언이어야 한다. 문법 검증은 모델 답변의 의미·수치 전체를 검증하는 기능이 아니다. SEC 인용문과 출처는 서버가 검증한 결과를 별도 영역에 표시한다.

`POST /api/generative-ui/{dynamic|fixed}` 입력은 `{thread_id, message?, action?: {name, revision, context}}`다. 클라이언트는 전체 state를 전송할 수 없다. 서버는 현재 revision, 허용 action, 필드, 선택한 항공편의 소속을 검사한다. 업무/출력 실패 시 이전 서버 상태를 보존한다. SSE는 RUN_STARTED, CUSTOM ui.activity, CUSTOM ui.output, RUN_FINISHED를 사용하며 실패는 RUN_ERROR다. 클라이언트는 종료 이벤트까지 확인한 결과만 표시한다.

세션은 mode/thread별 메모리 상태다. 1시간 미사용 세션을 정리하고 진행 중 새 세션을 포함해 최대 200개로 제한한다. 동시 실행 10개·대기 10개, 같은 thread의 중복 실행은 409, 용량 초과는 429다. 취소는 모델 작업과 lease를 해제한다. 새 대화는 새 thread를 만든다. 새로고침 복원·다중 worker 공유·계정 인증은 제공하지 않는 로컬 단일 사용자 기능이다. 성공 commit 직후 연결이 끊어진 경우 클라이언트가 결과를 받지 못할 수 있으며, 과거 revision action은 거절된다. 새 대화 또는 새 질문으로 재진입한다.

## OPENUI-MIG-003 보존한 화면과 action

| 화면 | 업무와 사용자 action |
| --- | --- |
| `/open-ui/dynamic` | 서버 가상 매출 데이터 집계, 모델의 표·차트·설명 구성, 지역 선택 후 재조회. 전체 USD 680,000/6개, 서울 USD 360,000/3개 |
| `/open-ui/fixed` | 가상 항공편 검색·선택, 기내식만/좌석만/둘 모두 선택, 한 번 확정. 실제 예약을 수행하지 않음 |
| `/open-ui/catalog` | 등록 컴포넌트·함수·action 검색, 예제 조작, OpenUI 코드 편집·적용·초기화, 테마·해시 탐색. 예제는 실제 업무를 실행하지 않음 |
| `/sec-chat` | 기존 대화·기업 확인·최신 10-K 준비·근거/추천 질문 유지. answer → after_answer → present 순서로 최종 UI 생성 |
| `/sec-api-agent` | 기존 AgentInterface와 SEC tools 유지. research → 공통 출력 서브그래프. `/research`의 원시 Markdown API는 유지 |

이전 결과의 선택 영역은 비활성화하고 최신 revision에서만 업무 action을 받는다. 일반 `ToAssistant`는 후속 질문을 보내고 OpenURL·클립보드 등 카탈로그 action은 공유 처리한다. SEC 조회·분석과 보고서 기능은 SEC API Agent 및 SEC Intelligent UI에서 제공한다. 경계는 [SEC 화면 범위](../us-corporate-filings/open-ui-system.md)를 따른다.

## 패키지 소유권

- [Host](1-fe-host/open-ui.md): `_pages/generative-ui`, 공유 `OutputView`, 카탈로그와 생성 명세, Next 프록시.
- [LangGraph](3-langgraph-fast/open-ui.md): `domains/generative_ui` 업무, `primary_graphs/generative_ui`, 공통 `subgraphs/openui_output`, `server/generative_ui`.
- 기존 SEC `domains/sec_chat/presentation.py::compose_ui`는 공통 출력 그래프 위임 진입점이다. 관리자 `/chat`은 `sec_deep_agent/presentation.py`에서 research와 출력을 그래프로 연결한다.
- `domains/tenk/open_ui_report*.py`는 원문 인용·보고서 계획을 담당하며 OpenUI 프로그램 생성은 공통 출력 서브그래프가 수행한다.

## 운영과 검증

기본 앱은 Host2983, BFF2980, FastAPI2981이다. 개발 채팅은 LangGraph dev2982를 사용한다. 공통 채팅·UI 생성 모델은 [CHAT-LLM-001](3-langgraph-fast/chat-llm-provider.md)의 `CHAT_LLM_PROVIDER`로 선택하고 기본값은 oauth-proxy다. 이전 OPENUI/SEC 전용 모델 환경변수가 공통 선택을 덮어쓰지 않는다. Host 프록시·BFF·validator 주소는 각 패키지의 서버 환경에만 둔다.

카탈로그 변경 후 `pnpm -C 1-fe-host sec-ui:generate`와 `openui:check`로 FE spec/prompt와 Python mirror를 동기화한다. 새 구성요소는 Library Explorer에 예시를 추가한다. 카탈로그·테스트 실제 명령은 Host package.json과 [Host 계약](1-fe-host/open-ui.md), Python 그래프·형식 repair는 [LangGraph 계약](3-langgraph-fast/open-ui.md)을 따른다.

현재 공유 composer는 LLM이 전체 program을 생성하며 `program_builder` 우회는 제공하지 않는다. technical_analysis_agent/technical_analysis_canvas_agent/talib_agent도 compact 결과와 표시 context를 이 경로에 전달한다. Canvas 서버 요소 ID 검증은 도메인 책임이다. FinancialChart의 실제 배열은 Query API로 조회한다. 금융 근거 검산 결과 등 서버가 표시 내용을 강제해야 하는 경로와 Fixed 업무 controls는 별도 계약을 유지한다.

## 현재 범위

- `/open-ui`, `/open-ui/dynamic`, `/open-ui/fixed`, `/open-ui/catalog`, `/open-ui/gallery`와 공통 Renderer를 사용한다.
- SEC 전용 데모 `/open-ui/sec`와 이전 UI 프로토콜의 호환 runtime·registry는 제공하지 않는다. SEC 기능은 [SEC 도메인](../us-corporate-filings/INDEX.md)에 있다.
- 업무 action 검증과 revision은 서버가, 일반 OpenUI interaction과 Query는 Host가 처리한다. 파서 통과는 원문·금액 의미 전체에 대한 보증이 아니다.
- 동시 실행·취소·상태 복구는 generative UI 메모리 세션과 SDK graph runtime에서 서로 다르며 각각의 패키지 문서에 명시한다.
