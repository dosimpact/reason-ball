# A2UI 채팅 높이 제한

요구: 긴 Inline 대화가 페이지를 계속 확장하는 현상 수정. 현재 wrapper는 min-height:60vh만 제공하며 SDK chat은 height:100%이므로 높이 제한이 없었다.

설계: 공용 ChatViewport에 70dvh 높이, 최대900px, min-height:0을 적용한다. SDK 내부 메시지 스크롤과 입력창 배치를 유지한다. 외부 viewport overflow-y:auto는 작은 화면의 환영 영역이 넘칠 때도 입력 접근을 보장한다. SEC/Fixed/Dynamic 공용 프레임에 적용하며 surface ID/Canvas 정책은 변경하지 않는다. 기존 사용자 수정 demo.tsx의 max-w-[1600px]는 보존하고 커밋에서 제외한다.

검증: 실제 CopilotChatView 긴 메시지 Storybook, 2820 실제 SEC 공시 목록/후속 대화/모바일 내부 스크롤, typecheck/lint. 결과는 아래에 기록한다.

## 검증 결과

- `pnpm --filter reason-hwang-fe-host test:a2ui:views`:11파일95 PASS. 추가 Storybook은 실제 SDK CopilotChatView에30개 메시지를 렌더하고 높이 제한/내부 스크롤을 확인한다. Story args.children 타입 누락을 수정한 뒤 typecheck/lint도 PASS했다.
- MCP 실제2820,1440×1000: CPNG 검색 →공시 보기로5개 연간보고서 카드 표시. 채팅 높이700px 유지, 문서 높이는 전후1053px로 동일. 내부 scrollHeight1432px/clientHeight698px. 마우스 wheel로 맨 위를 열람할 때 입력창 y907/높이48이 그대로 유지됨을 확인했다.
- 모바일390×844: 채팅590.8px, 내부 content1598px/clientHeight589px. document.scrollWidth390으로 가로 넘침 없음. 입력창 접근 가능.
- [데스크톱](evidence/2026-09-23-chat-height/desktop.png), [모바일](evidence/2026-09-23-chat-height/mobile.png). 런타임/API/surface ID 정책 변경이 없어 Bruno 재실행 대상이 아니다.
- 공식 browser_close 후 owned Chrome25023 부재 및 임시 profile `playwright_chromiumdev_profile-jfrRSR` 삭제 확인. 공유 MCP99635 및 사용자2820 서버는 유지한다. Storybook 작업은 정상 종료했다.
- stock frontend와 INDEX 동기화. 변경 파일 diff/문서 링크 검사 후 높이 변경만 커밋하며 사용자의 기존1600px 너비 수정은 working tree에 남긴다.
