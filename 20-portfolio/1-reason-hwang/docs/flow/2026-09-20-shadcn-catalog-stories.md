# 2026-09-20 — Complete the UI catalog Storybook examples

Decision: `UI-STORY-003`, extending `UI-CATALOG-001` and `UI-STORY-002`.

## Context and change

The CLI installation added 42 components with only an installation smoke check. Add a colocated story file for each of those components, preserving the original component source and existing stories. All 61 standalone UI components now have individual Storybook coverage. Add three composed examples under `src/stories/`: Data Table (local filtering and amount sorting), Date Picker (Calendar + Popover + date-fns), and Typography (editorial hierarchy).

The catalog adds 110 cases: meaningful content, selected/disabled/error/empty states, chart datasets, multi-step survey submission, menus, overlays, keyboard-friendly controls, scrolling, and resizing. The built index contains 192 `UI` stories, eight starter `Example` stories, and one installation smoke story: 201 total. Twenty new interaction stories exercise visible state changes. Fixtures are local and require no API, account, or persistence.

Toast managers are scoped to each mounted story. Overlay Docs examples use isolated frames. Calendar fixtures use September 2026. Fixed compositions disable irrelevant Controls. The test project explicitly prebundles catalog dependencies to avoid Vite late-dependency discovery reloading active browser-test iframes.

## Validation — VAL-VIEW-001

Environment: local host, owned Storybook server at `http://localhost:6007`, Chromium Vitest runner and browser MCP. The user's port 6006 server was not reused or stopped.

| Scenario | Expected / actual result |
| --- | --- |
| Every standalone component has a colocated story | 61 / 61, no missing story files — PASS |
| All rendered stories and interaction cases | 68 files, 201 tests passed — PASS |
| `ui-chart--weekly-traffic` desktop | Both series, weekday axis, legend visible; screenshot inspected — PASS |
| `ui-questionnaire--onboarding` | Choose 개발, then 2–10명, submit; visible summary `개발 · 2–10명` — PASS |
| `ui-dialog--default` | Trigger opens titled dialog; 닫기 dismisses it — PASS |
| `ui-date-picker--booking-date` | Select September 22; trigger becomes `2026년 09월 22일`, popup closes — PASS |
| `ui-resizable--editor` keyboard | ArrowRight changes separator value from 25 to 30 — PASS |
| Date Picker at 390 × 844 | Popup fits viewport with readable date grid; screenshot inspected — PASS |

Commands run in the host package:

- `pnpm typecheck` — PASS.
- `pnpm lint` — PASS.
- `pnpm exec vitest run --project storybook` — PASS, 201 / 201.
- `pnpm build-storybook` — PASS.

Temporary evidence: `/tmp/catalog-typecheck.log`, `/tmp/catalog-lint.log`, `/tmp/catalog-tests-final.log`, `/tmp/catalog-build.log`. Browser inspections used `mcp__node_repl__js` with the browser plugin. Generated bundles, caches, and logs are not committed.

Initial runs exposed late optimizer reloads, an animation-sensitive visibility assertion, an ambiguous transitioning tab panel query, and Pagination's generated button role. Prebundling, waiting for visibility, selecting the named activity panel, and querying the actual button role resolved them; final full suite passes. Existing Vite native-loader and Next multi-lockfile warnings remain unrelated to these stories. The examples do not alter server APIs or business behavior, so VAL-API-001 and VAL-BROWSER-001 are not applicable.

## Stock synchronization

Update [UI catalog](../stock/tech-shared/1-fe-host/ui-catalog.md) and [Storybook design](../stock/tech-shared/1-fe-host/storybook.md) to describe the complete coverage and composed examples. Preserve the separate documentation relocation and unrelated workspace changes.
