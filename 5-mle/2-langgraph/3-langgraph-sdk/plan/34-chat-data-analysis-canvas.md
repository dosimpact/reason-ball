# 34 Chat Data Analysis Canvas

## Coding Scope

- Graph: `graphs/34_chat_data_analysis_canvas.py` combines code tool execution, structured output, retry, and sandboxing.
- Frontend: `src/examples/34-chat-data-analysis-canvas/` renders dataset, generated code, charts, logs, and insights.

## Implementation Plan

1. Add CSV upload and dataframe preview.
2. Generate analysis code from chat instructions.
3. Execute code in a controlled environment and capture logs, tables, and chart artifacts.
4. Render insight summary with links to generated outputs.

## SDK And State Notes

Keep uploaded data metadata, generated code, execution results, chart specs, and retry state separate.

## Risks

- Uploaded CSV data can be large or malformed; validate before execution.
- Analysis code execution must be sandboxed and time-limited.

## Acceptance Criteria

- A CSV can be uploaded and previewed.
- Generated analysis produces visible table or chart output.
- Failed code execution triggers retry or clear error display.

---

## 한국어

# 34 채팅 데이터 분석 캔버스

## 코딩 범위

- 그래프: `graphs/34_chat_data_analysis_canvas.py`는 코드 도구 실행, 구조화된 출력, 재시도 및 샌드박싱을 결합합니다.
- 프런트엔드: `src/examples/34-chat-data-analysis-canvas/`는 데이터 세트, 생성된 코드, 차트, 로그 및 통찰력을 렌더링합니다.

## 구현 계획

1. CSV 업로드 및 데이터프레임 미리보기를 추가합니다.
2. 채팅 지침에서 분석 코드를 생성합니다.
3. 통제된 환경에서 코드를 실행하고 로그, 테이블, 차트 아티팩트를 캡처합니다.
4. 생성된 출력에 대한 링크가 포함된 통찰력 요약을 렌더링합니다.

## SDK 및 상태 참고 사항

업로드된 데이터 메타데이터, 생성된 코드, 실행 결과, 차트 사양 및 재시도 상태를 별도로 유지하세요.

## 위험

- 업로드된 CSV 데이터가 크거나 형식이 잘못되었을 수 있습니다. 실행하기 전에 유효성을 검사하십시오.
- 분석 코드 실행은 샌드박스 처리되어야 하며 시간 제한이 있어야 합니다.

## 승인 기준

- CSV를 업로드하고 미리 볼 수 있습니다.
- 생성된 분석은 가시적인 테이블 또는 차트 출력을 생성합니다.
- 실패한 코드 실행으로 인해 재시도가 발생하거나 오류 표시가 지워집니다.


## EXAMPLES-LAYERS-06: Independent frontend modules / 독립적인 프런트엔드 모듈

The entry composes local layers; request payloads, graph IDs, stream modes, state replacement/merge rules, DOM selectors, and user interactions are preserved. No new sibling-example imports.

진입 화면은 예제 내부 계층을 조합한다. 요청값·그래프 ID·스트림 모드·상태 교체/병합·DOM 선택자·사용자 동작을 보존하고 다른 예제에 대한 새 의존성을 만들지 않는다.

| Module / 모듈 | Role / 역할 |
|---|---|
| `AnalysisEvents.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `AnalysisStatus.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `AnalysisSteps.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `ArtifactCanvas.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `ChatDataAnalysisCanvasExample.tsx` | Screen composition / 화면 구성 |
| `ChatTranscript.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `DatasetPreview.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `GeneratedCode.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `Insights.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `ResultTable.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `RetryControls.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `RuntimeControls.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `SandboxLogs.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `RunDiagnostics.tsx` | Final state and raw stream diagnostics / 최종 상태와 원시 스트림 진단 |
| `model.ts` | Pure types, fixtures, parsing and selectors / 순수 타입·자료·파싱·선택 |
| `useChatDataAnalysisCanvas.ts` | SDK requests and stream orchestration / SDK 요청과 스트림 처리 |
| `useChatDataAnalysisCanvasState.ts` | Local state and transitions / 로컬 상태와 전환 |

State hooks group startRun/failRun while retaining independent field updates. Controllers expose only view-used values/actions. Runtime controls bind form/file events, and example 31 translates drag DOM events into a moveStep command in its board view.
상태 훅은 startRun/failRun을 묶고 개별 필드 갱신은 유지한다. 요청 훅은 화면에서 쓰는 값과 동작만 공개한다. 컨트롤은 폼·파일 이벤트를 연결하며 31번 보드 화면은 드래그 DOM 이벤트를 moveStep 명령으로 변환한다.

Checks: scoped TypeScript lint passes. Static source comparison confirms unchanged SDK calls/payloads/modes, static DOM selectors and pure parsing helper bodies. Production build is integrated by the parent agent. No new tests or live-provider browser checks were performed.
검증: 범위 내 TypeScript 검사 통과. 소스 비교로 SDK 호출·요청값·모드, 고정 DOM 선택자, 순수 파싱 함수 본문을 보존했음을 확인했다. 프로덕션 빌드는 상위 에이전트가 통합한다. 테스트 추가 및 실제 provider 브라우저 검증은 수행하지 않았다.
