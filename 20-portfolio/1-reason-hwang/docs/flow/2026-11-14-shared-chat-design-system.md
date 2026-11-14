# 공통 채팅 디자인 시스템 통합

- 날짜: 2026-11-14
- 결정 ID: OPENUI-CHAT-DS-001
- 배경: 각 페이지가 OpenUI AgentInterface를 사용해도 외부 제목·폭·입력 영역·헤더 액션·상태·오류·CSS가 달라 화면 일관성이 부족했다.
- 변경: shared/ui/agent-conversation의 AgentChatFrame이 native와 controller 기반 채팅의 공통 표현 계층을 소유한다. AgentConversation은 domain controller adapter로 남는다. 같은 Welcome·Composer·헤더·상태·오류·toolbar·footer·테마·모바일 디자인을 사용한다.
- 일반 본문: ConversationText가 공유 OpenUI Markdown 카탈로그로 표시한다. chart/program/evidence/action은 화면별 renderer 확장으로 보존한다.
- 범위: SEC API Agent, SEC Intelligent UI, Chat, Generative UI의 채팅. 기존 서버 계약과 domain controller·근거·선택 제한·도구 타임라인·대화 보관 책임은 유지한다.
- FSD: 공통 UI는 shared/ui, 각 업무 연결은 _pages 아래 유지한다. 페이지별 프레임 CSS를 줄이고 도메인 요소 CSS만 남긴다.

## 영향 stock

- [Host 공통 디자인 시스템](../stock/tech-shared/1-fe-host/open-ui.md#openui-chat-ds-001-공통-채팅-디자인-시스템)
- [SEC Host 화면 비교와 책임](../stock/tech-shared/1-fe-host/sec-intelligent-ui.md)
- [SEC 공통 화면·테마 계약](../stock/sec-chat.md#공통-채팅-디자인-시스템)

## 검증 및 후속 상태

OPENUI-CHAT-DS-001 시나리오: 네 채팅 계열은 같은 frame/헤더/Welcome/Composer/새 대화와 theme을 사용하고, 기존 답변·도구 기록·근거·설정·action 동작을 유지해야 한다.

- `pnpm -C 1-fe-host typecheck`: PASS.
- `pnpm -C 1-fe-host lint`: PASS. 기존 media.tsx img 경고 1개 유지, Steiger0문제.
- Storybook: 공통 AgentConversation, SEC API page, GraphSelector, Generative Output, SEC AnswerView, Push TurnView 6파일 **15/15 PASS**. 전송·draft reset·외부 busy cancel·Markdown heading/table 포함.
- `SEC_LIVE_BASE_URL=http://127.0.0.1:3280 pnpm -C 1-fe-host test:e2e tests/e2e/shared-chat-design.spec.ts tests/e2e/sec-conversation.spec.ts tests/e2e/chat.spec.ts tests/e2e/sec-api-agent.spec.ts tests/e2e/host-theme.spec.ts --workers=1`: **15/15 PASS** (34.4s).
- 신규 shared 4경로: 공통 frame, Markdown, 전송, reset/draft 초기화, 모바일. 기존 SEC6개·Chat1개·SEC API2개·테마2개도 확인했다. SEC API 대화 기록 복원과 도구 타임라인 유지 확인.
- E2E 응답은 fixture를 사용했다. 실제 모델/Yahoo/SEC 호출은 이번 UI 리팩터링에서 실행하지 않았다. 외부 서비스 실검증과 구분한다. 기존 실서비스 Generative E2E는 새 visible Composer 선택자로 갱신했지만 실모델 시나리오는 실행하지 않았다.
- MCP: `/chat`, `/sec-chat`, `/sec-api-agent`, `/open-ui/dynamic`에서 공통 프레임과 표시 입력창 각1개 확인. 모바일 SEC API 390px에서 scrollWidth390, frame 폭390 확인. fixture Markdown heading1개/table1개 실제 표시 확인.
- [Chat](evidence/shared-chat-design-2026-11-14/chat.png), [SEC 채팅](evidence/shared-chat-design-2026-11-14/sec-chat.png), [SEC API](evidence/shared-chat-design-2026-11-14/sec-api-agent.png), [Generative UI](evidence/shared-chat-design-2026-11-14/generative-ui.png), [모바일](evidence/shared-chat-design-2026-11-14/mobile-sec-api-agent.png), [Markdown fixture](evidence/shared-chat-design-2026-11-14/markdown-fixture.png)를 직접 열어 검수했다.
- 첫 E2E에서 Next route announcer를 포함한 alert strict selector와 숨겨진 초기 Composer 선택자가 실패했다. 공통 frame으로 scope를 제한하고 visible 입력창을 사용하도록 수정했다. SEC API 초기 history timeout은 안정화한 source에서 재실행해 통과했다. 타입/lint의 초기 transient unused 변수 오류도 제거 후 최종 통과했다.
- VAL-VIEW-001=Storybook, VAL-BROWSER-001=MCP 및 E2E. 서버 API 계약 변경 없음으로 VAL-API-001 대상 변경 없음. HTML report는 `1-fe-host/playwright-report/index.html`, JSON은 `1-fe-host/test-results/sec-chat-report.json` (생성 산출물, 커밋하지 않음).

전달 방식의 차이는 adapter에 남겼다. 기존 SEC API의 페이지 수명 대화 저장, 일반 Chat의 그래프 선택, SEC의 공시 준비·근거·추천, demo의 revision action은 page 소유다. 공통 스크롤은 always로 두어 이전 user-anchor 빈 공간을 줄였다. 외부 action이 busy이고 SDK는 idle이면 Welcome을 숨기고 입력을 비활성화하며 취소 버튼을 제공한다. 새로운 원격 대화 복원·인증·데이터 저장 정책을 추가하지 않았다.

## 자원 정리

- 작업 소유 Next 서버 port3280, PID40813/40814: 실행 세션 종료 신호로 정상 종료, ps와 lsof 잔존 없음 확인.
- 작업 소유 MCP Chrome PID41143: 공식 browser_close 후 ps 잔존 없음 확인. 공유 MCP 서버는 유지했다.
- Storybook·E2E headless Chrome과 runner는 종료됐고 잔존 없음 확인. 기존 사용자 서버·브라우저는 종료하지 않았다.
- 기존 human-docs와 사용자 AGENTS.md 변경은 보존한다. 이번 source·stock·flow·PNG만 커밋한다.
