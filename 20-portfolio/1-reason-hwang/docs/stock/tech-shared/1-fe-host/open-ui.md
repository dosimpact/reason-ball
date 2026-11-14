# Generative UI Host

화면 진입점은 `/open-ui/*`이며 구현은 OpenUI Lang이다. 공통 계약은 [OpenUI 통합 설계](../openui-migration.md)를 따른다.

- 루트 `app/open-ui`는 FSD `_pages/generative-ui`의 화면을 export한다. `Demo.tsx`가 thread, 요청 취소, 이전 결과, 최신 action revision과 새 대화를 소유하고, 공통 `AgentConversation`에 대화 표시와 입력을 위임한다.
- `api/stream.ts`는 AG-UI CUSTOM ui.output을 읽고 현재 카탈로그로 검증하며 RUN_FINISHED 없는 연결 종료를 실패로 처리한다.
- `shared/ui/intelligent-ui/OutputView.tsx`가 OpenUI Renderer, BusinessAction, ToAssistant, OpenURL과 라이브러리 action을 처리한다. SEC Chat의 AnswerView도 이 컴포넌트를 사용한다. SEC 관리자 채팅은 공통 AgentChatFrame에 같은 library를 전달한다.
- `_app/api/generative-ui/[mode]/route.ts`가 same-origin 요청과 `dynamic`/`fixed` 모드를 검사하고 FastAPI로 스트리밍 중계한다. 브라우저 취소를 upstream에 전달한다. API 키와 모델 설정은 전달하지 않는다.
- `_pages/generative-ui/ui/catalog`은 기준 PoC Lib Story를 이관한 컴포넌트·함수·action 탐색기다. 검색·코드 편집·초기화·반응형 상태를 지원한다. 업무 action 예제는 서버 상태를 변경하지 않는다.
- `sec-ui:generate`가 공유 library에서 프롬프트·명세·Python 자산을 동기화한다. 이전 UI 프로토콜의 registry/schema/manifest는 사용하지 않는다.

검증은 `test:generative-ui`, `test:generative-ui:views`, `test:generative-ui:live`, 기존 `test:sec-chat:views`를 사용한다. live 테스트는 OPENUI_LIVE_BASE_URL의 소유한 서버를 사용하며 서버를 자동 시작하지 않는다. 서버/브라우저 정리까지 [검증 원칙](../../../validation/INDEX.md)을 적용한다.

## OPENUI-AGENT-001: 공통 에이전트 인터페이스

`shared/ui/agent-conversation/`은 `@openuidev/react-ui`의 `AgentInterface`를 사용하는 공통 채팅 UI다. `/chat`, `/sec-chat`, `/open-ui/dynamic`, `/open-ui/fixed`, `/examples/push-ui-message`에서 표준 Composer·메시지 목록·헤더를 사용한다. `/sec-api-agent`는 `fetchLLM`·`agUIAdapter` 전송을 공통 `AgentChatFrame`에 연결한다. 카탈로그와 대화가 아닌 화면은 전환 대상이 아니다.

`ChatLLM.send`는 기존 화면 controller의 전송 함수를 호출하고, 표준 중단 신호는 해당 controller의 AbortController로 연결한다. 기존 SDK/SSE 파서가 전송을 소비하므로 공통 adapter의 parser는 추가 이벤트를 만들지 않는다. `SyncMessages`는 domain controller가 관리하는 메시지를 OpenUI thread에 반영한다. OpenUI 내부 사이드바는 숨기고 호스트 내비게이션을 유지한다. Host 테마를 공유하며 첫 client mount 후 렌더링한다.

AssistantMessage 확장 렌더러는 화면별 검증 결과를 표시한다. SEC의 근거·추천 질문·실행 기록, 기술적 분석의 OpenUI 차트, 데모의 최신 revision action 제한, 학습 예제의 진행 단계는 각 domain controller와 renderer가 소유한다. 공통 UI 도입이 전송 형식이나 서버의 상태 소유권을 변경하지 않는다. 기존 화면의 메모리 보관·만료 정책도 유지한다.

변경과 검증은 [이관 기록](../../../flow/2026-11-14-agent-interface-migration.md)을 따른다.

화면 추천·선택 action처럼 SDK 밖에서 시작한 실행은 `busy`로 Composer 전송을 비활성화하고 별도 중단 버튼을 제공한다. SDK에서 시작한 실행은 표준 Cancel을 사용한다. 새 대화는 작성 중 입력도 초기화하며 실행 중에는 비활성화한다.


## OPENUI-CHAT-DS-001: 공통 채팅 디자인 시스템

