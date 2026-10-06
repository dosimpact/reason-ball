# 2026-10-06 — UI-PUSH-READABILITY-25: 최소 파일 분리

- 맥락: 사용자가 기존 단일 TSX를 최소한으로 분리하고 예제 폴더에는 필요한 파일만 두도록 요청함. 이전 단일 파일 유지 요청을 대체하는 결정임.
- 변경: 구현 파일을 정확히 두 개로 구성. `PushUiMessageExample.tsx`는 화면과 로컬 표시 함수, 스크롤을 담당하고 `usePushUiChat.ts`는 상태·thread·요청·스트림·최종 서버 상태를 담당함. 타입 및 데이터 처리 함수는 hook 파일에 함께 유지하여 추가 파일을 만들지 않음. 중복된 placeholder ID 검사를 정리함.
- 이유: 화면과 비동기 실행 경계만 나눠 파일 수와 추상화를 최소화함.
- 보존: API 입력과 graph ID, thread 재사용, 메시지 ID 교체, 부분 UI 병합과 삭제, 오류 및 최종 상태 처리, 진행 details와 렌더링, 기존 public type export 경로.
- 영향 stock: `docs/stock/system-design.md`의 UI-PUSH-READABILITY-25를 두 파일 구조로 갱신. 동작이 동일하므로 business stock은 유지함.
- 검증: `pnpm --filter langgraph-sdk-examples lint`, `pnpm --filter langgraph-sdk-examples build` 통과. 분리 직전 소스와 정규화·병합·메시지 교체를 비교하고 6가지 상태(빈 채팅, 진행, 최종 작성 대기, 실패, 완료, 알 수 없는 UI)의 React 서버 렌더링 HTML 동일성을 확인한 21개 점검 통과. 검증 도구는 `/tmp/check_push_ui_split.cjs`에 작성하여 예제 폴더에 테스트/보조 파일을 추가하지 않음.
- 범위: 실제 API/provider 및 브라우저 스트리밍 검증은 수행하지 않음. 빌드의 기존 큰 번들 경고는 유지됨.
- 후속: 완료. 이전 단일 파일 구성은 `2026-10-06-push-ui-readability.md`의 과거 기록으로 유지함.
