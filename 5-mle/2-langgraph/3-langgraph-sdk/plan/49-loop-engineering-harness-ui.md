# 49 Loop Engineering Harness UI

## Coding Scope

- Graph: `graphs/49_loop_engineering_harness.py` models the loop stack from LangChain's "The Art of Loop Engineering" as a deterministic local graph.
- Frontend: `src/examples/49-loop-engineering-harness-ui/` renders trigger intake, agent work, verification retries, event traces, and hill-climbing suggestions.

## Implementation Plan

1. Normalize a manual, webhook, or cron-style trigger into a shared run event.
2. Run an agent work node that creates a draft, records mock tool calls, and emits trace events.
3. Evaluate the draft with a rubric, route failed attempts back through the agent loop, and stop at pass or max attempts.
4. Analyze the run trace to generate prompt, rubric, and tool improvement suggestions.
5. Register the graph, route, metadata, and progress records as example 49.

## Graph Requirements

- State includes `task`, `trigger`, `attempts`, `tool_calls`, `verification_results`, `trace_events`, `improvement_suggestions`, `final_answer`, and `stop_reason`.
- The first attempt should fail by design when retry budget allows, so the verification loop is visible without relying on an external model.
- Tool calls are local mock calls only; the example must not require external services or LangSmith deployment features.
- Custom events use `type: "loop_engineering_event"` and identify the active loop.

## Frontend Behavior

- The screen shows controls on the left, a four-loop stack in the center, and trace/analysis panels on the right.
- Users can choose `manual`, `webhook`, or `cron`, set `max_attempts`, set `quality_threshold`, and run the graph.
- Attempt cards show draft text, tool calls, verifier score, pass/fail verdict, and retry reason.
- Hill-climbing suggestions are shown separately from the final answer.

## SDK And State Notes

Use `updates`, `values`, and `custom` stream modes. The final state is authoritative; custom events are used for the live timeline only. Treat attempts and verifier results as replaceable state snapshots from the graph.

## Risks

- The concept overlaps with examples 15, 20, and 48, so the UI must emphasize the complete loop harness rather than a single evaluator loop.
- Too much raw state can make the page hard to scan; keep the primary panels focused on loop status and move raw payloads to collapsible event logs.

## Acceptance Criteria

- Example 49 appears in navigation as `Loop Engineering Harness`.
- A webhook or cron trigger run shows all four loop categories.
- At least one retry appears when `max_attempts` is greater than 1.
- Final answer, stop reason, trace events, verification results, and improvement suggestions render without external API keys.

---

## 한국어

# 49 루프 엔지니어링 하네스 UI

## 코딩 범위

- 그래프: `graphs/49_loop_engineering_harness.py`는 LangChain의 "The Art of Loop Engineering"의 루프 스택을 결정론적 로컬 그래프로 모델링합니다.
- 프런트엔드: `src/examples/49-loop-engineering-harness-ui/`는 트리거 수신, 에이전트 작업, 확인 재시도, 이벤트 추적 및 언덕 오르기 제안을 렌더링합니다.

## 구현 계획

1. 수동, 웹후크 또는 cron 스타일 트리거를 공유 실행 이벤트로 정규화합니다.
2. 초안을 생성하고, 모의 도구 호출을 기록하고, 추적 이벤트를 내보내는 에이전트 작업 노드를 실행합니다.
3. 기준표를 사용하여 초안을 평가하고, 실패한 시도를 에이전트 루프를 통해 다시 라우팅하고, 통과 또는 최대 시도에서 중지합니다.
4. 실행 추적을 분석하여 프롬프트, 루브릭 및 도구 개선 제안을 생성합니다.
5. 예제 49와 같이 그래프, 경로, 메타데이터, 진행 기록을 등록합니다.

## 그래프 요구 사항

- 상태에는 `task`, `trigger`, `attempts`, `tool_calls`, `verification_results`, `trace_events`, `improvement_suggestions`, `final_answer` 및 `stop_reason`가 포함됩니다.
- 재시도 예산이 허용되면 첫 번째 시도는 설계상 실패해야 하므로 외부 모델에 의존하지 않고도 검증 루프가 표시됩니다.
- 도구 호출은 로컬 모의 호출일 뿐입니다. 예제에는 외부 서비스나 LangSmith 배포 기능이 필요하지 않아야 합니다.
- 사용자 정의 이벤트는 `type: "loop_engineering_event"`를 사용하고 활성 루프를 식별합니다.

