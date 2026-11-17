# TA-CANVAS-004: 반복 추가와 Grafana 방식 그리드 — 2026-11-17

사용자 승인 계획에 따라 공통 OpenUI wrapper의 추가 버튼을 우측 상단에 돌출 배치하고,
같은 원본을 독립 패널로 반복 추가하며 6-b-4-grafana-grid-system의 그리드 동작을 적용한다.

- 사용자가 명시한 human-docs/3.dynamic-canvas-openui/goal.md의 QA Point만 네 개 짧은 항목으로 편집했다.
- Canvas panel UUID와 원본 sourceElementId를 분리하고 원본 인용 문맥을 유지한다.
- 24열·28px행·12px간격·noCompactor·이동/리사이즈·고정·키보드·Esc·좁은 화면 projection을 적용한다.
- 기존 v1 localStorage 구성은 새 layout으로 이관한다. 공유/서버 저장은 이번 그리드 변경에 포함하지 않는다.
- sol 에이전트 3개가 grid UI, 상태·이관, wrapper 디자인을 분담한다.
- 현재 상태·검증 증거·정리는 구현 통합 후 기록한다.

## 최종 구현과 검증

- CanvasItemFrame 공통 React wrapper로 버튼을 분리했다. 기존 DSL schema는 유지한다.
- 독립 UUID·원본 sourceElementId·상태 deep copy, 기존 storage key에서 v2 payload로 이관한다.
- react-grid-layout/react-resizable 의존성과 CSS를 등록했다. 기존 수동 grid/resize 코드는 제거했다.
- `pnpm -C 1-fe-host test:chat`: 33/33 PASS. 전체 typecheck 및 변경 파일 ESLint PASS.
- Storybook Chromium: CanvasItem 2개, PinnedCanvas 3개 PASS. 최초 Vite dependency reload 및
  미등록 resize CSS 의존성 오류를 해결했고 테스트 fixture의 viewport/hidden 기대값을 보정했다.
- `SEC_LIVE_BASE_URL=http://127.0.0.1:2983 pnpm -C 1-fe-host test:e2e canvas-wrapper.spec.ts --project=chromium`: 1 PASS.
  같은 가격 요소 3회 추가, RSI 추가, 좌표·크기 저장/새로고침 복원, 원본 elementId 인용, 개별 삭제, print media 캡처.
- 최초 E2E에서 RGL이 최상위 article mouseup을 덮어써 인용 버튼이 나타나지 않았다.
  인용 감지를 내부 content wrapper로 옮긴 뒤 동일 흐름이 통과했다.
- Playwright MCP isolatedContext `canvas-grid-qa`: 실제 클릭으로 반복 추가3개·고유UUID·위치 고정,
  pointer drag·pointer resize·Esc 취소·800px 좁은 화면에서 저장 좌표 유지 확인.
- UI는 실제 Host를 사용하고 채팅 결과는 통제된 HTTP route fixture다. 실제 LLM·금융 조회 성공 검증이 아니다.
  서버 API 변경이 없으며 새 유료 모델 호출은 하지 않았다.
- 증거: `.tmp/canvas-grid/mcp-grid.png`, `.tmp/canvas-grid/mcp-final.png`,
  `1-fe-host/test-results/canvas-wrapper-pinned.png`, `canvas-wrapper-print.png`, Playwright HTML report.

## 자원 정리

Storybook·Playwright CLI 종료, 실행 프로세스 잔존 없음 확인. MCP의 소유 isolated browser context를
`page.context().close()`로 종료했다. 기존 사용자 Host·API·공유 MCP는 유지하며 새 서버/DB는 생성하지 않았다.
현재 규칙은 [기술적 분석 stock](../stock/technical-analysis/system-design.md#ta-canvas-004-grafana-방식-그리드와-반복-추가)에 반영했다.
참조 앱의 탭·서버 저장·명령 API 도입은 이 변경 범위가 아니다.
