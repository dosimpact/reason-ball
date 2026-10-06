# 28 Multimodal Voice Output

## Coding Scope

- Graph: `graphs/28_multimodal_voice_output.py` produces text plus audio output metadata.
- Frontend: `src/examples/28-multimodal-voice-output/` renders an inline audio player.

## Implementation Plan

1. Generate a normal assistant text response first.
2. Produce audio from the response with a provider-supported TTS path.
3. Store audio URL or blob metadata with the message.
4. Render play, pause, loading, and error states inside the chat bubble.

## SDK And State Notes

Keep audio generation errors separate from text response success. Avoid autoplay.

## Risks

- TTS latency may be high; the UI needs explicit generating and failed states.
- Audio blobs or URLs need cleanup to avoid memory leaks.

## Acceptance Criteria

- Each generated audio response is linked to its text answer.
- Audio can be played and stopped in the UI.
- Text output still works if audio generation fails.

---

## 한국어

# 28 다중 모드 음성 출력

## 코딩 범위

- 그래프: `graphs/28_multimodal_voice_output.py`는 텍스트와 오디오 출력 메타데이터를 생성합니다.
- 프런트엔드: `src/examples/28-multimodal-voice-output/`는 인라인 오디오 플레이어를 렌더링합니다.

## 구현 계획

1. 먼저 일반 어시스턴트 텍스트 응답을 생성합니다.
2. 공급자가 지원하는 TTS 경로를 사용하여 응답에서 오디오를 생성합니다.
3. 메시지와 함께 오디오 URL 또는 Blob 메타데이터를 저장합니다.
4. 채팅 풍선 내에서 재생, 일시 중지, 로드 및 오류 상태를 렌더링합니다.

## SDK 및 상태 참고 사항

오디오 생성 오류를 텍스트 응답 성공과 별도로 유지하세요. 자동재생을 피하세요.

## 위험

- TTS 대기 시간이 길 수 있습니다. UI에는 명시적인 생성 및 실패 상태가 필요합니다.
- 메모리 누수를 방지하려면 오디오 blob 또는 URL을 정리해야 합니다.

## 승인 기준

- 생성된 각 오디오 응답은 텍스트 답변에 연결됩니다.
- UI에서 오디오를 재생하고 중지할 수 있습니다.
- 오디오 생성이 실패하더라도 텍스트 출력은 계속 작동합니다.


## EXAMPLES-LAYERS-06: Independent frontend modules / 독립적인 프런트엔드 모듈

The entry composes local layers; request payloads, graph IDs, stream modes, state replacement/merge rules, DOM selectors, and user interactions are preserved. No new sibling-example imports.

진입 화면은 예제 내부 계층을 조합한다. 요청값·그래프 ID·스트림 모드·상태 교체/병합·DOM 선택자·사용자 동작을 보존하고 다른 예제에 대한 새 의존성을 만들지 않는다.

| Module / 모듈 | Role / 역할 |
|---|---|
| `AudioMetadata.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `GeneratedAudio.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `MultimodalVoiceOutputExample.tsx` | Screen composition / 화면 구성 |
| `RuntimeControls.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `RunDiagnostics.tsx` | Final state and raw stream diagnostics / 최종 상태와 원시 스트림 진단 |
| `TextResponse.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `VoiceOutputEvents.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `VoiceOutputStatus.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `VoiceSettings.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `model.ts` | Pure types, fixtures, parsing and selectors / 순수 타입·자료·파싱·선택 |
| `useMultimodalVoiceOutput.ts` | SDK requests and stream orchestration / SDK 요청과 스트림 처리 |
| `useMultimodalVoiceOutputState.ts` | Local state and transitions / 로컬 상태와 전환 |

State hooks group startRun/failRun while retaining independent field updates. Controllers expose only view-used values/actions. Runtime controls bind form/file events, and example 31 translates drag DOM events into a moveStep command in its board view.
상태 훅은 startRun/failRun을 묶고 개별 필드 갱신은 유지한다. 요청 훅은 화면에서 쓰는 값과 동작만 공개한다. 컨트롤은 폼·파일 이벤트를 연결하며 31번 보드 화면은 드래그 DOM 이벤트를 moveStep 명령으로 변환한다.

Checks: scoped TypeScript lint passes. Static source comparison confirms unchanged SDK calls/payloads/modes, static DOM selectors and pure parsing helper bodies. Production build is integrated by the parent agent. No new tests or live-provider browser checks were performed.
검증: 범위 내 TypeScript 검사 통과. 소스 비교로 SDK 호출·요청값·모드, 고정 DOM 선택자, 순수 파싱 함수 본문을 보존했음을 확인했다. 프로덕션 빌드는 상위 에이전트가 통합한다. 테스트 추가 및 실제 provider 브라우저 검증은 수행하지 않았다.
