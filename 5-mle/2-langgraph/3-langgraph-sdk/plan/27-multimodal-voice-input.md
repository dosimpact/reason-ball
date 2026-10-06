# 27 Multimodal Voice Input

## Coding Scope

- Graph: `graphs/27_multimodal_voice_input.py` receives transcribed or uploaded voice input.
- Frontend: `src/examples/27-multimodal-voice-input/` supports record/upload and transcription preview.

## Implementation Plan

1. Implement browser audio capture or file upload with duration display.
2. Transcribe audio before or inside the graph depending on provider support.
3. Let the user review transcription before final graph run.
4. Show final answer tied to the original audio input.

## SDK And State Notes

Store audio metadata, transcription text, confidence when available, and graph response. Use small fixtures for tests.

## Risks

- Browser microphone permissions can make E2E flaky; include upload-based fallback.
- Audio transcription model availability depends on provider configuration.

## Acceptance Criteria

- Voice input becomes text or structured input for a graph run.
- Users can inspect transcription before sending.
- Upload/record errors are visible and recoverable.

---

## 한국어

# 27 다중 모드 음성 입력

## 코딩 범위

- 그래프: `graphs/27_multimodal_voice_input.py`는 복사되거나 업로드된 음성 입력을 받습니다.
- 프론트엔드: `src/examples/27-multimodal-voice-input/`는 녹음/업로드 및 전사 미리보기를 지원합니다.

## 구현 계획

1. 기간 표시를 통해 브라우저 오디오 캡처 또는 파일 업로드를 구현합니다.
2. 공급자 지원에 따라 그래프 앞이나 그래프 내부의 오디오를 녹음합니다.
3. 최종 그래프가 실행되기 전에 사용자가 기록을 검토하도록 합니다.
4. 원본 오디오 입력과 연결된 최종 답변을 표시합니다.

## SDK 및 상태 참고 사항

오디오 메타데이터, 전사 텍스트, 신뢰도(가능한 경우) 및 그래프 응답을 저장합니다. 테스트에는 작은 테스트 픽스처를 사용하십시오.

## 위험

- 브라우저 마이크 권한으로 인해 E2E가 불안정해질 수 있습니다. 업로드 기반 대체를 포함합니다.
- 오디오 전사 모델 가용성은 공급자 구성에 따라 다릅니다.

## 승인 기준

- 음성 입력은 그래프 실행을 위한 텍스트 또는 구조화된 입력이 됩니다.
- 사용자는 보내기 전에 전사를 검사할 수 있습니다.
- 업로드/녹화 오류가 표시되고 복구 가능합니다.


## EXAMPLES-LAYERS-06: Independent frontend modules / 독립적인 프런트엔드 모듈

The entry composes local layers; request payloads, graph IDs, stream modes, state replacement/merge rules, DOM selectors, and user interactions are preserved. No new sibling-example imports.

진입 화면은 예제 내부 계층을 조합한다. 요청값·그래프 ID·스트림 모드·상태 교체/병합·DOM 선택자·사용자 동작을 보존하고 다른 예제에 대한 새 의존성을 만들지 않는다.

| Module / 모듈 | Role / 역할 |
|---|---|
| `AudioMetadata.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `AudioPreview.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `MultimodalVoiceInputExample.tsx` | Screen composition / 화면 구성 |
| `RuntimeControls.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `RunDiagnostics.tsx` | Final state and raw stream diagnostics / 최종 상태와 원시 스트림 진단 |
| `TranscriptionPreview.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `VoiceAnalysisStatus.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `VoiceEvents.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `VoiceResponse.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `media.ts` | Browser file/audio/canvas operations / 브라우저 파일·오디오·캔버스 처리 |
| `model.ts` | Pure types, fixtures, parsing and selectors / 순수 타입·자료·파싱·선택 |
| `sampleAudio.ts` | Unchanged audio fixture / 기존 오디오 자료 유지 |
| `useMultimodalVoiceInput.ts` | SDK requests and stream orchestration / SDK 요청과 스트림 처리 |
| `useMultimodalVoiceInputState.ts` | Local state and transitions / 로컬 상태와 전환 |

State hooks group startRun/failRun while retaining independent field updates. Controllers expose only view-used values/actions. Runtime controls bind form/file events, and example 31 translates drag DOM events into a moveStep command in its board view.
상태 훅은 startRun/failRun을 묶고 개별 필드 갱신은 유지한다. 요청 훅은 화면에서 쓰는 값과 동작만 공개한다. 컨트롤은 폼·파일 이벤트를 연결하며 31번 보드 화면은 드래그 DOM 이벤트를 moveStep 명령으로 변환한다.

Checks: scoped TypeScript lint passes. Static source comparison confirms unchanged SDK calls/payloads/modes, static DOM selectors and pure parsing helper bodies. Production build is integrated by the parent agent. No new tests or live-provider browser checks were performed.
검증: 범위 내 TypeScript 검사 통과. 소스 비교로 SDK 호출·요청값·모드, 고정 DOM 선택자, 순수 파싱 함수 본문을 보존했음을 확인했다. 프로덕션 빌드는 상위 에이전트가 통합한다. 테스트 추가 및 실제 provider 브라우저 검증은 수행하지 않았다.
