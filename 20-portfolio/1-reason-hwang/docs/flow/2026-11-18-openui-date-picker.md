# 2026-11-18 OpenUI DatePicker 재확인 및 교체

- 결정: OPENUI-DATEPICKER-002.
- 사용자 지적대로 기존 DatePicker는 날짜형 Input 어댑터였으며 공식 [shadcn Base Date Picker](https://ui.shadcn.com/docs/components/base/date-picker)의 Calendar+Popover 구성이 아니었다.
- 기존 OpenUI DatePicker(value,label?,min?,max?)를 유지하고 설치된 Button·Popover·Calendar를 조합한다. 문자열은 YYYY-MM-DD, 빈 선택은 빈 문자열, min/max는 포함 범위로 유지한다. 달력의 Date와 문자열을 로컬 날짜 기준으로 변환하고 잘못된 날짜를 유효값으로 정규화하지 않는다.
- Stock: [OpenUI 기본 요소](../stock/tech-shared/1-fe-host/openui-shadcn-primitives.md).

## 검증

- Sol 서브에이전트가 date-picker/date-picker-view.tsx와 view stories를 구현하고 parent가 OpenUI binding·프롬프트·서비스·MCP를 검증했다.
- VAL-VIEW-001: DatePicker6 + Controls5 + Catalog4 = Chromium Storybook15 PASS. 선택/동일일 해제·빈 값·2026-02-30 거부·포함형 min/max·dark·윤일·Form 이벤트 날짜 전달을 확인했다.
- DatePicker6개는 TZ=America/Los_Angeles 환경에서도6 PASS. 날짜 문자열이 UTC 변환으로 전날이 되지 않는 것을 확인했다.
- Host typecheck, 변경 controls/date-picker/story scoped ESLint, git diff --check PASS.
- sec-ui:generate 및 openui:check PASS:63 components, FE prompt/spec/Python mirror 일치. 기존 DatePicker signature를 보존하고 설명을 Calendar+Popover로 갱신했다.
- VAL-BROWSER-001: apb-playwright-e2e의 실제 검증/정리 절차로 공식 @playwright/mcp --isolated --headless stdio를 실행했다. 실제2983 Catalog에서2026-10-26 선택→동일일 해제(날짜 선택 placeholder),9/30·11/1 disabled,10/1·10/31 enabled, 월 이동, popup dark, 실제 Escape 닫기, native date input0, pageerror0을 확인했다.390px documentWidth390이며 스크린샷으로 달력 배치를 확인했다.
- 최초 MCP 검증은10월 달력에11/1이 반드시 보인다는 잘못된 테스트 가정으로 timeout. 다음 달로 이동해11/1 disabled를 확인하는 올바른 시나리오로 재실행 PASS. favicon404는 기존 개발 앱 자산 오류로 구분했다.
- 증거 `.tmp/datepicker-dark.png`, `.tmp/datepicker-mobile.png`, `.tmp/datepicker-mcp/console-2026-11-17T15-09-50-838Z.log`.

## 재시작과 정리

- 이전 서비스92005/92006/92007의 cwd·command와 자식 소유권을 확인해 TERM 종료하고2981/2982/2983 해제를 확인한 뒤 committed pnpm scripts로 재시작했다.
- 유지 대상: FE94598 pnpm dev, FastAPI94599 pnpm dev, LangGraph dev94600 pnpm dev:langgraph. 로그 `/tmp/reason-hwang-services/*-datepicker.log`.2981/health,2982/ok,2983/open-ui/catalog 모두200. BFF·DB·OAuth proxy 및 다른 서비스는 유지했다.
- 모든 작업 전용 MCP browser_close·stdio 종료·exit0, Vitest 종료, vitest/playwright_chromiumdev_profile/datepicker-mcp 프로세스 잔존 없음 확인. 임시 QA helper는 제거하고 증거는 유지한다. 위3개 서버는 사용자 요청에 따라 계속 실행한다. 사용자 브라우저·공유 MCP는 종료하지 않았다.
- 커밋·푸시하지 않았다. HEAD는 a83dab3d로 유지한다.
