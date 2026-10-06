# 12 Structured Output UI

## Coding Scope

- Graph: `graphs/12_structured_output.py` adapts `09_structured_output`.
- Frontend: `src/examples/12-structured-output-ui/` renders JSON and form/table views.

## Implementation Plan

1. Define a schema for a practical extraction task.
2. Ask the model for structured output and validate it server-side.
3. Render raw JSON, validation status, and a human-friendly table or form.
4. Include invalid or partial result handling for learning.

## SDK And State Notes

Return schema name, parsed object, validation errors, and original model text when available.

## Risks

- Model output can be partially valid; preserve raw output for debugging.
- Schema changes can break tests unless fixtures and UI labels are updated together.

## Acceptance Criteria

- Valid structured output appears in raw and formatted views.
- Validation success or failure is explicit.
- The UI preserves enough raw data to debug malformed output.

---

## 한국어

# 12 구조화된 출력 UI

## 코딩 범위

- 그래프: `graphs/12_structured_output.py`는 `09_structured_output`를 적용합니다.
- 프런트엔드: `src/examples/12-structured-output-ui/`는 JSON 및 양식/테이블 보기를 렌더링합니다.

## 구현 계획

1. 실제 추출 작업을 위한 스키마를 정의합니다.
2. 모델에 구조화된 출력을 요청하고 서버측에서 유효성을 검사합니다.
3. 원시 JSON, 유효성 검사 상태, 인간 친화적인 테이블 또는 양식을 렌더링합니다.
4. 학습에 유효하지 않거나 부분적인 결과 처리를 포함합니다.

## SDK 및 상태 참고 사항

가능한 경우 스키마 이름, 구문 분석된 객체, 유효성 검사 오류 및 원본 모델 텍스트를 반환합니다.

## 위험

- 모델 출력은 부분적으로 유효할 수 있습니다. 디버깅을 위해 원시 출력을 보존합니다.
- 픽스처와 UI 레이블이 함께 업데이트되지 않으면 스키마 변경으로 인해 테스트가 중단될 수 있습니다.

## 승인 기준

- 유효한 구조화된 출력이 원시 및 형식화된 보기에 나타납니다.
- 검증 성공 또는 실패는 명시적입니다.
- UI는 잘못된 출력을 디버깅하기에 충분한 원시 데이터를 보존합니다.


## EXAMPLES-LAYERS-06: 12-structured-output-ui

- `StructuredOutputExample.tsx`: screen composition and DOM event binding.
- `useStructuredOutput.ts`: SDK requests, stream callbacks, and derived view values.
- `useStructuredOutputState.ts`: local React state, refs, and related lifecycle/data transitions.
- `data.ts`: local types, fixtures, and data transformations.
- `ResultsPanels.tsx`: result, visualization, approval/history, and stream-event presentation.

### 한국어 책임 분리

진입 화면은 화면 구성과 DOM 이벤트를 연결하고, `useStructuredOutput`는 SDK 요청·스트림·파생값을 관리한다. `useStructuredOutputState`는 해당 예제의 독립적인 상태와 관련된 초기화·준비·데이터 반영을 관리한다. 데이터 변환·타입·고정값과 큰 결과 패널은 로컬 모듈로 분리한다. 기존 그래프 ID·입력·스트림 모드·표시 내용과 React hook 호출 순서를 보존하며 다른 예제 폴더를 가져오지 않는다.