`shared/ui/agent-conversation`은 모든 채팅이 공유하는 표현 계층이다. `/sec-api-agent`, `/sec-chat`, `/chat`, `/open-ui/{dynamic,fixed}` 및 Push UI 채팅은 동일한 프레임·토큰·반응형 배치·Welcome·메시지 목록·Composer·헤더 액션을 사용한다. 페이지별 CSS로 프레임이나 입력창을 다시 정의하지 않는다. 카탈로그와 비채팅 화면은 이 계약의 대상이 아니다.

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

`/chat` 기술적 분석은 선택되어 펼쳐진 Canvas 탭의 검증 완료 출력에만 `active`를 전달한다. 해당 프로그램의 `$chart_refresh_seconds` 기본0을 사용자가 opt-in할 때30으로 전환한다. 선택되지 않은 탭과 접히거나 닫힌 Canvas는 polling을 멈춘다. Query key별 캐시가 설정 변경 중의 응답을 격리하며, 출력 교체/unmount는 소유 fetch를 취소하고 SDK timer와 chart observer를 정리한다. 모델 설명은 최초 분석 스냅샷이고 차트 조회는 대화 state를 바꾸지 않는다.

계약과 검증은 [도메인 설계](../../technical-analysis/system-design.md#ta-query-001-조회-api와-차트-runtime), [flow](../../../flow/2026-11-14-openui-query-financial-charts.md)를 따른다.

## TA-QUERY-002: QueryPanel

공유 카탈로그 `QueryPanel(children, refreshAction)`은 Query의 편집 가능한 조건과 결과를 같은 반응형 패널에 묶는다. `refreshAction`은 `Action([@Run(queryStatement)])`를 전달하며 해당 Query를 직접 invalidate한다. 접근 가능한 `데이터 새로고침` 아이콘은 loading/streaming 중 disabled, pending 상태와 회전 표시를 제공한다. reduced-motion에서는 회전을 생략한다. loading hook은 같은 Renderer 안의 Query 전체에 적용되므로 복수 Query가 있으면 다른 패널도 조회 중 비활성화될 수 있다. 현재 금융 출력은 Query 하나다. 재조회는 `onMessage`나 모델 provider를 호출하지 않는다. 생성 프롬프트·schema는 기존 `sec-ui:generate`로 동기화한다.

## CHAT-ACTIVITY-002: /chat SDK 기본 도구 타임라인

`/chat`은 SDK Thread의 기본 `ToolCallTimeline`을 사용한다. LangGraph의 마지막 user 이후 도구 호출·결과를 id로 짝지어 assistant별 안전한 SDK toolCalls와 role=tool 메시지로 투영한다. 도구 이름과 실행 상태만 전달하고 인자는 `{}`, 결과·오류는 일반 완료/실패/중단 안내로 제한한다. 인자·원문 결과·중간 설명·비공개 추론은 복사하지 않는다. 호출 id를 assistant id로 구분하고 turn 안에서 중복을 제거한다.

SDK가 타임라인을 답변 본문 위에 배치하며 도구 없는 turn에는 표시하지 않는다. 기본 접힘과 사용자의 펼침 상태는 SDK가 관리한다. 공개 `components.ToolCallTimeline` 슬롯은 해당 인스턴스의 pending id를 native executing 상태로 전달하고 동일 SDK 컴포넌트를 렌더링한다. private store 수정이나 CSS 순서 변경은 사용하지 않는다. 별도 ChatActivity와 정상 idle/running 상태 띠는 제거하되 오류와 schema 경고는 유지한다.

chat 요청은 기존 한 번의 runs.stream에서 configured 모드를 보존하고 values를 보장한다. TA의 values-only 경로에 token streaming을 강제하지 않으며 기존 messages-tuple 경로에는 values를 함께 받는다. JSON graph 실행 계약은 유지한다. 기록 복원은 user별 마지막 답변과 안전한 도구 현황을 복원하고 남은 pending은 중단 상태로 종료한다. 새 대화·graph 전환은 이전 활동을 분리하며 기존 OutputView/Query는 유지한다. 중첩 graph가 상위 완료 시점에만 values를 보내면 완료 이력이 묶여 나타날 수 있다. 별도 subgraph 실시간 전송은 추가하지 않는다.

[변경·검증 기록](../../../flow/2026-11-14-chat-native-tool-timeline.md)

## OPENUI-CATALOG-CHART-001: TradingView 차트 카탈로그

`/open-ui/catalog`의 미디어·데이터 그룹에 `FinancialChart` 예제를 제공한다.
FinancialChart 또는 TradingView로 검색해 캔들·거래량·SMA/RSI/MACD, 가격·거래량 전용, 빈 데이터 예제를 실행하고 코드를 편집·초기화할 수 있다.
카탈로그 예제는 명시적으로 가상 시세와 표시 확인용 지표 값을 사용하며 모델·서버를 호출하지 않는다. 실제 데이터 조회 계약은 TA-QUERY-001을 따른다.

## CHAT-HISTORY-001: /chat 대화 기록

`/chat`의 대화 기록(JSON 모드에서는 실행 기록)은 LangGraph SDK의 thread search와 최신 state 조회에 연결한다.
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

`/chat`은 제목·그래프 선택·대화 기록·새 대화를 하나의 compact header에 배치한다. idle Ready띠와 반복 설명을 제거하고 agent별 한글 welcome을 표시한다. 빈 대화도 composer는 하단에 유지한다. 모바일은 header의 메뉴 열기 버튼을 사용하고 기존 전역floating trigger 중복을 숨긴다. compact header는 `/chat`에서만 사용한다. populated 대화에서도 header를 정상 문서 흐름에 두어 실제 높이만큼 공간을 확보한다. SECchat·PushUI는 기존 header와 composer를 유지하며 공통 컴포넌트 회귀 검증 대상으로 포함한다.

## CHAT-GRAPHS-001: 등록 graph discovery와 입력 모드

기존 LangGraph SDK assistants search를100개씩 offset pagination하고 graph_id별 중복을 제거한다. 각 assistant의 input_schema를 조회하고 모든 graph를 표시한다. schema실패도 graph를 숨기지 않고 오류를 안내한다. 새로운알수없는graph도 기본JSON모드로 노출하므로 고정목록이 등록범위를 제한하지 않는다.

starter_graph·simple_llm·technical_analysis_agent·sec_deep_agent는 기존 messages채팅을 사용한다. main_graph·price_agent·technical_analysis_graph·tenk_subgraph·simple_push_ui_message 및 미분류graph는 JSON객체·입력schema·편집가능예시와 원본values 결과를 제공한다. Push예시는 turn_id를 포함한다. 내부계산필드까지UI필수입력으로강제하지않고 서버가실제계약을검증한다.

JSON실행은 새thread를 만들고 입력을변형없이runs.stream(values)로전달한다. 문법오류·배열/null은 전송하지않으며 streamerror·values없는종료를성공으로표시하지않는다. metadata의 run_id로 기존 runs.get을 조회해 status가 success인 경우에만 완료 처리한다. 결과는 100,000자까지 미리 보고 생략을 명시하며 전체 결과 복사는 원본 전체 JSON을 복사한다. 그래프/대화전환과 새실행은 이전요청을구분해늦은결과가섞이지않게한다. 실제시장·SEC·DB변경여부는 선택graph에따르며 자동실행하지않는다. SDK fetch 경계에서 취소 오류를 표준 AbortError로 정규화하여 이미 취소된 요청의 retry가 다음 실행을 막지 않게 한다. 일반 네트워크 retry 정책은 유지한다.

[변경·검증](../../../flow/2026-11-14-chat-layout-all-graphs.md)

## TA-CANVAS-001: 기술적 분석 Dynamic Canvas

`technical_analysis_agent`는 기존 SDK stream의 custom canvas 이벤트를 받으면 `/chat` 옆 Canvas를 자동으로 연다. 다른 graph와 공통 AgentConversation·기본 도구 타임라인은 유지한다. 서버 UUID별 탭은 티커·주기·생성 순번을 표시한다. 닫기·접기·재열기와 키보드/포인터 splitter를 제공하며 desktop은 좌우, mobile은 상하로 나눈다. 참조 mini-project 패턴을 Host FSD와 테마에 맞게 적용한다.

`open → reset/delta → validating → ready/error`를 thread·실행·report id로 격리한다. repair reset은 버퍼를 교체한다. canonical root가 없으면 공개 SDK autoClose와 `root = Col([taLayout])`를 별도 미리보기 문자열에만 적용한다. 파싱 가능한 부분을 표시하되 실제 버퍼와 최종 프로그램은 변경하지 않는다. 미리보기는 inert이며 Query provider·액션·컨트롤을 비활성화한다. root가 파싱되지 않으면 준비 안내를 유지한다. 서버 검증이 완료된 ready만 조회·조작을 허용한다.

선택한 보이는 탭만 OutputView를 mount한다. 전환·접기·닫기는 조회와 polling을 정리한다. 탭별 입력 상태는 보존하되 polling은 기본 꺼짐으로 복원한다. 조건 변경·수동 새로고침은 FinancialChart/QueryPanel provider로 모델 없이 실행한다. 설명은 생성 당시 스냅샷임을 표시한다. 재분석은 마지막 성공한 조회 조건·지표 설정을 `canvas_context.request`로 보내 새 보고서를 만든다. 일반 후속 질문은 선택한 reportId를 전달한다.

채팅에는 짧은 요약과 보고서 열기를 표시한다. 새 대화·기록 열기·graph 전환은 Canvas를 비운다. Canvas 복원·PDF·공유·시세 인용은 범위 밖이다. 닫은 UUID와 취소 실행의 늦은 이벤트는 무시한다. API 검증은 검증 담당에게 위임하고 브라우저 검증은 사용자가 수행한다.
