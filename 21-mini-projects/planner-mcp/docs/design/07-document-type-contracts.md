# Scope와 타입별 작성 계약

상태: 구현 기준. 실제 JSON 스키마·예시는 get_catalog, 관계·비교와 Figma 연동은 [10](10-completion.md)을 따른다.

## 공통 문서와 scope

- 같은 프로젝트에서 같은 카탈로그 타입의 문서를 여러 개 생성할 수 있습니다.
- 각 문서는 title과 scope로 적용 범위를 구분하고 고유 documentId로 식별합니다.
- scope는 공통 Document 메타데이터로 두고 인덱스와 본문 조회에 모두 포함합니다.
- UI의 프로젝트 문서 목록과 문서 상세 제목 주변에 scope 배지를 표시합니다. 타입·승인 상태와 별도 표기합니다.
- 초기에는 비어 있지 않은 문자열 하나를 scope로 사용하는 방식을 사용합니다. 예: `campaign`, `budget`, `reporting`.
- scope를 바꿔도 documentId는 유지합니다. scope는 ID나 파일 경로, 승인 상태를 대신하지 않습니다.
- 같은 scope 아래 API·Figma·Flow 문서를 함께 둘 수 있습니다. scope 일치만으로 문서 의존 관계를 추론하지 않습니다.
- 같은 타입·같은 scope 안의 복수 문서도 허용합니다. 유일성은 documentId로 보장합니다.
- scope는 자유 문자열이며 앞뒤 공백을 제거하고 대소문자는 구분합니다. UI는 scope 필터를 제공합니다. 변경은 MCP 문서 갱신으로 수행합니다.

## API Spec 공통 계약

- Upstream API Spec과 BFF API Spec은 동일한 내용 구조·검증·UI 형식을 사용합니다.
- 기존 카탈로그의 두 항목은 유지하고 대상 계층으로 구분합니다. 공통 내용은 코드의 `apiSpec` 스키마로 검증합니다.
- 둘 다 기존 스펙과 변경 스펙을 관리할 수 있습니다.
- 기존 스펙과 변경 스펙은 `draft/reviewed/approved`와 별개입니다. 변경 스펙도 검토·승인될 수 있습니다.

### 내용 모델

- `schemaVersion`: 공통 내용 스키마 버전.
- `specKind`: `existing` 또는 `change`.
- `operations`: 각 API의 식별자, 이름, 프로토콜별 주소·작업명, 입력, 출력.
- 근거는 공통 Document의 `sourceIds`와 사실·가정별 `sourceIds`로 Project.sources를 참조하며 확인 시점은 해당 입력의 `capturedAt`으로 확인합니다. API content에 별도 `sources` 필드를 중복 저장하지 않습니다. 근거가 없는 사항은 가정으로 표시합니다.
- 변경 스펙에는 `baseDocumentId`, `baseRevision`, 변경 이유를 연결하고 변경 후 전체 명세를 저장하는 방식을 사용합니다.
- 단편적인 diff만으로 구현 문서를 재구성하지 않도록 변경 후 목표 명세를 제공합니다.
- 기준 버전이 없는 신규 API 변경안은 `specKind: change`와 `changeReason`으로 작성합니다. 기준을 지정할 때는 ID·revision을 함께 지정합니다.
- 오류는 operations.errors에 선택적으로 기록합니다. 별도 필드 매핑·API 조합 모델은 두지 않습니다.

### UI

- 두 타입에 같은 API 상세 렌더러를 사용하고 Upstream/BFF 계층과 기존/변경을 표시합니다.
- scope 배지, API 목록, 입력·출력 상세를 제공합니다.
- 변경 스펙의 기준 문서·버전 이동과 비교 보기를 제공합니다. 같은 프로젝트·타입의 실제 버전 참조를 검증하며 [10](10-completion.md)을 따릅니다.
- 카탈로그 타입 ID, 내용 schemaVersion, 문서 revision, specKind는 각각 역할이 다르며 서로 대체하지 않습니다.

## DB Entity

- 현재 Mermaid 엔티티·관계 표현을 유지합니다.
- 제약, 인덱스, 별도의 필드 설명은 초기 필수 범위에서 제외합니다. 이를 위해 추가 데이터 모델이나 입력 UI를 만들지 않습니다.
- 엔티티·관계와 기본 속성 표현은 유지합니다. 필드 설명 제외가 모든 속성 표현을 제거한다는 뜻은 아닙니다.
- 필요가 생기면 Mermaid 옆 보충 설명이나 다른 표현을 검토할 수 있으나 현재 대체 도구를 채택하지 않습니다.

