# 시스템 설계

## SAGA-001 런타임

Browser: Saga 채팅 화면 + sagaChatLibrary → AG-UI → Next.js `/api/chat` (:3048) → Python LangGraph (:2040) → model/mock tools → custom:openui → OpenUI 렌더러.

프런트엔드와 Python은 HTTP로 통신한다. Python은 패키지에 포함된 system-prompt.txt를 읽는다. 개발 시 `pnpm generate`로 카탈로그 spec과 프롬프트를 생성하고 `pnpm sync:prompt`로 백엔드에 복사한다. 런타임 파일 공유는 없다.

`frontend/src/lib/saga-genui`가 카탈로그와 매니페스트, 갤러리 예제의 기준이다. props는 직렬화 가능한 데이터로 구성하며 React callback과 Grafana 데이터 구조는 어댑터에서 생성한다. `frontend/src/library.ts`는 CLI 진입점이다. `/gallery`는 동일 카탈로그와 OpenUI 렌더러를 사용한다.

## 실행과 의존성

frontend는 pnpm-lock.yaml, backend-langgraph는 uv.lock을 사용한다. @grafana/ui와 @grafana/data는 13.3.0으로 고정한다. 프런트엔드 기본 포트는 3048, Python은 2040이다. LANGGRAPH_API_URL로 프록시 대상을 변경할 수 있다. OPENAI_API_KEY와 OPENAI_MODEL은 백엔드에 설정한다.

## 검증 경계

카탈로그 목록 완전성, 예제 파싱, 브라우저 렌더링, 사용자 상호작용, 실제 모델 생성은 각각 별도 증거로 확인한다. 단순 등록 또는 오류 경계의 대체 화면은 렌더링 성공으로 계산하지 않는다. [진행 기록](../flow/2026-11-10-saga-migration.md).

## SAGA-003 구현 경계

CLI는 브라우저 전용 Grafana 모듈을 평가하지 않는 schema factory를 사용하고 실제 렌더러도 같은 factory로 카탈로그를 만든다. 채팅 및 갤러리는 SSR이 비활성화된 client boundary에서 로드한다. 테마는 Grafana ThemeContext에 주입한다.

OpenUI headless ChatProvider가 대화와 AG-UI 상태를 관리한다. SagaForm은 deprecated Grafana Form을 대신하는 프로젝트 자체 어댑터로, HTML form과 Saga controls 및 OpenUI FormNameContext를 결합한다. 입력 상태의 이름과 폼 제출 상태를 일치시키며 비밀 입력은 로컬 컴포넌트 상태에만 둔다.

갤러리는 전체 매니페스트를 검색하되 활성 컴포넌트 한 개만 렌더링한다. 대량 동시 마운트로 브라우저가 멈추는 것을 방지하고 각 항목의 독립 검증을 가능하게 한다.

## SAGA-004 카탈로그 범위

고정 @grafana/ui 13.3.0의 stable runtime export 363개를 매니페스트와 대조한다. 현재 181개 공개 시각 컴포넌트를 지원하고 182개는 deprecated/legacy, 비시각 유틸리티/타입 지원 값, Grafana 실행환경 의존 등의 근거로 제외한다. 매니페스트에 개별 사유가 있다. 공개 VizTooltipColorIndicator는 React 컴포넌트가 아니라 enum이므로 제외한다. 외부 사용을 금지한 unstable entrypoint도 제외한다.

프로젝트 전용 SagaForm과 루트 SagaPage를 추가해 OpenUI 등록 컴포넌트는 183개, 갤러리 지원 예제는 182개다. 어댑터는 공개 props의 직렬화 가능한 부분집합을 제공한다.
