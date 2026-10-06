# 2026-10-06 — UI-PUSH-READABILITY-25

- 맥락: 사용자가 25번 TSX의 가독성 개선을 요청하고 파일 하나를 유지하도록 지정함.
- 변경: 같은 파일 안에서 타입 및 데이터 처리 → 메시지 표시 → 채팅 실행과 화면 구성으로 정리함. 여러 상태 변경을 한 줄에 압축한 코드를 풀고, 메시지 병합과 실패 처리, 표시 조건에 이름을 붙임. 로컬 ChatMessageBubble과 ProgressStatusIcon으로 JSX 중첩을 줄임.
- 이유: 파일 수를 늘리지 않고 스트림 처리 순서와 표시 책임을 읽기 쉽게 만듦.
- 동작: thread 재사용, updates/custom 처리, 서버 최종 상태 확정, Assistant ID, 부분 UI 병합, 오류 상태, 기본 닫힘인 진행 details 및 최종 답변 표시는 유지함.
- 영향 stock: `docs/stock/system-design.md`의 UI-PUSH-READABILITY-25. 제품 동작 변경이 없으므로 business stock은 유지함.
- 검증: `pnpm --filter langgraph-sdk-examples lint`, `pnpm --filter langgraph-sdk-examples build` 통과. 임시 Node 검증 도구로 편집 직전 소스와 비교한 21개 점검 통과: 정규화, 부분 UI 병합/삭제, ID별 메시지 교체, 빈 채팅/진행/최종 작성 대기/실패/완료/지원하지 않는 UI의 동일한 HTML 렌더링. 새 테스트 파일이나 구현 파일은 추가하지 않음.
- 범위: 렌더링 비교는 React 서버 렌더링 기반이며 실제 브라우저 스트리밍/provider 검증은 아님. 빌드의 기존 큰 번들 경고는 유지됨.
- 후속: 완료. 기존 live E2E 대기 항목은 유지함.