## Weblogging Spec

요구 범위는 이벤트가 발생하는 조건, 무엇을 기록하는지, 각 기록 필드의 설명입니다.

- 발생 조건 예시: `view`, `click`, `adoption`. 고정된 전체 enum은 아니며 추가 조건을 표현할 수 있습니다.
- 이벤트 항목 필드: `id`, `eventName`, `trigger`, `condition`, `fields`.
- fields의 각 항목은 최소 필드 이름과 설명을 포함합니다. type과 required는 선택 필드이며 별도 example 필드는 제공하지 않습니다.
- trigger는 종류를, condition은 구체적 발생 순간을 설명합니다. 예: adoption / 추천 적용 요청이 성공했을 때.
- 예시의 성공 시점은 설명용이며 모든 adoption 이벤트의 강제 규칙이 아닙니다.
- UI는 이벤트별 발생 조건과 기록 필드 설명 표를 보여주는 방식을 사용합니다.
- 중복 전송 정책, 전송 파이프라인, 수집 도구·보관 정책은 현재 필수 범위에 넣지 않습니다.

## Figma Requirements

- 초기 관리 단위는 React 컴포넌트 관점의 widget입니다. 여러 Figma 화면을 widget 기준으로 정리합니다.
- 기존 UI Surface, Input Validation Requirement, UI Funnel Spec을 widget 관점에서 연결합니다.
- 내용에 `widgets` 배열을 두고 각 항목을 `widgetId`, `name`, `responsibility`, `figmaRefs`로 식별하는 방식을 사용합니다.
- 하나의 widget에 여러 화면·Figma 노드 참조를 연결할 수 있고, 한 화면에 여러 widget이 연결될 수 있습니다.
- `figmaRefs`에는 화면 이름, URL, 알려진 경우 node ID를 기록합니다. 직접 수집은 [10](10-completion.md)의 입력 보존 경계에서 수행합니다.
- widget별 표시 요소, 입력 검증 요구, 사용자 동작과 다른 widget·화면으로 이어지는 흐름을 기술합니다.
- 로딩·빈 상태·오류 상태는 입력에서 확인된 것만 기록하고 나머지는 질문으로 둡니다. 이번 결정으로 모든 상태를 필수화하지 않습니다.
- UI는 widget 목록과 상세, 연결된 Figma 화면·노드 링크를 표시하는 방식을 사용합니다.
- 문서의 widget은 관리 대상의 설계 단위입니다. Planner MCP 자체의 FSD 디렉터리를 생성하거나 Figma 프레임을 자동으로 코드 컴포넌트와 일대일 매핑하지 않습니다.
- `widgets` 배열은 문서당 하나 이상의 widget을 지원합니다.

## 적용 경계

- 카탈로그 작성 계약의 목적·입력·규칙·JSON 스키마·예시는 get_catalog가 제공합니다. 렌더러는 등록된 타입별 UI로 연결합니다.
- 문서 ID + Flow 노드 ID 참조와 변경 재검토 안내는 [10](10-completion.md)의 범위에서 채택했습니다. 임의의 모든 문서 항목을 연결하는 범용 관계 모델은 제공하지 않습니다.
- Flow Spec은 Overview와 Detail로 구분합니다. 비즈니스 핵심과 두 문서의 책임은 [Flow Spec 설계](04-flow-spec.md)가 원본이며 실행 가능한 분기 언어는 현재 범위가 아닙니다.

## 검증 기준

- 같은 타입의 문서를 여러 개 생성하고 인덱스와 상세에서 각각 scope 배지를 확인할 수 있습니다.
- 두 API 타입 모두 기존·변경 스펙을 표현하고 공통 스키마와 렌더러를 사용합니다.
- DB Entity는 제약·인덱스·필드 설명 없이 유효한 문서를 만들 수 있습니다.
- Weblogging의 발생 조건과 기록 필드별 설명이 저장·조회·UI에 보존됩니다.
- 여러 화면의 Figma 참조를 widget에 연결하고 widget별 요구사항을 조회할 수 있습니다.
