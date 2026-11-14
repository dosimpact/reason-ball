# OPENUI-NAV-002: OpenUI Lang 카탈로그 메뉴 명시

- 날짜: 2026-11-14
- 요청: FE 내비게이션에서 OpenUI Lang 카탈로그로 이동할 수 있게 추가.
- 확인 및 변경: 기존 Generative UI → Component Catalog 링크가 이미 있어 중복 추가 없이 OpenUI Lang Catalog로 명칭 변경. 경로 `/open-ui/catalog` 유지.
- Stock: [Host 내비게이션](../stock/tech-shared/1-fe-host/2-frontend-side-architecture.md) 동기화.
- 검증: Storybook Host/Navigation에서 명칭·href·활성 메뉴와 UI Demos 비활성 확인. 결과는 아래 기록.
- 범위: 메뉴 표시 문구만 변경. API/업무 로직 변경 없음. VAL-VIEW-001 적용, API·업무 브라우저 검증 적용 대상 아님.
- 자원: Storybook 테스트가 소유하는 브라우저는 runner 종료 시 정리. 별도 개발 서버·공유 브라우저 생성/변경 없음.

- 결과: `pnpm -C 1-fe-host exec vitest run --project storybook --maxWorkers=1 --no-file-parallelism src/widgets/host-navigation/ui/AppSidebar.stories.tsx` 1/1 PASS. 변경 두 TSX 파일의 ESLint PASS. 테스트 runner 정상 종료 확인.
