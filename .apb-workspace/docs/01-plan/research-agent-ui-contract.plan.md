# research-agent-ui-contract Plan

## Goal

Describe the user-visible outcome this feature must deliver.

## AG-UI와 A2UI 구분

- **AG-UI**: 에이전트와 프런트엔드 사이에서 메시지, 실행 상태, 도구 호출, 사용자 입력을 양방향 이벤트로 전달하는 통신 프로토콜이다.
- **A2UI**: 에이전트가 폼, 카드, 버튼 같은 UI 구조를 선언적 JSON으로 생성하고 클라이언트가 네이티브 컴포넌트로 렌더링하게 하는 UI 명세다.
- 두 기술은 경쟁 관계가 아니다. AG-UI가 상호작용과 데이터 전달을 담당하고, 필요하면 그 위에서 A2UI로 동적 UI를 표현할 수 있다.

## Scope

- In scope:
- Out of scope:

## Verification

- Implementation scope:
- Public interfaces:
- External dependencies:
- Internal dependencies:
- Risky areas:

## Validation

- Core behavior works as designed.

### E2E 시나리오

- Given the feature is available, When the primary workflow is executed, Then the expected result is visible and persistent.

## Skills

### Gradate 단계

- TBD

### Validate 단계

- TBD
