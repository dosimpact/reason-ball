# 제품 설계

## SAGA-001 Saga 생성형 UI

채팅과 모델이 생성하는 UI 전체를 Grafana Saga 디자인 시스템으로 통일한다. 공개 React 패키지 `@grafana/ui@13.3.0`의 유지되는 독립 실행 가능한 시각 컴포넌트를 OpenUI에 등록한다. deprecated/Legacy/graveyard, 비시각 API, Grafana 서비스 실행환경 의존 항목은 매니페스트에 사유를 명시한다.

모델은 등록된 스키마로 OpenUI 프로그램을 생성한다. Python LangGraph / DeepAgents가 모델과 mock 날씨·주가·검색 도구를 실행한다. 예제 수치는 샘플이며 실제 금융·날씨 서비스가 아니다.

## SAGA-002 갤러리와 채팅

`/gallery`에서 검색·분류와 light/dark 테마를 사용해 컴포넌트별 OpenUI 예제를 모델 호출 없이 확인한다. 입력·선택·모달 등의 상호작용을 실제로 실행한다. 채팅 기록은 Saga 전용 브라우저 저장소를 사용하고 기존 shadcn 기록과 분리한다. 새 질문과 후속 액션은 실제 모델을 호출한다.

## 검증 상태

지원 여부는 고정 버전의 컴포넌트 단위로 관리하며, 각 어댑터는 모델에서 사용할 수 있는 직렬화 가능한 props 부분집합을 노출한다. 모든 upstream props를 그대로 노출하는 API 호환 계층은 아니다. Saga 공개 컴포넌트 181개와 자체 SagaForm을 지원한다. 루트 SagaPage를 포함한 OpenUI 등록은 183개다. 브라우저 검증 결과는 [전환 기록](../flow/2026-11-10-saga-migration.md)에 기록한다.
