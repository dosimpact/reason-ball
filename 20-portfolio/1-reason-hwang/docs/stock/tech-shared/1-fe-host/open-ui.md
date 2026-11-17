# Generative UI Host

화면 진입점은 `/open-ui/*`이며 구현은 OpenUI Lang이다. 공통 계약은 [OpenUI 통합 설계](../openui-migration.md)를 따른다.

- 루트 `app/open-ui`는 FSD `_pages/generative-ui`의 화면을 export한다. `Demo.tsx`가 thread, 요청 취소, 이전 결과, 최신 action revision과 새 대화를 소유하고, 공통 `AgentConversation`에 대화 표시와 입력을 위임한다.
- `api/stream.ts`는 AG-UI CUSTOM ui.output을 읽고 현재 카탈로그로 검증하며 RUN_FINISHED 없는 연결 종료를 실패로 처리한다.
- `shared/ui/intelligent-ui/OutputView.tsx`가 OpenUI Renderer, BusinessAction, ToAssistant, OpenURL과 라이브러리 action을 처리한다. SEC Chat의 AnswerView도 이 컴포넌트를 사용한다. SEC 관리자 채팅은 공통 AgentChatFrame에 같은 library를 전달한다.
- `_app/api/generative-ui/[mode]/route.ts`가 same-origin 요청과 `dynamic`/`fixed` 모드를 검사하고 FastAPI로 스트리밍 중계한다. 브라우저 취소를 upstream에 전달한다. API 키와 모델 설정은 전달하지 않는다.
- `_pages/generative-ui/ui/catalog`은 기준 PoC Lib Story를 이관한 컴포넌트·함수·action 탐색기다. 검색·코드 편집·초기화·반응형 상태를 지원한다. 업무 action 예제는 서버 상태를 변경하지 않는다.
- `/open-ui/gallery`는 원본 PoC 갤러리의 구성·데모 도구·컴포넌트 예제를 한 화면에 표시한다. 공유 OpenUI 라이브러리와 렌더러를 사용하며 각 예제의 원본 코드를 펼쳐 볼 수 있다. 45개 예제와 데모 도구는 로컬 예제 데이터로 동작한다. 이미지 검색·지도 경로는 Host의 `/api/wiki`, `/api/image-search`, `/api/street-route`를 통해 고정된 Wikimedia·OSRM 서비스에 접근하므로 네트워크가 필요하다.
- `sec-ui:generate`가 공유 library에서 프롬프트·명세·Python 자산을 동기화한다. 이전 UI 프로토콜의 registry/schema/manifest는 사용하지 않는다.

검증은 `test:generative-ui`, `test:generative-ui:views`, `test:generative-ui:live`, 기존 `test:sec-chat:views`를 사용한다. live 테스트는 OPENUI_LIVE_BASE_URL의 소유한 서버를 사용하며 서버를 자동 시작하지 않는다. 서버/브라우저 정리까지 [검증 원칙](../../../validation/INDEX.md)을 적용한다.

## OPENUI-AGENT-001: 공통 에이전트 인터페이스

`shared/ui/agent-conversation/`은 `@openuidev/react-ui`의 `AgentInterface`를 사용하는 공통 채팅 UI다. `/langgraph-dev-chat`, `/sec-chat`, `/open-ui/dynamic`, `/open-ui/fixed`에서 표준 Composer·메시지 목록·헤더를 사용한다. `/sec-api-agent`는 `fetchLLM`·`agUIAdapter` 전송을 공통 `AgentChatFrame`에 연결한다. 카탈로그와 대화가 아닌 화면은 전환 대상이 아니다.

`ChatLLM.send`는 기존 화면 controller의 전송 함수를 호출하고, 표준 중단 신호는 해당 controller의 AbortController로 연결한다. 기존 SDK/SSE 파서가 전송을 소비하므로 공통 adapter의 parser는 추가 이벤트를 만들지 않는다. `SyncMessages`는 domain controller가 관리하는 메시지를 OpenUI thread에 반영한다. OpenUI 내부 사이드바는 숨기고 호스트 내비게이션을 유지한다. Host 테마를 공유하며 첫 client mount 후 렌더링한다.

AssistantMessage 확장 렌더러는 화면별 검증 결과를 표시한다. SEC의 근거·추천 질문·실행 기록, 기술적 분석의 OpenUI 차트, 데모의 최신 revision action 제한은 각 domain controller와 renderer가 소유한다. 공통 UI 도입이 전송 형식이나 서버의 상태 소유권을 변경하지 않는다. 기존 화면의 메모리 보관·만료 정책도 유지한다.

