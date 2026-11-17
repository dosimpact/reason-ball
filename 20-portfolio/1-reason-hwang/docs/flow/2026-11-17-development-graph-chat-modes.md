# 2026-11-17 개발 채팅 graph ID·messages 모드 정리

CHAT-GRAPH-MODE-002. 개발 채팅 목록에 graph ID를 원문으로 표시한다. price_agent와 technical_analysis_graph를 chat으로 분류하고 추가 OHLCV 필요 안내를 표시한다. main_graph/tenk는 JSON 모드다. [Host stock](../stock/tech-shared/1-fe-host/open-ui.md#chat-graph-mode-002-개발-그래프-이름과-메시지-입력)에 반영했다.

검증: Host chat34 PASS, typecheck·관련 ESLint PASS, GraphSelector Storybook Chromium3 PASS. Playwright CLI1 PASS: ID 원문·두 그래프 채팅 입력·messages POST·응답·main/tenk JSON 전환. 소유32983 Host에 통제된 SDK HTTP fixture를 사용했으며 실제 모델 검증은 아니다.

필수 MCP 관찰은 두 번 모두 공유 프로필 사용 중 오류로 차단돼 미완료다. CLI/Storybook 통과로 MCP 검증을 대체했다고 주장하지 않는다. apb-playwright-e2e 스킬 적용. 공유 브라우저는 종료하지 않았다.

소유 Next32983 정상 종료, 자동 next-env/tsconfig 변경 원복, 전용 dist 제거·포트 해제 확인. 러너 소유 브라우저 종료. 기존 사용자 변경·이미지는 보존했다.
