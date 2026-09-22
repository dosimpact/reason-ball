# A2UI Host 구현과 운영

공용 계약과 버전은 [A2UI 시스템](a2ui-system.md)이 소유한다.

## 파일과 책임

- `src/lib/a2ui/definitions.ts`: 61개 UI 파일을 대응하는 66개 JSON props 정의와 모드별 카탈로그.
- `src/lib/a2ui/*-adapters.tsx`: 기존 UI의 조합, 데이터 바인딩, 명시적 사용자 이벤트 전달.
- `src/lib/a2ui/catalog.tsx`: SDK Catalog 및 React 컴포넌트 등록.
- `scripts/a2ui-contract.ts`: 정적 계약 생성과 drift 검사. 생성물은 수동 수정하지 않는다.
- `src/features/a2ui-demo`: 모드별 대화, 오류 표시, 새 대화, 같은 surface의 후속 도구 메시지 처리.
- `src/lib/a2ui/runtime.ts`: Next.js Runtime에서 FastAPI로 요청 전달.

`/a2ui`가 진입점이다. `/a2ui/catalog`는 하나의 어댑터씩 보여준다. Dynamic·Fixed·SEC는 별도 agent와 thread를 사용한다. `A2UI_LANGGRAPH_URL`은 서버 전용 FastAPI base URL이며 기본값은 `http://127.0.0.1:8000`이다. 브라우저에 모델 비밀값을 전달하지 않는다.

입력값은 DataContext에 쓴다. action 제출 시 resolveAction으로 최신 바인딩을 해석한 다음 dispatchAction을 호출한다. SDK 기본 activity renderer 대신 `SurfaceStreamProvider`가 첫 실행 전에 agent 메시지를 구독한다. 검증된 ToolMessage와 a2ui-surface activity를 toolCallId 기준으로 한 번씩 순서대로 기록한다. 실행 도중 마운트한 화면도 이 기록을 받아 후속 갱신을 놓치지 않는다. 같은 호출의 tool/activity/최종 메시지 스냅샷 중복을 제거하며 다른 toolCallId의 재조회는 다시 반영한다.

## 검증 명령

워크스페이스 루트에서 아래 명령을 **하나씩** 실행한다.

```sh
pnpm a2ui:check
pnpm --filter reason-hwang-fe-host test:a2ui
pnpm --filter reason-hwang-fe-host test:a2ui:views
pnpm --filter reason-hwang-fe-host typecheck
pnpm --filter reason-hwang-fe-host lint
pnpm --filter reason-hwang-fe-host build
```

Storybook은 A2UI 프로토콜을 거쳐 모든 어댑터를 렌더링한다. Select/Input 제출 값과 Dialog 조합, 서버 데이터 경로에 바인딩한 Table을 검증한다. 실제 생성·action 왕복·새 대화·취소는 MCP 브라우저 검증 대상이다. 실행 상태는 [flow](../../../flow/2026-09-21-a2ui-browser-and-grounding.md)를 참조한다.

## A2UI-CATALOG-EDIT-001: 편집형 카탈로그

`/a2ui/catalog`는 66개 어댑터 선택, 실제 A2UI 미리보기, JSON 데이터 모델 편집기를 제공한다. Card 기본 예제는 Metric 두 개와 Chart, Table을 조합한다. `미리보기에 적용`은 JSON 및 모델 타입·배열 길이 검증 후 surface를 다시 만든다. 파싱·검증 오류는 마지막 정상 미리보기를 보존한다. `예제 초기화` 및 컴포넌트 전환은 기본값으로 복원한다.

속성과 `path` 바인딩은 읽기 전용 패널에서 확인한다. 고정 속성은 데이터 모델 편집으로 변경되지 않는다. 매출 합계·차트·표 데이터는 독립적이며 자동 합산하지 않는다. 적용·초기화는 미리보기 입력 상태와 최근 action을 초기화한다. 입력 컴포넌트 조작은 surface 내부 데이터에 반영되며 JSON 초안과 자동 양방향 동기화하지 않는다. `바인딩 확인`으로 최신 action payload를 확인한다.

## A2UI-PROGRESS-001: SSE 진행 표시

`RunProgress`는 현재 CopilotKit agent의 실행 수명주기 및 `a2ui.progress` CUSTOM 이벤트를 구독한다. 요청 전송부터 실제 서버 단계의 순서를 최대12개 표시한다. RUN_FINISHED는 완료, RUN_ERROR(code=abort)와 AbortError는 중단, 나머지 RUN_ERROR 및 실행 실패는 실패, 완료 이벤트 없는 실행 종료는 중단으로 표시한다. 새 실행은 이전 단계를 초기화하며 새 대화는 컴포넌트를 재생성한다. 임의 타이머나 가상의 퍼센트는 사용하지 않는다. 알 수 없는 stage는 무시한다. SEC도 각 agent 판단 단계에서 analyzing 이벤트를 발행하며 요청 수명주기와 함께 표시한다. Dynamic/Fixed의 구성·검증 등 상세 단계는 해당 graph에서 제공한다.

SEC의 에이전트 도구 선택과 버튼 조회 흐름은 [SEC](sec.md), 실행 설정은 [운영](operations-and-validation.md), wire와 진행 이벤트는 [프로토콜](protocol-and-events.md)을 따른다.

## A2UI-STREAM-001: Dynamic 표시 방식 선택

Dynamic 화면의 `화면 표시 방식`에서 `일괄 · 완성 후 표시`와 `점진 · 생성 중 미리보기`(기본)를 선택한다. 실행 중에는 선택을 비활성화하며 새 대화는 기본값으로 초기화한다. `forwardedProps.a2uiRenderMode`가 다음 요청의 표시 방식을 전달한다. Fixed/SEC는 기존 일괄 방식을 유지한다.

