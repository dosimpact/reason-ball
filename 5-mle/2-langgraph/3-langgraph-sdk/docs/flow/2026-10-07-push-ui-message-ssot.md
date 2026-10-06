# 2026-10-07 — UI-PUSH-SSOT-25: 화면 메시지 상태 통합

- 맥락: 사용자가 서버 messages, local drafts 및 pendingUser로 나뉜 화면 데이터 기준을 지적하고 단일 메시지 모델 방향을 제시함.
- 결정: 클라이언트 화면의 SSOT를 messages: ChatMessage[] 하나로 통합. 서버의 영속 상태와 화면 상태의 범위를 구분하고, 서버 원본 보관은 기존 finalState/events 진단에 한정함. 과거 원본 서버 메시지 + draft 설계를 대체함.
- 변경: chatMessages.ts의 분리된 원본/초안/파생 view 변환을 순수 reducer로 대체. usePushUiChatState는 메시지에 useReducer를 사용하며 나머지 상태는 유지. hook과 화면은 messages를 직접 전달/표시함. 구현 파일은 추가하지 않음.
- 갱신 규칙: 스트림은 running AI 메시지에만 누적. 서버 최종 내용은 전체 교체. 빈 running/failed placeholder는 부분 텍스트 보존. 완료/실패 후 조각 및 늦은 running placeholder 무시. 최종 snapshot은 서버 목록을 반영하면서 아직 확인되지 않은 입력/부분 답변을 기존 위치에 보존. 실패는 텍스트를 남기고 상태를 변경. reset은 메시지 배열 초기화.
- 영향 stock: docs/stock/system-design.md의 UI-PUSH-CHAT-25, UI-PUSH-LAYERS-25, UI-PUSH-STATUS-25, UI-PUSH-SSOT-25. plan 및 e2e-plan/25-push-ui-message.md 동기화. 제품 기능 자체는 유지하므로 business stock 변경 없음.
- 검증: /tmp/check_chat_ssot.cjs의 24개 회귀 점검 통과(낙관 입력, placeholder보다 빠른 조각, 최종 교체, 지연 이벤트, 실패 부분 답변, snapshot 순서, 불변성, reset). pnpm --filter langgraph-sdk-examples lint/build 통과. E2E_BASE_URL=http://localhost:59251 pnpm --filter langgraph-sdk-examples test:e2e e2e/25-push-ui-message.spec.ts --grep 'initial chat|isolated stream fixture' --output /tmp/push-ui-ssot-e2e-results: Chromium 3개 통과.
- 범위: E2E는 소유한 임시 Vite와 격리 스트림 fixture 사용. 실제 provider 기반 E2E는 이번 변경에서 재실행하지 않음. 빌드의 기존 큰 번들 경고 유지.
- 후속: 완료. 과거 flow의 분리 상태 설계/검증 기록은 수정하지 않음.
