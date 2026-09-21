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

입력값은 DataContext에 쓴다. action 제출 시 resolveAction으로 최신 바인딩을 해석한 다음 dispatchAction을 호출한다. SDK 기본 activity renderer 대신 각 surface가 agent ToolMessage를 구독한다. 서로 다른 메시지 ID의 동일 데이터는 정상적인 재조회이므로 다시 반영한다.

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

`RunProgress`는 현재 CopilotKit agent의 실행 수명주기 및 `a2ui.progress` CUSTOM 이벤트를 구독한다. 요청 전송부터 실제 서버 단계의 순서를 최대12개 표시한다. RUN_FINISHED는 완료, RUN_ERROR(code=abort)와 AbortError는 중단, 나머지 RUN_ERROR 및 실행 실패는 실패, 완료 이벤트 없는 실행 종료는 중단으로 표시한다. 새 실행은 이전 단계를 초기화하며 새 대화는 컴포넌트를 재생성한다. 임의 타이머나 가상의 퍼센트는 사용하지 않는다. 알 수 없는 stage는 무시한다. SEC는 현재 요청 전송과 수명주기만 표시하며 상세 단계 이벤트는 Dynamic/Fixed graph에서 제공한다.

SEC 전용 경로와 모델 없는 조회 흐름은 [SEC](sec.md), 실행 설정은 [운영](operations-and-validation.md), wire와 진행 이벤트는 [프로토콜](protocol-and-events.md)을 따른다.

## A2UI-STREAM-001: Dynamic 표시 방식 선택

Dynamic 화면의 `화면 표시 방식`에서 `일괄 · 완성 후 표시`(기본)와 `점진 · 생성 중 미리보기`를 선택한다. 실행 중에는 선택을 비활성화하며 새 대화는 기본값으로 초기화한다. `forwardedProps.a2uiRenderMode`가 다음 요청의 표시 방식을 전달한다. Fixed/SEC는 기존 일괄 방식을 유지한다.

점진 모드의 `ProgressivePreview`는 서버의 `a2ui.preview` CUSTOM 이벤트를 구독해 대화 위에 임시 A2UI surface를 표시한다. 완결되고 서버 검증을 통과한 부분 트리만 표시하며 데이터는 서버 facts다. 모델 생성 순서·구조에 따라 첫 미리보기 시점과 갱신 횟수는 달라진다. 완료 시간을 줄이는 기능은 아니며, 유효한 부분 트리가 없으면 최종 화면만 나타날 수 있다.

미리보기는 입력/action과 영속 상태를 갖지 않는다. 새 실행·재시도·실패·취소·최종 결과 수신 시 정리한다. 확정된 화면은 기존 검증된 ToolMessage와 activity renderer가 대화 안에 표시한다. Runtime의 `a2uiToolNames: []`는 유지하여 SDK가 서버 업무 검증 전의 모델 후보를 직접 그리지 않도록 한다. [프로토콜](protocol-and-events.md#a2ui-stream-001-점진-미리보기)과 [변경 기록](../../../flow/2026-09-21-a2ui-progressive-rendering.md)을 참조한다.