점진 모드의 `ProgressivePreview`는 서버의 `a2ui.preview` CUSTOM 이벤트를 구독해 대화 위에 임시 A2UI surface를 표시한다. 완결되고 서버 검증을 통과한 부분 트리만 표시하며 데이터는 서버 facts다. 모델 생성 순서·구조에 따라 첫 미리보기 시점과 갱신 횟수는 달라진다. 완료 시간을 줄이는 기능은 아니며, 유효한 부분 트리가 없으면 최종 화면만 나타날 수 있다.

미리보기는 입력/action과 영속 상태를 갖지 않는다. 새 실행·재시도·실패·취소·최종 결과 수신 시 정리한다. 확정된 화면은 기존 검증된 ToolMessage와 activity renderer가 대화 안에 표시한다. Runtime의 `a2uiToolNames: []`는 유지하여 SDK가 서버 업무 검증 전의 모델 후보를 직접 그리지 않도록 한다. [프로토콜](protocol-and-events.md#a2ui-stream-001-점진-미리보기)과 [변경 기록](../../../flow/2026-09-21-a2ui-progressive-rendering.md)을 참조한다.

## Fixed 화면 안내

Fixed 제목은 “항공편 · 기내식 · 좌석 선택 · Fixed”이며 설명·질문 예시·채팅 환영 문구에서 항공편 조회와 기내식/좌석 선택을 함께 안내한다. 문구 원본은 `features/a2ui-demo/fixed-copy.ts`이다. 페이지 밖의 중복 추가 데모 안내는 제거하고 기존 제목·설명 영역에 통합했다. 실제 예약 및 좌석 확보를 하지 않는다는 안내를 유지한다.

Fixed 예시는 기존 인천→도쿄·부산→오사카 항공편 질문을 유지하고 같은 예시 영역 뒤에 기내식만·좌석만·둘 다 선택하는 질문을 이어 붙인다. 별도의 “추가 데모” 안내 영역은 사용하지 않는다.

## SEC-A2UI-11: 결과 표시 위치

SEC `결과 표시 위치`는 “대화에 기록”(기본) / “작업 화면에서 이어가기 (Canvas)”를 제공한다. 선택은 다음 자연어 답변에 적용한다. 기본은 넓은 단일 열이며 Canvas를 선택했거나 기존 Canvas 결과가 있을 때만 작업 영역을 표시한다. 1280px 이상은 두 열, 작은 화면은 세로로 배치한다. `output-workspace.tsx`는 Canvas를 별도로 마운트하고 activity renderer는 Canvas ID를 채팅에 중복 표시하지 않는다. 최신 Inline 이전의 결과는 업무 입력/액션 버튼을 잠그고 “이전 결과 · 회사 · 단계 · 읽기 전용” 제목으로 접어 보존한다. 펼치면 당시 결과를 읽을 수 있다. ID 수명, 상태 격리와 서버 action 거절은 [SEC-A2UI-11](sec.md#sec-a2ui-11-inline-이력과-고정-canvas)이 소유한다.

`surface-stream.tsx`의 상위 구독자는 AG-UI가 실행 시작에 구독자 목록을 캡처하는 동작을 고려한다. `SurfaceMessages`는 메시지 등장 시점과 무관하게 해당 surface의 기록을 순서대로 반영한다. initial activity와 후속 도구 갱신은 동일 A2UIProvider를 사용한다. 새 대화에서는 journal과 Canvas가 함께 폐기된다.

## SEC-A2UI-12: 집중된 작업 화면

`sec-welcome.tsx`는 첫 회사 선택/도움말을 기존 agent의 사용자 메시지로 전송한다. `useAgent.isReady` 이전에는 시작 버튼을 잠가 임시 agent에서만 실행되고 대화에 결과가 사라지는 초기 연결 경합을 방지한다. SEC 진행 View는 한 줄 상태만 표시하며 다른 데모의 상세 진행 표시는 유지한다. `surface-frame.tsx`가 활성 결과와 과거 결과를 구분하고, `surface-title.ts`는 마지막 전체 스냅샷에서 현재 회사와 단계를 읽는다. Canvas 회사 변경 후 이전 회사명을 재사용하지 않는다.

상위 `SurfaceStreamProvider`는 실행 시작/종료도 구독하여 `running`을 공유한다. 실행 중 늦게 마운트한 fieldset도 종료 시 정상 활성화되며, 실행 중·action 대기 중 fieldset은 잠긴다. 과거 결과는 `SurfaceReadOnly`와 SEC 카탈로그에서 Button/Input/Select만 잠가 Accordion/Collapsible의 출처·본문 펼침을 허용한다. 과거 onAction 가드와 서버 revision 검증도 유지한다. `surface-operations.ts`는 순수 메시지 계약/검증을 소유한다. 단계별 화면은 [SEC-A2UI-12](sec.md#sec-a2ui-12-조회와-분석의-단계별-ux)를 따른다.

## A2UI-CHAT-HEIGHT-001: 채팅 내부 스크롤

공용 `ChatViewport`는 SEC/Fixed/Dynamic 채팅에 `height:70dvh`, `max-height:900px`, `min-height:0`을 제공한다. SDK의100% 높이와 내부 메시지 스크롤이 동작하여 긴 대화가 페이지를 계속 확장하지 않는다. 입력창은 메시지 스크롤 중에도 같은 위치를 유지한다. 작은 화면에서 환영 영역이 넘치면 바깥 viewport의 overflow-y:auto로 입력 접근을 유지한다. 헤더·진행·Canvas 영역의 기존 배치는 유지하므로 페이지 자체의 스크롤을 완전히 없애는 정책은 아니다. [검증 기록](../../../flow/2026-09-23-a2ui-chat-height.md).
