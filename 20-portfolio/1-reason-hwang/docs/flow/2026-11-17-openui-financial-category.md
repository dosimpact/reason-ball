# 2026-11-17 OpenUI 금융 카테고리 분리

- 결정: OPENUI-FIN-STORY-003. 사용자 요청으로 금융 항목을 components/functions/actions/builtins와 동급 카테고리로 분리했다.
- 변경: `financial · 금융` 탭에 10개 항목(FinancialChart 기본 예제, 차트 조합 8개, IndicatorControls)을 배치했다. 탭 내부는 금융 컴포넌트와 금융 차트 쇼케이스로 구성한다. components에서 금융 항목을 중복 표시하지 않는다. 기존 hash 링크와 자동 탭 선택은 유지한다.
- Stock: [Host Storybook](../stock/tech-shared/1-fe-host/storybook.md#openui-fin-story-002-lib-story-금융-v2-예제).
- 검증: VAL-VIEW-001. Catalog Storybook Chromium 3 PASS. 금융 탭의 10개 개수·초기 선택, components에서 금융 항목 제외, 금융 탭 전환, 기존 차트/설정 렌더링을 확인했다. `pnpm -C 1-fe-host typecheck`, 변경 3개 파일 scoped ESLint, `git diff --check` PASS.
- 실행: `pnpm -C 1-fe-host exec vitest run --project storybook --maxWorkers=1 --no-file-parallelism src/_pages/generative-ui/ui/Catalog.stories.tsx`.
- 정리: runner 정상 종료. `ps`에서 vitest 및 playwright_chromiumdev_profile 잔존 없음. 사용자/공유 브라우저 및 기존 서버 사용·종료 없음.
