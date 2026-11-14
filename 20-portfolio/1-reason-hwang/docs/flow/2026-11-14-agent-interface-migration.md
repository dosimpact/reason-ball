# 공통 OpenUI AgentInterface 이관

- 날짜: 2026-11-14
- 결정 ID: OPENUI-AGENT-001
- 배경: LangGraph를 사용하는 Host 채팅마다 자체 입력창과 대화 목록이 존재했다. 표준 OpenUI AgentInterface로 일관된 채팅 UI를 제공하도록 이관한다.
- 변경: `shared/ui/agent-conversation`이 AgentInterface, Composer, 메시지 목록, 헤더, 테마를 제공한다. `/chat`, `/sec-chat`, `/open-ui/{dynamic,fixed,sec}`, `/examples/push-ui-message`가 이를 사용한다. `/sec-api-agent`는 기존 native AgentInterface 구성을 유지한다.
- 이유: 화면별 전송과 검증된 업무 결과를 보존하면서 공통 채팅 UI를 사용한다. ChatLLM adapter가 기존 controller로 보내고, SyncMessages와 AssistantMessage 확장 렌더러가 도메인 메시지·차트·근거·controls를 표시한다. 기존 stream parser는 계속 전송을 소비한다.
- 경계: 카탈로그와 비채팅 화면, 서버 API·업무 계산·인용 검증 계약은 변경하지 않는다. 영구 대화 저장 기능을 추가하지 않는다.

## 영향 stock

- [Host 공통 계약](../stock/tech-shared/1-fe-host/open-ui.md#openui-agent-001-공통-에이전트-인터페이스)
- [SEC Host](../stock/tech-shared/1-fe-host/sec-intelligent-ui.md)
- [SEC 대화](../stock/sec-chat.md), [SEC 업무 설계](../stock/us-corporate-filings/intelligent-ui.md)
- [기술적 분석](../stock/technical-analysis/system-design.md)
- [Push UI 예제](../stock/tech-shared/push-ui-message/INDEX.md)

## 검증 및 후속 상태

OPENUI-AGENT-001 시나리오: 각 채팅 화면에서 표준 Composer가 표시되고, 전송한 결과가 기존 도메인 renderer로 표시되며, 실행 중단과 새 대화 시 입력 초기화가 동작해야 한다.

- FE `pnpm typecheck`: PASS.
- FE `pnpm lint`: PASS. 기존 media.tsx img 경고 1개, Steiger 오류 없음.
- Storybook: 공통 AgentConversation, Generative Output, SEC AnswerView, Push TurnView 4개 파일 11개 테스트 PASS. 최종 draft 초기화 확인을 추가한 공통 Storybook 2개 재실행 PASS.
- `pnpm test:chat`: snapshot 회귀 1개 PASS.
- MCP 브라우저: `/sec-chat`, `/chat`, `/examples/push-ui-message`, `/open-ui/fixed`, `/open-ui/sec` 표준 Composer 확인. `/open-ui/dynamic`에서 fixture SSE를 전송하여 질문과 OpenUI 결과 표시 확인.
- MCP SEC fixture: resolve reply 표시, 새 대화 결과 제거, 작성 중 draft 초기화, native Cancel → controller abort와 중단 안내 확인.
- 병렬 리뷰에서 외부 화면 action 실행 중 Composer 활성/취소 누락과 draft 초기화 누락을 발견했다. 외부 busy guard와 별도 중단 버튼, Composer epoch 초기화로 수정했다. Push 질문 중복 표시도 제거했다.
- 최초 Storybook은 모바일 헤더에 새 대화가 없어 실패했다. 모바일에도 새 대화를 제공한 뒤 재실행 통과했다. 개발 중 HMR 전환에서의 hydration 오류는 client mount gate 및 최종 재탐색으로 확인했다.
- 서버 API 변경 없음: VAL-API-001 적용 대상 아님. VAL-VIEW-001은 Storybook, VAL-BROWSER-001은 MCP로 확인했다. 외부 모델·SEC·Yahoo의 실서비스 호출은 이번 UI 검증에서 실행하지 않았으며 fixture 성공과 구분한다.

E2E 결과와 최종 자원 정리는 후속 항목에 기록한다.

## 최종 E2E와 표시 검증

- `SEC_LIVE_BASE_URL=http://127.0.0.1:3280 pnpm -C 20-portfolio/1-reason-hwang/1-fe-host test:e2e tests/e2e/sec-conversation.spec.ts tests/e2e/chat.spec.ts --workers=1`: **7/7 PASS** (10.7s).
- SEC 6개: 전송·추천·reset·mobile, 기업 확인 후 원질문 유지, 오류 재시도, 취소, timeline, Markdown. LangGraph chat fixture 1개. 보고서: `1-fe-host/playwright-report/index.html`, `1-fe-host/test-results/sec-chat-report.json` (생성 산출물, 미커밋).
- 초기 E2E에서 모바일 overflow와 기업 선택 클릭 실패를 발견했다. 공통 scoped embedding CSS에서 container width/height/min-width, sidebar 숨김, thread padding을 적용하고 SEC의 이전 welcome을 native Welcome으로 옮겨 수정했다. 최종 모바일 390px에서 scrollWidth=390 확인.
- 첫 화면은 native Welcome의 기본 입력창, 대화 중에는 공통 Composer를 사용한다. 응답 실패·취소 후 입력 자동 복원 대신 제출 이력과 명시적 재입력으로 재시도한다. 새 대화는 Welcome·Composer의 draft도 초기화한다.
- 최종 레이아웃 변경 후 Storybook 4개 파일 11개 재실행 PASS. 타입 검사 PASS. scoped lint PASS(기존 img 경고 유지).
- [SEC 화면 스크린샷](evidence/agent-interface-2026-11-14/sec-chat.png)을 직접 열어 Host 안에서 화면과 입력창 배치를 확인했다.

## VAL-CLEANUP-001

- 소유한 FE 서버: port 3280, PID 28378/28395. 실행 세션의 종료 신호로 정상 종료 후 `ps`와 `lsof`에서 잔존 없음 확인.
- MCP Chrome: 공식 `browser_close` 수행 후 작업용 `mcp-chrome-a1ee1f0` 프로필 프로세스 잔존 없음 확인. 공유 MCP 서버는 유지.
- E2E 담당도 종료 후 `chrome-headless-shell`과 Playwright runner의 잔존 없음 확인. 기존 사용자 브라우저·서버는 종료하지 않았다.
- 기존 사용자 변경과 중간 사용자 커밋은 보존했다. 이 변경은 UI 계층과 관련 테스트·문서에 한정한다.
