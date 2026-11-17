# OpenUI 컴포넌트 관련 파일 정리

- 날짜: 2026-11-17
- 결정: OPENUI-FOLDERS-001
- 배경: 금융·CanvasItem 관련 파일을 기존 components 하위 컨벤션에 맞춰 배치해 달라는 요청.
- 변경: map 폴더 관례에 따라 financial/, canvas-item/에 10개 파일을 이동. import와 Vitest 재귀 탐색 갱신. 공통 Query 실행기와 카탈로그는 루트에 유지.
- Stock: [Host architecture](../stock/tech-shared/1-fe-host/2-frontend-side-architecture.md#openui-folders-001-컴포넌트별-관련-파일-배치).
- 동작: UI·API·업무 로직과 생성 카탈로그 계약 변경 없음. human-docs 및 기존 다른 작업의 변경 보존.

## 검증

- `pnpm -C 1-fe-host typecheck`: PASS.
- `pnpm -C 1-fe-host openui:check`: PASS, 59개 컴포넌트 FE prompt/spec와 Python mirror 일치.
- `pnpm -C 1-fe-host exec vitest run --project=generative-ui`: 5개 파일, 62개 테스트 PASS.
- Storybook Chromium: FinancialChart·CanvasItem 11개 PASS. IndicatorControls 기존 story의 role=status 쿼리가 output의 암시적 status와 충돌하여 1개 FAIL. 지표 설정 region으로 쿼리 범위를 한정한 후 해당 1개 재실행 PASS. 제품 코드 변경 없이 테스트 선택자만 수정.
- 변경 TS/TSX와 Vitest 설정의 scoped ESLint: PASS.
- VAL-VIEW-001: 이동 후 기존 Storybook 렌더링·상호작용 회귀 검증. API/업무 동작은 변경하지 않아 VAL-API-001/VAL-BROWSER-001 신규 시나리오 적용 대상 아님.
- 자원: 일회성 Vitest·headless Chromium은 러너 종료(exit 0/1)로 정리. 별도 개발 서버나 MCP 세션은 생성하지 않음. 카탈로그 검사 임시 디렉터리는 검사 스크립트가 정리. 기존 공유 서비스는 유지.