변경과 검증은 [이관 기록](../../../flow/2026-11-14-agent-interface-migration.md)을 따른다.

화면 추천·선택 action처럼 SDK 밖에서 시작한 실행은 `busy`로 Composer 전송을 비활성화하고 별도 중단 버튼을 제공한다. SDK에서 시작한 실행은 표준 Cancel을 사용한다. 새 대화는 작성 중 입력도 초기화하며 실행 중에는 비활성화한다.


## OPENUI-CHAT-DS-001: 공통 채팅 디자인 시스템

`shared/ui/agent-conversation`은 모든 채팅이 공유하는 표현 계층이다. `/sec-api-agent`, `/sec-chat`, `/langgraph-dev-chat`, `/open-ui/{dynamic,fixed}`는 동일한 프레임·토큰·반응형 배치·Welcome·메시지 목록·Composer·헤더 액션을 사용한다. 페이지별 CSS로 프레임이나 입력창을 다시 정의하지 않는다. 카탈로그와 비채팅 화면은 이 계약의 대상이 아니다.

- `AgentChatFrame`: OpenUI `AgentInterface`를 소유하는 공통 프레임. native `ChatLLM`, 선택적 `storage`, `componentLibrary`, `onAction`을 받는다. SEC API Agent는 기존 AG-UI adapter와 메모리 대화 보관을 이 프레임에 연결한다.
- `AgentConversation`: 기존 domain controller의 메시지·전송·AbortController를 공통 프레임에 연결하는 adapter. SEC Intelligent UI, 일반 Chat, 기술적 분석, Generative UI는 서버 계약을 바꾸지 않고 이 adapter를 사용한다.
- 표현 입력: `title`, `description`, `welcomeTitle`, `starters`, `placeholder`. 헤더의 새 대화·중단·선택적 대화 기록은 공통 액션이다. 새 대화는 SDK 상태와 입력 초안을 함께 초기화한다.
- 확장 슬롯: `toolbar`는 그래프 선택·기업 확인 등 화면 컨트롤, `status`는 진행·오류 안내, `footer`는 데이터 범위·출처 정책·선택 공시 메타데이터를 제공한다. `children`은 provider 내부에서 실행되는 저장·동기화 helper용이다.
- `ChatNotice`: info/error/status 표현을 공유하며 error는 alert, status는 status 역할로 전달한다.
- `ConversationText`: 일반 assistant 본문도 공유 OpenUI `Markdown` 카탈로그를 사용한다. 문자열을 JSON으로 이스케이프하고 DSL로 감싸며 원시 Markdown 기호를 별도 plain paragraph에 출력하지 않는다. 차트·근거·폼은 기존 renderer 확장으로 유지한다.
- `ChatPageLayout`: 추가 페이지 제목·설명·도구 모음이 필요한 경우의 공통 외부 레이아웃이다. 업무 컴포넌트는 대화 프레임 CSS를 소유하지 않는다.
- 디자인 CSS: 공통 `agent-conversation.css`가 화면 폭·높이·간격·테마·모바일·입력 영역과 헤더 액션을 관리한다. 각 페이지에는 근거·타임라인·기업 선택 등 도메인 요소의 CSS만 남긴다.

컨트롤러별 상태 소유권은 유지한다. 생성 UI의 최신 revision 제한, SEC의 근거·추천 질문·기업 확인·공시 준비, 기술적 분석의 검증된 차트, 관리자 채팅의 도구 타임라인과 대화 기록은 공통 프레임의 확장이다. 외부 action 실행 중 busy guard와 중단 연결도 공통 계층을 따른다.

[변경 및 검증 기록](../../../flow/2026-11-14-shared-chat-design-system.md)


## HOST-HEADER-001: 앱 헤더와 전체 높이

Host RootLayout은 공통 상단 헤더를 표시하지 않는다. AgentChatFrame의 제목·도구 모음·대화 액션이 채팅 화면의 헤더이며, 다른 앱은 필요한 헤더를 각 페이지에서 제공한다. Root 콘텐츠는 `min-h-svh`, 공통 채팅 프레임은 `100svh`를 사용한다. 이전 Host `h-14` 헤더를 위한 높이 차감이나 중복 여백을 추가하지 않는다.