## 프론트엔드 동작

- 화면 왼쪽에는 컨트롤, 중앙에는 4루프 스택, 오른쪽에는 추적/분석 패널이 표시됩니다.
- 사용자는 `manual`, `webhook` 또는 `cron`를 선택하고 `max_attempts`를 설정하고 `quality_threshold`를 설정하고 그래프를 실행할 수 있습니다.
- 시도 카드에는 초안 텍스트, 도구 호출, 검증자 점수, 통과/실패 판정 및 재시도 이유가 표시됩니다.
- 언덕 오르기 제안은 최종 답변과 별도로 표시됩니다.

## SDK 및 상태 참고 사항

`updates`, `values` 및 `custom` 스트림 모드를 사용합니다. 최종 상태는 신뢰할 수 있습니다. 사용자 정의 이벤트는 라이브 타임라인에만 사용됩니다. 시도 및 검증자 결과를 그래프의 교체 가능한 상태 스냅샷으로 처리합니다.

## 위험

- 개념이 예제 15, 20, 48과 겹치므로 UI는 단일 평가자 루프가 아닌 완전한 루프 하네스를 강조해야 합니다.
- 원시 상태가 너무 많으면 페이지를 스캔하기 어려울 수 있습니다. 기본 패널을 루프 상태에 집중하고 원시 페이로드를 축소 가능한 이벤트 로그로 이동합니다.

## 승인 기준

- 예제 49는 탐색에 `Loop Engineering Harness`로 나타납니다.
- 웹후크 또는 크론 트리거 실행은 네 가지 루프 범주를 모두 표시합니다.
- `max_attempts`가 1보다 큰 경우 최소 한 번의 재시도가 나타납니다.
- 최종 답변, 중지 이유, 추적 이벤트, 검증 결과, 개선 제안은 외부 API 키 없이 렌더링됩니다.


## EXAMPLES-LAYERS-06: Independent frontend modules / 독립적인 프런트엔드 모듈

The entry composes local layers; request payloads, graph IDs, stream modes, state replacement/merge rules, DOM selectors, and user interactions are preserved. No new sibling-example imports.

진입 화면은 예제 내부 계층을 조합한다. 요청값·그래프 ID·스트림 모드·상태 교체/병합·DOM 선택자·사용자 동작을 보존하고 다른 예제에 대한 새 의존성을 만들지 않는다.

| Module / 모듈 | Role / 역할 |
|---|---|
| `ArtifactCanvas.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `ArtifactInspector.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `LoopEngineeringHarnessExample.tsx` | Screen composition / 화면 구성 |
| `RuntimeControls.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `RunDiagnostics.tsx` | Final state and raw stream diagnostics / 최종 상태와 원시 스트림 진단 |
| `model.ts` | Pure types, fixtures, parsing and selectors / 순수 타입·자료·파싱·선택 |
| `presentation.tsx` | Presentation helpers / 화면 표시 도우미 |
| `useLoopEngineeringHarness.ts` | SDK requests and stream orchestration / SDK 요청과 스트림 처리 |
| `useLoopEngineeringHarnessState.ts` | Local state and transitions / 로컬 상태와 전환 |

State hooks group startRun/failRun while retaining independent field updates. Controllers expose only view-used values/actions. Runtime controls bind form/file events, and example 31 translates drag DOM events into a moveStep command in its board view.
상태 훅은 startRun/failRun을 묶고 개별 필드 갱신은 유지한다. 요청 훅은 화면에서 쓰는 값과 동작만 공개한다. 컨트롤은 폼·파일 이벤트를 연결하며 31번 보드 화면은 드래그 DOM 이벤트를 moveStep 명령으로 변환한다.

Checks: scoped TypeScript lint passes. Static source comparison confirms unchanged SDK calls/payloads/modes, static DOM selectors and pure parsing helper bodies. Production build is integrated by the parent agent. No new tests or live-provider browser checks were performed.
검증: 범위 내 TypeScript 검사 통과. 소스 비교로 SDK 호출·요청값·모드, 고정 DOM 선택자, 순수 파싱 함수 본문을 보존했음을 확인했다. 프로덕션 빌드는 상위 에이전트가 통합한다. 테스트 추가 및 실제 provider 브라우저 검증은 수행하지 않았다.
