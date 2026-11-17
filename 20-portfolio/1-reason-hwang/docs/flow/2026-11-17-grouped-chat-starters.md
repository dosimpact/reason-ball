# 2026-11-17 채팅별 그룹 시작 질문

## 배경 · 변경

CHAT-STARTERS-002: 사용자가 AI Chat 메뉴 전체에 TA-Lib처럼 충분한 시작 질문과 그룹을 요청했다. 기존 공통 `starterGroups`를 재사용하고 페이지별 질문 데이터만 추가했다. 서버 계약·도구 권한·컴포넌트 카탈로그는 변경하지 않았다.

| 화면 / 그래프 | 그룹 | 질문 |
| --- | ---: | ---: |
| 기술적 분석 · 인라인 | 6 | 24 |
| 기술적 분석 · Canvas | 6 | 24 |
| TA-Lib 채팅 | 8 | 32 (기존 유지) |
| SEC API Agent | 6 | 24 |
| SEC Intelligent Research Chat | 6 | 24 |
| SEC Modeling Chat | 6 | 24 |
| 개발 채팅의 일반 대화 | 4 | 16 |
| 개발 채팅의 SEC Research 그래프 | 6 | 24 |

AI Chat은 사이드바의 그룹 제목이다. 해당 메뉴의 실제 6개 화면에 총152개 질문을 제공한다. 개발 채팅도 선택한 그래프에 맞는 질문 그룹을 표시하며 JSON 그래프는 실행 폼을 유지한다. 기술적 분석의 신규 질문은 단일 종목·주기로 제한하고 Canvas의 설명과 선택 가능한 UI를 구분한다. SEC 수집·모델링 실행 질문은 조회·사전 설명 질문과 분리한다.

## 현재 문서

[Host 공통 채팅 설계](../stock/tech-shared/1-fe-host/open-ui.md#chat-starters-002-기능별-시작-질문)에 표시·전송 계약과 소유 위치를 반영했다. human-docs는 변경하지 않았다.

## 검증

변경은 질문 데이터·표시 연결에 한정된 View 변경이므로 VAL-VIEW-001을 적용했다. 업무 로직과 서버 API 변경은 없다.

- Given 빈 대화, When 화면 표시, Then 첫 그룹만 펼쳐지고 나머지는 접혀 있다.
- When 각 그룹을 펼치면 모든 질문 버튼이 보인다.
- When 마지막 그룹의 질문을 클릭하면 표시 제목 대신 전체 prompt가 기존 전송 callback/대화에 전달된다.
- `pnpm -C 1-fe-host typecheck`: PASS.
- 변경 TS/TSX 범위 ESLint: PASS.
- `pnpm -C 1-fe-host exec vitest run --project storybook --maxWorkers=1 --no-file-parallelism src/_pages/chat/ui/TechnicalAnalysisStarters.stories.tsx src/_pages/sec-chat/ui/SecChatStarters.stories.tsx src/_pages/sec-api-agent/ui/page.stories.tsx`: Chromium 3파일9테스트 PASS.
- `git diff --check`: PASS.

초기 Storybook 실행은 닫힌 details 안의 버튼을 DOM에서 제거된 것으로 기대해 SEC3건이 실패했다. 실제 HTML은 DOM을 보존하므로 비표시 기대값으로 수정한 뒤 전체9건이 통과했다. 일반 그룹 story의 role query에서 지원하지 않는 exact 옵션도 제거했다.

각 질문의 실제 모델 응답과 외부 데이터 조회를 전수 실행한 것은 아니다. 데이터·모델 응답 품질 보증과 UI 전송 검증을 구분한다. 전체 lint에는 기존 dartTesting.ts constant condition과 talib-validator.mjs Node globals 오류가 남아 있다.

## 자원 정리

별도 앱 서버나 MCP 연결을 생성하지 않았다. Storybook Vitest가 소유한 headless Chromium과 Vite는 러너 종료로 정리했다. 종료 후 프로세스 목록에서 vitest 및 chrome-headless 실행 잔존 없음(검색 명령 자체 제외)을 확인했다. 기존 사용자 서버와 브라우저는 변경하지 않았다.
