# 2026-11-17 OpenUI Base Select 재확인 및 교체

- 결정: OPENUI-SELECT-002.
- 사용자 지적대로 기존 마이그레이션은 NativeSelect였으며 요청한 [shadcn Base Select](https://ui.shadcn.com/docs/components/base/select)와 달랐다.
- 기존 OpenUI Select의 value/options/label/placeholder 계약을 유지하고 설치된 Base UI Select/Trigger/Value/Content/Item으로 교체했다. 포털은 로컬 dark 테마를 이어받으며, 없는 값은 placeholder로 표시한다. 선택 시 표시 label과 바인딩 value를 구분한다.
- Stock: [OpenUI 기본 요소](../stock/tech-shared/1-fe-host/openui-shadcn-primitives.md).

## 검증 (2026-11-18 KST)

- VAL-VIEW-001: Controls4 + 기존 business action2 + QueryPanel3 = Storybook Chromium9 PASS. 선택 label/value, 미등록 초기값 placeholder, 빈 옵션, popup dark class, 폼 payload, 조회조건 변경과 Query 재실행을 확인했다.
- typecheck·변경4개 TSX scoped ESLint·diff check PASS. Storybook의 ByRoleOptions에 잘못 추가했던 exact 옵션은 제거 후 typecheck 재실행 PASS.
- sec-ui:generate / openui:check PASS,63 components FE txt/spec/Python mirror 일치.
- VAL-BROWSER-001: 공식 @playwright/mcp --isolated --headless 전용 프로세스로 실제2983 Catalog를 조작했다. shadcn select-trigger와 포털 listbox, 도시 부산 선택 후 reactive 텍스트, 표시 확장/실제값 b 구분, popup dark 테마, ArrowDown 팝업 열기·Escape 닫기, 모바일390px 가로 넘침 없음, pageerror0 확인. 특정 옵션 도달을 가정한 ArrowDown/End 시퀀스는 타임아웃됐으므로 해당 조합의 선택 성공으로 집계하지 않았다. 최종 검증은 실제 마우스 선택과 키보드 팝업 열기·닫기 범위를 확인했다.
- 증거 `.tmp/base-select-dark.png`, `.tmp/base-select-mobile.png`, `.tmp/base-select-mcp/console-2026-11-17T15-04-00-573Z.log`. favicon404는 기존 개발 앱 자산 오류로 구분했다.
- 서비스 재시작: 기존 supervisor83073/83074/83075의 정확한 cwd/command와 자식 소유권 확인 후 TERM. 포트 해제 후 FE92005, FastAPI92006, LangGraph dev92007 pnpm scripts로 시작. 로그 `/tmp/reason-hwang-services/*-base-select.log`.2981/health,2982/ok,2983/open-ui/catalog 모두200. BFF/DB/OAuth proxy/사용자 브라우저 유지.
- 정리: 각 전용 MCP browser_close 후 stdio 종료 및 exit0, runner 종료 확인. 임시 검증 helper 제거하고 증거 유지. 서비스3개는 사용자 요청에 따라 유지한다.
- apb-playwright-e2e의 실제 MCP 검증과 자원 정리 절차를 적용했다. 이전 미커밋 변경은 보존했으며 이번에도 커밋·푸시하지 않았다.
