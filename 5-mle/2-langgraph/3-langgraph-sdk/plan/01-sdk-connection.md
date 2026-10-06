# 01 SDK Connection

## Coding Scope

- Graph: `graphs/01_sdk_connection.py` exposes the simplest assistant entrypoint with one node that echoes input and emits a small state update.
- Frontend: `src/examples/01-sdk-connection/` provides assistant selection, thread controls, run controls, and a stream event log.
- Shared code: create reusable LangGraph client utilities instead of constructing SDK clients in the component.

## Implementation Plan

1. Register a `01_sdk_connection` graph in `langgraph.json`.
2. Add SDK helpers for assistants, threads, runs, stream subscription, and error normalization.
3. Build UI panels for server status, assistant list, thread create/delete/reuse, run input, run status, and stream events.
4. Persist the selected assistant and current thread in local component state only.

## SDK And State Notes

Use `Client.assistants.search`, thread create/get/delete APIs, run creation, and streaming events. Display raw event type, run id, status, and final values.

## Risks

- SDK event shapes may change by LangGraph version, so retain a raw event log.
- A missing dev server or invalid `.env` must fail visibly instead of silently.

## Acceptance Criteria

- The UI lists available assistants from the running LangGraph server.
- A user can create a thread, run the selected assistant, see streaming events, and delete the thread.
- Errors from missing server or invalid assistant are visible in the UI.

---

## 한국어

# 01 SDK 연결

## 코딩 범위

- 그래프: `graphs/01_sdk_connection.py`는 입력을 에코하고 작은 상태 업데이트를 내보내는 하나의 노드로 가장 간단한 보조 진입점을 노출합니다.
- 프런트엔드: `src/examples/01-sdk-connection/`는 보조 선택, 스레드 제어, 실행 제어 및 스트림 이벤트 로그를 제공합니다.
- 공유 코드: 구성 요소에 SDK 클라이언트를 구성하는 대신 재사용 가능한 LangGraph 클라이언트 유틸리티를 만듭니다.

## 구현 계획

1. `langgraph.json`에 `01_sdk_connection` 그래프를 등록합니다.
2. 어시스턴트, 스레드, 실행, 스트림 구독 및 오류 정규화를 위한 SDK 도우미를 추가합니다.
3. 서버 상태, 어시스턴트 목록, 스레드 생성/삭제/재사용, 실행 입력, 실행 상태 및 스트림 이벤트에 대한 UI 패널을 구축합니다.
4. 선택한 어시스턴트 및 현재 스레드를 로컬 구성 요소 상태에서만 유지합니다.

## SDK 및 상태 참고 사항

`Client.assistants.search`, 스레드 생성/가져오기/삭제 API, 실행 생성 및 스트리밍 이벤트를 사용하세요. 원시 이벤트 유형, 실행 ID, 상태 및 최종 값을 표시합니다.

## 위험

- SDK 이벤트 형태는 LangGraph 버전에 따라 변경될 수 있으므로 원시 이벤트 로그를 보관하십시오.
- 누락된 개발 서버 또는 유효하지 않은 `.env`는 자동으로 실패하는 대신 눈에 띄게 실패해야 합니다.

## 승인 기준

- UI에는 실행 중인 LangGraph 서버에서 사용 가능한 도우미가 나열됩니다.
- 사용자는 스레드 생성, 선택한 어시스턴트 실행, 스트리밍 이벤트 확인, 스레드 삭제 등을 할 수 있습니다.
- 누락된 서버 또는 유효하지 않은 어시스턴트로 인한 오류가 UI에 표시됩니다.


## EXAMPLES-LAYERS-06: 01-2-sdk-connection-react-hook

- `SdkConnectionReactHookExample.tsx`: screen composition and DOM event binding.
- `useSdkConnectionReactHook.ts`: SDK requests, stream callbacks, and derived view values.
- `useSdkConnectionReactHookState.ts`: local React state, refs, and related lifecycle/data transitions.
- `data.ts`: local types, fixtures, and data transformations.
- `ResultsPanels.tsx`: result, visualization, approval/history, and stream-event presentation.

### 한국어 책임 분리

진입 화면은 화면 구성과 DOM 이벤트를 연결하고, `useSdkConnectionReactHook`는 SDK 요청·스트림·파생값을 관리한다. `useSdkConnectionReactHookState`는 해당 예제의 독립적인 상태와 관련된 초기화·준비·데이터 반영을 관리한다. 데이터 변환·타입·고정값과 큰 결과 패널은 로컬 모듈로 분리한다. 기존 그래프 ID·입력·스트림 모드·표시 내용과 React hook 호출 순서를 보존하며 다른 예제 폴더를 가져오지 않는다.


## EXAMPLES-LAYERS-06: 01-sdk-connection

- `SdkConnectionExample.tsx`: screen composition and DOM event binding.
- `useSdkConnection.ts`: SDK requests, stream callbacks, and derived view values.
- `useSdkConnectionState.ts`: local React state, refs, and related lifecycle/data transitions.
- `ResultsPanels.tsx`: result, visualization, approval/history, and stream-event presentation.

### 한국어 책임 분리

진입 화면은 화면 구성과 DOM 이벤트를 연결하고, `useSdkConnection`는 SDK 요청·스트림·파생값을 관리한다. `useSdkConnectionState`는 해당 예제의 독립적인 상태와 관련된 초기화·준비·데이터 반영을 관리한다. 데이터 변환·타입·고정값과 큰 결과 패널은 로컬 모듈로 분리한다. 기존 그래프 ID·입력·스트림 모드·표시 내용과 React hook 호출 순서를 보존하며 다른 예제 폴더를 가져오지 않는다.
