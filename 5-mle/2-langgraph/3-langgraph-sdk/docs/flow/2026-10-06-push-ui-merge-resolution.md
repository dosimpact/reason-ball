# 2026-10-06 — UI-PUSH-MERGE-25: 공통 병합과 name별 처리 분리

- 맥락: 사용자가 `mergeUi` 공통 처리와 최종 UI name별 처리를 분리하도록 요청함.
- 변경: `mergeUi`는 ID 기준 추가·갱신·삭제, props의 얕은 부분 병합과 metadata 병합만 수행하고 이벤트 형태의 결과를 반환함. `resolveUi`가 등록된 이름의 스키마로 병합 결과를 검증하고 typed UI 또는 fallback으로 변환함. 상태 반영의 경계에서 `mergeUi(...).map(resolveUi)`로 연결함.
- 확장 지점: `uiDefinitions`에 `defineUi(name, objectSchema)` 추가. supported message 타입은 등록 목록에서 추론됨. name 전용 렌더링이 필요하면 화면에 해당 표시 처리를 추가하며, 아직 표시 처리가 없는 이름은 JSON fallback 사용.
- 일관성: `normalizeUi`도 등록 목록을 사용하여 전체/부분 payload 검증. 오류 시 진행 상태 변경과 최종 답변 작성 대기는 thinking_status에만 적용함. 같은 ID의 이름이 바뀌면 이전 종류의 props/metadata를 계승하지 않음.
- 이유: UI 종류가 늘어나도 공통 병합 로직을 수정하지 않도록 책임 분리. 기존 구현 파일만 수정하여 파일 수를 늘리지 않음.
- 영향 stock: `docs/stock/system-design.md`의 UI-PUSH-TYPES-25와 UI-PUSH-MERGE-25. 제품의 기존 채팅 동작은 유지함.
- 검증: scoped lint/build 통과. `/tmp/check_ui_registry.cjs`의 21개 점검 통과. 기존 UI 회귀와 테스트용 counter 등록을 통한 부분 업데이트·검증·fallback·이름 변경·삭제 확인. counter를 메모리에서 등록한 소스로 실제 프로젝트 전체 타입 검사도 통과하여 렌더러의 타입 좁히기 확인. 테스트용 UI는 실제 소스에 추가하지 않음.
- 범위: 실제 provider/browser 검증은 수행하지 않음. 기존 큰 번들 경고 유지. 병합은 deep merge가 아닌 얕은 props 병합임.
- 후속: 완료.