호스트 테마 토글과 데스크톱 사이드바 접기 버튼은 사이드바 footer에 있다. 모바일은 Host 내비게이션 위젯의 왼쪽 아래 고정 버튼으로 사이드바를 연다. 이 내비게이션 버튼은 페이지별 채팅 헤더가 소유하지 않으며 모든 앱에서 유지된다. 테마 상태는 기존 HostThemeProvider를 공유한다.

[Host 레이아웃 계약](2-frontend-side-architecture.md#host-header-001-host-공통-헤더-제거) · [변경 및 검증](../../../flow/2026-11-14-host-header-removal.md)

## OPENUI-SEC-REMOVE-001: SEC 화면 범위

Generative UI 진입 화면은 매출 분석·항공편 선택·카탈로그를 제공한다.
SEC 전용 데모 경로와 메뉴는 제거했으며 회사·공시 업무는 `/sec-api-agent`와 `/sec-chat`에서 제공한다.
SEC 채팅이 공유하는 renderer·카탈로그·채팅 프레임은 유지한다.

## TA-QUERY-001: 금융 Query provider

`OutputView`의 OpenUI `Renderer.toolProvider`는 `technical_analysis_chart`만 연결한다. 허용된 ticker/interval/count/indicators/기간 인자를 같은 origin의 기존 `/api/langgraph/technical-analysis/chart`로 GET하고 Zod 계약을 검사한다. 임의 URL 또는 모델 도구 실행을 허용하지 않는다. `Query`는 OpenUI SDK builtin이며 기존 parser validator가 생성된 프로그램을 검사한다. `sec-ui:generate`가 FinancialChart schema와 Query 사용 지침을 Python 프롬프트까지 동기화한다.

`FinancialChart`는 최소 snapshot prop 하나를 받으며 하나의 bars 배열로 Lightweight Charts 캔들·거래량·SMA·RSI·MACD pane을 표시한다. metadata·오류·준비 구간 경고·TradingView attribution을 함께 표시한다. 값이 null이어도 선택한 지표 pane을 유지한다. 크기는 컨테이너에 반응하고 테마는 Host class/data-theme를 따른다.

`/langgraph-dev-chat`의 기존 `technical_analysis_agent`는 본문과 인라인 차트를 유지하고 최신 완료 출력만 활성화한다. 별도 `technical_analysis_canvas_agent`는 선택되어 펼쳐진 Canvas 탭의 검증 완료 출력에만 `active`를 전달한다. 해당 프로그램의 `$chart_refresh_seconds` 기본0을 사용자가 opt-in할 때30으로 전환한다. 선택되지 않은 탭과 접히거나 닫힌 Canvas는 polling을 멈춘다. Query key별 캐시가 설정 변경 중의 응답을 격리하며, 출력 교체/unmount 시 진행 중인 조회를 취소하지 않고 완료되도록 두며, 이전 출력의 성공 콜백은 무시한다. SDK timer와 chart observer는 정리한다. 모델 설명은 최초 분석 스냅샷이고 차트 조회는 대화 state를 바꾸지 않는다.

계약과 검증은 [도메인 설계](../../technical-analysis/system-design.md#ta-query-001-조회-api와-차트-runtime), [flow](../../../flow/2026-11-14-openui-query-financial-charts.md)를 따른다.

## TA-QUERY-002: QueryPanel

공유 카탈로그 `QueryPanel(children, refreshAction)`은 Query의 편집 가능한 조건과 결과를 같은 반응형 패널에 묶는다. `refreshAction`은 `Action([@Run(queryStatement)])`를 전달하며 해당 Query를 직접 invalidate한다. 접근 가능한 `데이터 새로고침` 아이콘은 loading/streaming 중 disabled, pending 상태와 회전 표시를 제공한다. reduced-motion에서는 회전을 생략한다. loading hook은 같은 Renderer 안의 Query 전체에 적용되므로 복수 Query가 있으면 다른 패널도 조회 중 비활성화될 수 있다. 현재 금융 출력은 Query 하나다. 재조회는 `onMessage`나 모델 provider를 호출하지 않는다. 생성 프롬프트·schema는 기존 `sec-ui:generate`로 동기화한다.

## CHAT-ACTIVITY-002: /chat SDK 기본 도구 타임라인

`/langgraph-dev-chat`은 SDK Thread의 기본 `ToolCallTimeline`을 사용한다. LangGraph의 마지막 user 이후 도구 호출·결과를 id로 짝지어 assistant별 안전한 SDK toolCalls와 role=tool 메시지로 투영한다. 도구 이름·인자·도구 결과와 실행 상태를 타임라인에 전달한다. 스트림 또는 저장 기록에 포함되지 않은 값은 표시할 수 없다. 중간 assistant 설명과 비공개 추론은 표시하지 않는다. 호출 id를 assistant id로 구분하고 turn 안에서 중복을 제거한다.

SDK가 타임라인을 답변 본문 위에 배치하며 도구 없는 turn에는 표시하지 않는다. 기본 접힘과 사용자의 펼침 상태는 SDK가 관리한다. 공개 `components.ToolCallTimeline` 슬롯은 해당 인스턴스의 pending id를 native executing 상태로 전달하고 동일 SDK 컴포넌트를 렌더링한다. private store 수정이나 CSS 순서 변경은 사용하지 않는다. 별도 ChatActivity와 정상 idle/running 상태 띠는 제거하되 오류와 schema 경고는 유지한다.

chat 요청은 기존 한 번의 runs.stream에서 configured 모드를 보존하고 values를 보장한다. TA의 values-only 경로에 token streaming을 강제하지 않으며 기존 messages-tuple 경로에는 values를 함께 받는다. JSON graph 실행 계약은 유지한다. 기록 복원은 user별 마지막 답변과 안전한 도구 현황을 복원하고 남은 pending은 중단 상태로 종료한다. 새 대화·graph 전환은 이전 활동을 분리하며 기존 OutputView/Query는 유지한다. 중첩 graph가 상위 완료 시점에만 values를 보내면 완료 이력이 묶여 나타날 수 있다. 별도 subgraph 실시간 전송은 추가하지 않는다.

[변경·검증 기록](../../../flow/2026-11-14-chat-native-tool-timeline.md)

## OPENUI-CATALOG-CHART-001: TradingView 차트 카탈로그

`/open-ui/catalog`의 미디어·데이터 그룹에 `FinancialChart` 예제를 제공한다.
FinancialChart 또는 TradingView로 검색해 캔들·거래량·SMA/RSI/MACD, 가격·거래량 전용, 빈 데이터 예제를 실행하고 코드를 편집·초기화할 수 있다.
컴포넌트 목록의 `금융 차트 쇼케이스` 그룹에서는 캔들·거래량, SMA(20), RSI(14), MACD(12,26,9) 및 통합 조합을 각각 확인한다. 이 항목들은 `FinancialChart`의 구성 예제이며 별도 컴포넌트가 아니다. 카탈로그 예제는 명시적으로 가상 시세와 표시 확인용 지표 값을 사용하며 모델·서버를 호출하지 않는다. 실제 데이터 조회 계약은 TA-QUERY-001을 따른다.

## CHAT-HISTORY-001: /chat 대화 기록

`/langgraph-dev-chat`의 대화 기록(JSON 모드에서는 실행 기록)은 LangGraph SDK의 thread search와 최신 state 조회에 연결한다.
새 thread metadata에 `source=host-chat`, `graph_id`, 첫 질문의 앞 80자를 제목으로 기록한다.
선택한 그래프의 최신 50개 대화를 갱신 시각 내림차순으로 표시하고 저장된 대화를 열어 같은 thread에서 이어 쓴다.
목록 조회 오류와 메시지 복원 오류는 재시도할 수 있으며, 실행·복원 중에는 대화/그래프 전환을 막는다.
전환·새 대화·취소 후 오래된 응답이 현재 메시지를 덮어쓰지 않도록 요청을 구분한다.

복원 시 user/assistant 텍스트를 표시하고 tool 호출·도구 결과·추론 block은 제외한다.
checkpoint가 보유한 최신 presentation만 마지막 assistant에 복원하며 과거 turn별 차트는 복구하지 않는다. 보유된 tool call/result에서는 turn별 안전한 기본 도구 타임라인을 복원한다.
새 대화는 현재 화면을 비울 뿐 서버 thread를 삭제하지 않는다.
기능 추가 이전에 source/graph_id가 없었던 thread는 목록에서 자동 분류하지 않는다.
서버 재시작 후 보존 여부는 기존 PostgreSQL/checkpointer 설정을 따르며, 메모리 실행에서는 서버 종료 시 사라진다.

[변경·검증 기록](../../../flow/2026-11-14-chat-history.md)

## CHAT-LAYOUT-002: /chat 통합 헤더

`/langgraph-dev-chat`은 제목·그래프 선택·대화 기록·새 대화를 하나의 compact header에 배치한다. idle Ready띠와 반복 설명을 제거하고 agent별 한글 welcome을 표시한다. 빈 대화도 composer는 하단에 유지한다. 모바일은 header의 메뉴 열기 버튼을 사용하고 기존 전역floating trigger 중복을 숨긴다. compact header는 `/langgraph-dev-chat`에서만 사용한다. populated 대화에서도 header를 정상 문서 흐름에 두어 실제 높이만큼 공간을 확보한다. SEC 채팅은 기존 header와 composer를 유지하며 공통 컴포넌트 회귀 검증 대상으로 포함한다.

## CHAT-GRAPHS-001: 등록 graph discovery와 입력 모드

기존 LangGraph SDK assistants search를100개씩 offset pagination하고 graph_id별 중복을 제거한다. 각 assistant의 input_schema를 조회하고 모든 graph를 표시한다. schema실패도 graph를 숨기지 않고 오류를 안내한다. 새로운알수없는graph도 기본JSON모드로 노출하므로 고정목록이 등록범위를 제한하지 않는다.

starter_graph·simple_llm·technical_analysis_agent·technical_analysis_canvas_agent·sec_deep_agent는 기존 messages채팅을 사용한다. main_graph·price_agent·technical_analysis_graph·tenk_subgraph 및 미분류graph는 JSON객체·입력schema·편집가능예시와 원본values 결과를 제공한다. 내부계산필드까지UI필수입력으로강제하지않고 서버가실제계약을검증한다.

JSON실행은 새thread를 만들고 입력을변형없이runs.stream(values)로전달한다. 문법오류·배열/null은 전송하지않으며 streamerror·values없는종료를성공으로표시하지않는다. metadata의 run_id로 기존 runs.get을 조회해 status가 success인 경우에만 완료 처리한다. 결과는 100,000자까지 미리 보고 생략을 명시하며 전체 결과 복사는 원본 전체 JSON을 복사한다. 그래프/대화전환과 새실행은 이전요청을구분해늦은결과가섞이지않게한다. 실제시장·SEC·DB변경여부는 선택graph에따르며 자동실행하지않는다. SDK fetch 경계에서 취소 오류를 표준 AbortError로 정규화하여 이미 취소된 요청의 retry가 다음 실행을 막지 않게 한다. 일반 네트워크 retry 정책은 유지한다.

[변경·검증](../../../flow/2026-11-14-chat-layout-all-graphs.md)


## TA-CANVAS-001: 기존 보고서 Canvas 전환

기존 custom canvas 이벤트 기반 자동 보고서 탭은 TA-CANVAS-003의 선택형 요소 Canvas로 대체했다. 서버 보고서는 대화 근거로 보존하고, 화면은 사용자가 추가한 CanvasItem만 표시한다. 아래 TA-CANVAS-003과 [도메인 시스템 설계](../../technical-analysis/system-design.md)를 현재 계약으로 따른다.

## CHAT-RUNTIME-002: 개발 및 FastAPI 채팅 분리

`/langgraph-dev-chat`와 기존 `/chat` 별칭은 개발 런타임 2982를 유지하고 `/fastapi-chat`과 `/technical-analysis`·`/technical-analysis/canvas`는 자체 FastAPI 2981을 사용한다. 이 화면들은 동일한 ChatProvider/ChatPage·기본 도구 타임라인·인라인 차트·Canvas UI를 재사용하며 페이지가 불변 runtime context를 주입한다. 메뉴와 헤더는 런타임을 구분하고 모바일 메뉴는 헤더에서 연다.

개발 화면은 `/api/langgraph-runtime/*` → `LANGGRAPH_RUNTIME_API_URL`(기본2982), FastAPI 화면은 `/api/fastapi-langgraph/*` → `FASTAPI_RUNTIME_API_URL`(기본2981)로 전달한다. 실행·graph discovery/schema·history·state·run 상태·cancel과 FinancialChart Query가 모두 해당 페이지 proxy를 사용한다. client의 숨은 URL 치환과 서버 간 자동 fallback은 없다. 기존 비채팅 OutputView의 기본 chart endpoint는 변경하지 않는다. proxy는 요청 signal을 전달하고 캐시하지 않는다.

각 provider는 독립 thread/messages/graph/Canvas 상태를 소유한다. 새 thread metadata는 `source=host-chat`, `runtime=development|fastapi`, `graph_id`, `title`을 기록한다. FastAPI history는 runtime을 필터링하고 개발 history는 기존 runtime 없는 기록을 허용하되 명시적으로 다른 runtime인 기록을 표시하지 않는다.

SDK stream은 `on_disconnect=continue`를 명시한다. metadata 및 공개 onRunCreated callback에서 run ID를 즉시 추적하고, 명시적 중단은 SDK runs.cancel의 interrupt/wait를 호출하여 실제 서버 중단 확인 뒤 연결을 닫는다. ID 수신 전 중단 요청은 ID가 도착하면 전달한다. 외부 도구의 이미 발생한 부수 효과 rollback은 보장하지 않는다. 정상 EOF만으로 성공 처리하지 않고 run.status=success를 확인한다.

실행 중인 history도 열 수 있다. 최신 run과 저장된 state를 1.5초 간격으로 조회하다 terminal 상태에서 멈추며 놓친 토큰을 재생하지 않는다. 저장된 메시지·도구 상태·JSON 결과와 Canvas 보고서를 복원한다. 닫은 탭은 같은 화면의 조회 갱신으로 되살리지 않고, runtime/page 전환과 unmount는 소유 조회를 정리한다. 기존 Canvas 무복원 제한은 이 저장 상태 재개 경로에 한해 대체한다.

검증은 [통합 flow](../../../flow/2026-11-16-fastapi-runtime-and-ta-indicators.md)에 기록한다. 사용자 승인 범위에 따라 브라우저/Storybook browser 검증은 수행하지 않는다.


## TA-INDICATORS-002: 20개 지표와 다중 인스턴스

FinancialChart의 OpenUI prop은 snapshot 하나를 유지한다. schemaVersion 없는 기존 SMA/RSI/MACD 응답은 v1 adapter로 표시하고, v2는 정렬된 OHLCV bars와 instanceId별 indicators/series descriptor를 사용한다. 수치는 서버 응답만 사용한다. 같은 지표의 다른 설정은 독립 id와 label로 구분하며 요청 순서나 이름만으로 합치지 않는다. line·histogram·markers와 bandGroup의 upper/middle/lower 경계선을 공통 렌더러로 그린다. PSAR는 가격 위치의 점으로 표시한다. 서로 다른 oscillator 인스턴스는 별도 축/패널이며 공유 시간축으로 정렬한다.

전체 결과는 최신 표시 봉의 값·단위·서버 signal·오류·준비 부족을 요약하고 details로 설정/근거를 펼친다. null을 0이나 마지막 유효 값으로 덮지 않는다. 서버가 전달한 누적 origin 날짜·사용 이력·정책과 catalogVersion을 표시한다. 최대40개 인스턴스를 유지하고 하위 패널은 최대4개만 보이며 나머지도 요약·상세에서 선택할 수 있다. 가격 overlay와 패널의 표시 선택은 조회나 모델 실행을 만들지 않는다. Canvas는 공개 SDK state field로 탭별 표시 선택과 적용된 Query 인자를 보존한다.

`IndicatorControls($chart_instances, catalog)`는 서버 catalog의 매개변수 범위·기본값·단위를 사용한다. 추가·제거·설정 복제·기본3개·전체20개 구성과 명시적 초안 적용을 제공한다. 같은 이름의 여러 설정을 허용하고 새 client instanceId는 검증 가능한 ui-UUID 형식이다. TSI/TRIX signal은 선택 사항이며 해제 시 signal_period=0을 함께 반영한다. 초안은 적용해야 조회/새로고침에 반영된다.

allowlisted `technical_analysis_catalog`는 해당 runtime의 `/technical-analysis/catalog`, v2 chart는 `/technical-analysis/chart?schema_version=2&instances=<JSON>`를 호출한다. 기존 v1 인자도 유지한다. catalog 실패는 Renderer의 QueryError/Retry로 재시도하고 계산 오류는 지표별로 표시한다. 서버 수치 배열은 DSL에 복사하지 않고 Query가 가져오므로 200봉·다중 지표가 60000자 프로그램 제한을 조용히 우회하지 않는다. 생성 catalog/spec와 Python prompt 사본은 `pnpm -C 1-fe-host sec-ui:generate`로 동기화한다.

두 TA 화면의 재분석은 마지막 성공한 Query 인자만 사용한다. 인라인은 `analysis_request`, Canvas는 `canvas_context.request`로 ticker/interval/count와 인스턴스 전체 설정을 구조화해 전달한다. 단순 조회에는 LLM 실행이 없으며, 인라인 재분석은 새 대화 답변으로, Canvas 재분석은 새 report UUID로 표시한다. 기존 해석의 snapshot 경고는 유지한다.

검증 기록은 [통합 flow](../../../flow/2026-11-16-fastapi-runtime-and-ta-indicators.md)를 따른다. Story 정의는 추가하되 이번 사용자 승인 범위는 API와 정적 검사이며 Storybook/브라우저 실행은 사용자에게 남긴다.


## OPENUI-CATALOG-SYNC-001: 생성 원본과 공통 prompt 일치

카탈로그 원본은 `shared/ui/intelligent-ui/library.ts`다. 기존 `pnpm -C 1-fe-host sec-ui:generate`가 FE의 system-prompt.txt/spec.json을 생성하고 공통 Python openui_output/generated/system-prompt.txt로 prompt를 복사한다. 그래프별 사본을 추가하지 않는다. UI를 생성하는 Python 소비자는 같은 파일을 읽고, 일반 텍스트·조회·계산 그래프에 UI 카탈로그를 억지로 주입하지 않는다.

`pnpm -C 1-fe-host openui:check`는 OS 임시 디렉터리에서 현재 원본을 재생성한 뒤 FE txt/spec 및 Python prompt 사본을 바이트 단위로 비교한다. 저장된 파일을 수정하지 않으며 종료 시 임시 디렉터리를 정리한다. 빈 출력이나 불일치는 실패하고 기존 생성 명령을 안내한다. Host build는 이 검사를 먼저 실행하므로 최신 원본과 다른 생성 파일을 배포하지 않는다. 개발 서버의 매 요청에서 generator를 실행하지 않는다. 검사 회귀는 `pnpm -C 1-fe-host test:openui-sync`로 확인한다.

OpenUI 컴포넌트 catalog와 Renderer의 Query toolProvider는 별도 계약이다. generate는 runtime handler를 등록하지 않는다. 현재 chart/catalog handler 등록이 포함된 최신 JS와 예전 탭의 번들은 다를 수 있으므로 오류에 Available: technical_analysis_chart만 보이면 현재 제공 JS와 열린 탭의 버전을 먼저 확인한다. 지표 catalog API는 20개 지표 정의를 반환하는 단일 조회 도구이며 컴포넌트 개수와 다르다.

[변경·검증 기록](../../../flow/2026-11-16-openui-catalog-prompt-sync.md)

## TA-NAV-001: 기술적 분석 전용 진입과 OpenUI Lang

AI Chat의 인라인 메뉴는 `/technical-analysis` → `technical_analysis_agent`, Canvas 메뉴는
`/technical-analysis/canvas` → `technical_analysis_canvas_agent`로 연결한다. 두 화면은 FastAPI 런타임의
동일한 ChatProvider/ChatPage를 재사용하되 `fixedGraphId`로 discovery 결과와 전환·실행을 제한한다.
대상 미등록 시 다른 에이전트로 fallback하지 않으며 목록 재시도를 제공한다. 실행 중·기록 복원·새 대화와
runtime/graph별 history 계약은 CHAT-RUNTIME-002를 따른다. 전용 화면의 새 thread는 `runtime=fastapi`로 생성하며 기존 개발 기록은 `/langgraph-dev-chat`에서 확인한다. 자동 기록 이관이나 개발 런타임 fallback은 하지 않는다.

두 그래프의 시각화는 SEC Intelligent UI와 동일한 공유 `OutputView` 및
`@openuidev/react-lang` Renderer·카탈로그를 사용한다. 인라인은 `presentation.program`을
InlineAnalysis 안에서 렌더링하고 Canvas는 채팅의 검증된 program에서 사용자가 선택한 CanvasItem만 별도 패널에 추가한다. Canvas 프로그램은 검증 후 채팅에 표시하며 모델 없는 Query를 유지한다.
일반 텍스트 요약·오류 fallback은 별도이므로 모든 메시지가 OpenUI DSL이라는 뜻은 아니다.

[구현·검증 기록](../../../flow/2026-11-16-technical-analysis-dedicated-navigation.md).

### TA-STARTERS-001: 분석 시작 질문

두 기술적 분석 그래프는 각각 12개의 시작 질문을 제공한다. 미국·한국 종목 및 ETF, 일봉·주봉,
추세·모멘텀·변동성·거래량, RSI/SMA의 복수 기간 비교와 지원 지표 20개 종합 분석을 포함한다.
질문은 `chat/model/technicalAnalysisStarters.ts`에서 관리하며 인라인은 대화 내 차트,
Canvas는 채팅 해석과 개별 추가 가능한 차트·표를 요청한다. 개발 채팅에서 같은 그래프를 선택해도 동일한 질문을 사용한다.
지원 범위인 일봉·주봉·현재 20개 지표만 제안하며 엘리엇 파동·분봉·통합 매매 점수는 제안하지 않는다.
[변경·검증](../../../flow/2026-11-16-technical-analysis-starter-questions.md).

### OPENUI-DEVTOOLS-001: 선택적 개발 진단 도구

SDK가 development에서 자동 마운트하는 Inspect/배포 안내는 기본 비활성이다. OPENUI_DEVTOOLS=true를 설정하고 Host를 재시작하면 원래 도구를 활성화한다. Next Turbopack/webpack 공개 alias가 선택적 @openuidev/devtools만 no-op adapter로 교체하며 업무 응답·native renderer/parser는 보존한다. 실제 컴파일과 모듈 포함은 검증했고 브라우저 시각 검증은 생략했다. [회귀 기록](../../../flow/2026-11-16-sec-financial-basis-devtools-regression.md).


## TA-CANVAS-003: CanvasItem과 Library Explorer

`CanvasItem(id,title,children)`은 shared OpenUI catalog와 Library Explorer에 등록한다. `OutputView`에 `onCanvasAdd`가 있을 때만 `Canvas에 추가` 버튼을 표시한다. 이 콜백은 Canvas 전용 ChatPage에서 연결하고 다른 채팅에서는 children만 표시한다. 추출기는 선택한 children이 참조하는 선언과 Query를 보존하며 다른 요소의 Query는 가져오지 않는다.

`onQueryStatusChange`는 chart의 loading/success/error를 전달한다. 최신 요청만 상태·성공 콜백을 갱신해 오래된 응답이 PDF 버튼을 잘못 활성화하지 않게 한다. 카탈로그 원본·생성 spec·Python prompt 사본은 기존 generate/check 스크립트로 동기화한다. 제품 범위와 저장 제한은 [기술적 분석](../../technical-analysis/system-design.md#ta-canvas-003-선택형-요소와-인용-문맥), 실행 증거는 [flow](../../../flow/2026-11-17-canvas-item-workspace.md)를 따른다.

## CHAT-STARTERS-002: 기능별 시작 질문

AI Chat 메뉴의 기술적 분석 인라인·Canvas, TA-Lib, SEC API Agent, SEC Intelligent Research Chat, SEC Modeling Chat은 공통 `starterGroups`로 주제별 질문을 표시한다. 첫 그룹만 기본으로 펼치며 나머지는 제목·질문 수를 보고 펼친다. 클릭하면 표시 제목에 대응하는 전체 질문을 기존 대화 전송 경로로 전달한다. 대화가 시작되면 시작 질문은 숨기며 실행 중 중복 전송 방지는 기존 공통 프레임을 따른다.

질문 구성은 각 페이지의 model에서 관리한다. 기술적 분석은 추세·모멘텀·변동성·거래량·시장별 예제를 제공하며 Canvas의 설명은 채팅에, 선택 가능한 UI 요소는 CanvasItem으로 요청한다. SEC 질문은 실제 제공된 조회·검색·수집·모델링 도구의 범위 안에서 작성한다. 데이터가 없으면 미수집·미모델링 상태를 구분하고 없는 근거를 만들지 않도록 요청한다. 일반 대화 그래프에도 별도 시작 질문을 제공하고 JSON 입력 그래프는 기존 실행 폼을 유지한다.

이 변경은 질문 데이터와 표시 연결에 한정되며 도구 권한이나 서버 API를 확장하지 않는다. 새 OpenUI 컴포넌트가 없어 Library Explorer/catalog 재생성은 필요하지 않다. [검증 기록](../../../flow/2026-11-17-grouped-chat-starters.md)을 참조한다.

## CHAT-GRAPH-MODE-002: 개발 그래프 이름과 메시지 입력

LangGraph 개발 채팅의 GraphSelector는 graph ID를 그대로 표시하며 번역명·JSON 접미사를 붙이지 않는다. 전용 채팅 제목과 FastAPI 목록 표시명은 유지한다. price_agent와 technical_analysis_graph는 messages 기반 chat 모드를 사용한다. technical_analysis_graph는 OHLCV prices가 thread state에 필요함을 안내하며 데이터가 없으면 기존 검증 응답을 채팅으로 표시한다. main_graph/tenk_subgraph는 JSON 입력 모드를 유지한다.
