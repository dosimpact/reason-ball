# 26 Multimodal Image Input

## Coding Scope

- Graph: `graphs/26_multimodal_image_input.py` accepts image input and returns analysis.
- Frontend: `src/examples/26-multimodal-image-input/` provides upload, preview, and result display.

## Implementation Plan

1. Add image upload with type and size validation.
2. Convert the image to the format expected by the graph/model provider.
3. Run analysis and return structured observations.
4. Render preview, analysis text, and optional region notes.

## SDK And State Notes

Keep binary data handling isolated. Prefer fixture images for tests and avoid committing private uploads.

## Risks

- Large images can exceed request limits; validate size before graph submission.
- Vision model support depends on configured model aliases.

## Acceptance Criteria

- A user can attach an image and see it before sending.
- The graph receives image input and returns a model-backed analysis.
- Invalid files produce clear validation errors.

---

## 한국어

# 26 다중 모드 이미지 입력

## 코딩 범위

- 그래프: `graphs/26_multimodal_image_input.py`는 이미지 입력을 받아들이고 분석을 반환합니다.
- 프런트엔드: `src/examples/26-multimodal-image-input/`는 업로드, 미리보기 및 결과 표시를 제공합니다.

## 구현 계획

1. 유형 및 크기 검증을 통해 이미지 업로드를 추가합니다.
2. 이미지를 그래프/모델 제공자가 예상하는 형식으로 변환합니다.
3. 분석을 실행하고 구조화된 관찰 결과를 반환합니다.
4. 미리보기, 분석 텍스트 및 선택적 영역 메모를 렌더링합니다.

## SDK 및 상태 참고 사항

바이너리 데이터 처리를 격리된 상태로 유지하세요. 테스트를 위해 픽스처 이미지를 선호하고 비공개 업로드 커밋을 피하세요.

## 위험

- 큰 이미지는 요청 제한을 초과할 수 있습니다. 그래프를 제출하기 전에 크기를 확인하세요.
- 비전 모델 지원은 구성된 모델 별칭에 따라 다릅니다.

## 승인 기준

- 사용자는 이미지를 첨부하여 전송하기 전에 확인할 수 있습니다.
- 그래프는 이미지 입력을 수신하고 모델 기반 분석을 반환합니다.
- 잘못된 파일은 명확한 유효성 검사 오류를 생성합니다.


## EXAMPLES-LAYERS-06: Independent frontend modules / 독립적인 프런트엔드 모듈

The entry composes local layers; request payloads, graph IDs, stream modes, state replacement/merge rules, DOM selectors, and user interactions are preserved. No new sibling-example imports.

진입 화면은 예제 내부 계층을 조합한다. 요청값·그래프 ID·스트림 모드·상태 교체/병합·DOM 선택자·사용자 동작을 보존하고 다른 예제에 대한 새 의존성을 만들지 않는다.

| Module / 모듈 | Role / 역할 |
|---|---|
| `ImageAnalysis.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `ImageAnalysisStatus.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `ImageEvents.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `ImageMetadata.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `ImagePreview.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `MultimodalImageInputExample.tsx` | Screen composition / 화면 구성 |
| `RegionNotes.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `RuntimeControls.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `RunDiagnostics.tsx` | Final state and raw stream diagnostics / 최종 상태와 원시 스트림 진단 |
| `media.ts` | Browser file/audio/canvas operations / 브라우저 파일·오디오·캔버스 처리 |
| `model.ts` | Pure types, fixtures, parsing and selectors / 순수 타입·자료·파싱·선택 |
| `useMultimodalImageInput.ts` | SDK requests and stream orchestration / SDK 요청과 스트림 처리 |
| `useMultimodalImageInputState.ts` | Local state and transitions / 로컬 상태와 전환 |

State hooks group startRun/failRun while retaining independent field updates. Controllers expose only view-used values/actions. Runtime controls bind form/file events, and example 31 translates drag DOM events into a moveStep command in its board view.
상태 훅은 startRun/failRun을 묶고 개별 필드 갱신은 유지한다. 요청 훅은 화면에서 쓰는 값과 동작만 공개한다. 컨트롤은 폼·파일 이벤트를 연결하며 31번 보드 화면은 드래그 DOM 이벤트를 moveStep 명령으로 변환한다.

Checks: scoped TypeScript lint passes. Static source comparison confirms unchanged SDK calls/payloads/modes, static DOM selectors and pure parsing helper bodies. Production build is integrated by the parent agent. No new tests or live-provider browser checks were performed.
검증: 범위 내 TypeScript 검사 통과. 소스 비교로 SDK 호출·요청값·모드, 고정 DOM 선택자, 순수 파싱 함수 본문을 보존했음을 확인했다. 프로덕션 빌드는 상위 에이전트가 통합한다. 테스트 추가 및 실제 provider 브라우저 검증은 수행하지 않았다.
