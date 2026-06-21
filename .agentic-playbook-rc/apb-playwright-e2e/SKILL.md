---
name: apb-playwright-e2e
phase: validate
description: |
  Authors and runs UI end-to-end tests with Playwright, using Playwright MCP
  or the available browser-control MCP to inspect the live UI before writing
  specs. Converts plan E2E scenarios (Given/When/Then) into `*.spec.ts`
  files with stable locators, verifies flows in a real browser, and produces
  an HTML report plus PASS/FAIL/SKIP summary.
  Phases: Inspect -> MCP Explore -> Scaffold -> Author -> Execute -> Review.
  Triggers: playwright, playwright mcp, ui e2e, browser test, end-to-end,
  spec.ts, MCP browser test, 플레이라이트, 브라우저 테스트, 이투이 UI, E2E,
  Playwright MCP, プレイライト, UI E2E, 浏览器测试, 端到端测试,
  pruebas e2e ui, tests e2e ui, Playwright UI Test
  Do NOT use for: API E2E (use $apb-bruno-api-tests),
  unit tests (use $apb-unit-test-write),
  load/performance testing (use $apb-artillery),
  filling the final validate report (use $apb-validation-report).
---

# apb-playwright-e2e

> Turns UI scenarios into browser-verified Playwright E2E specs.

## Usage

```
apb-playwright-e2e inspect {plan}          Extract UI scenarios and target routes
apb-playwright-e2e mcp {baseURL}           Explore the live app with Playwright/browser MCP
apb-playwright-e2e init {root}             Scaffold playwright.config.ts and tests/ directory
apb-playwright-e2e add {name}              Add a single *.spec.ts from a verified scenario
apb-playwright-e2e run [--project=chromium] Run the suite and emit an HTML report
apb-playwright-e2e review                  Summarize failures, screenshots, traces, and next actions
```

Input: plan or gradate document containing UI scenarios, plus a runnable target app.

Output: `*.spec.ts` files, Playwright report artifacts, and a concise validation summary.

## Phase Flow

```
[Inspect] -> [MCP Explore] -> [Scaffold] -> [Author] -> [Execute] -> [Review]
```

## Phase Progress Visualization

```
[Inspect] -> [MCP Explore] -> [Scaffold] -> [Author] -> [Execute] -> [Review]

Status:
  [Phase] done     -> phase completed
  [Phase] active   -> currently working
  [Phase] pending  -> not yet started
```

---

## Phase:Inspect

Identify the user-visible flows that should become browser tests.

### Prerequisites

- Plan, gradate, issue, or user request describes UI-facing behavior.
- Target app path, dev command, and expected base URL can be discovered from project files.
- Existing Playwright configuration and test conventions have been checked.

### Steps

1. Read the plan or request and list each UI scenario as Given/When/Then.
2. Inspect the app structure to identify routes, components, user roles, required fixtures, and environment variables.
3. Check for existing `playwright.config.*`, `tests/`, `e2e/`, auth setup, page objects, helpers, and package scripts.
4. Decide whether the target should be verified against a dev server, production build preview, static file, or existing running URL.
5. Define the minimum browser coverage. Default to Chromium unless the plan requires Firefox/WebKit/mobile.

### Output Path

```
(no file; internal scenario/test plan)
```

---

## Phase:MCP Explore

Use Playwright MCP or the available browser-control MCP to verify the live UI before authoring selectors.

### Prerequisites

- The target app can run locally or a reachable base URL is available.
- A browser-control MCP is available, such as Playwright MCP or the bundled in-app browser controller.
- Any required auth/session setup is known or can be performed manually in the controlled browser.

### Steps

1. Start the app with the committed package script, for example `pnpm dev`, `pnpm preview`, or the app-specific script.
2. Open the target base URL through Playwright MCP or browser-control MCP.
3. Navigate each planned flow and observe actual accessible names, labels, headings, URLs, loading states, empty states, error states, and success states.
4. Prefer accessibility-based selector evidence:
   - button/link/input role and accessible name
   - label text
   - visible heading text
   - stable test id only when role/label selectors are insufficient
5. Capture screenshots only when they help debug layout, visibility, or timing issues.
6. Record any mismatch between the plan and actual UI before writing specs.
7. Do not encode selectors from guesswork when MCP/browser inspection can confirm them.

### Output Path

```
(no file; MCP observations inform spec authoring)
```

---

## Phase:Scaffold

Create or align the Playwright project structure with the repository conventions.

### Prerequisites

- `@playwright/test` is installable, or the project already uses Playwright.
- Package manager and test script conventions are known.
- The target base URL and server command have been selected.

### Steps

1. Prefer existing Playwright config and scripts. Do not create a competing config if one already exists.
2. If missing, install or confirm `@playwright/test` using the repository package manager.
3. Create `playwright.config.ts` or update the existing config with:
   - `testDir` matching the repo convention, usually `e2e/playwright/tests` or `tests`
   - `use.baseURL` from `process.env.BASE_URL`
   - `webServer` when the app should be started automatically
   - `projects` including Chromium by default
   - `reporter` including HTML
   - `trace: "on-first-retry"` and screenshot/video policies appropriate for CI
4. If auth is required, create a setup project that saves storage state via `page.context().storageState(...)`.
5. Add package scripts only if the repository lacks a committed way to run Playwright.

### Output Path

```
{root}/playwright.config.ts
{root}/e2e/playwright/tests/   (preferred when no local convention exists)
{root}/tests/                  (if that is the existing convention)
{root}/e2e/playwright/auth.setup.ts   (optional)
```

---

## Phase:Author

Write maintainable Playwright specs from verified user flows.

### Prerequisites

- MCP Explore has confirmed routes, selectors, and expected states.
- Scaffold is complete or an existing Playwright setup is available.
- One scenario has a clear user action path and assertion target.

### Steps

1. Create one spec per coherent scenario or feature slice.
2. Use this structure:

   ```ts
   import { test, expect } from "@playwright/test";

   test.describe("{Feature}", () => {
     test("{scenario summary}", async ({ page }) => {
       // plan scenario: <id or title>
       await page.goto("/");

       await page.getByRole("button", { name: "..." }).click();

       await expect(page.getByRole("heading", { name: "..." })).toBeVisible();
     });
   });
   ```

3. Prefer locators in this order:
   - `getByRole` with accessible name
   - `getByLabel`
   - `getByPlaceholder`
   - `getByText` for stable visible copy
   - `getByTestId` for intentionally exposed test hooks
   - CSS selectors only as a last resort
4. Let Playwright auto-wait through locators and assertions. Avoid fixed sleeps.
5. Use `await expect(...)` for user-visible outcomes rather than implementation details.
6. Keep setup data deterministic and clean up data created by the test when the app does not isolate state.
7. Add comments only for plan scenario traceability or non-obvious synchronization.

### Output Path

```
{root}/e2e/playwright/tests/{kebab-name}.spec.ts
```

---

## Phase:Execute

Run the browser tests and collect actionable artifacts.

### Prerequisites

- Specs are authored and committed package scripts are available.
- Target app can start cleanly or `BASE_URL` points to a running instance.
- Required browser binaries are installed or installable.

### Steps

1. Run the committed script first, for example `pnpm test:e2e`, `pnpm playwright test`, or `npx playwright test`.
2. If browser binaries are missing, run the project-approved install command such as `pnpm exec playwright install --with-deps`.
3. Run focused specs while iterating, then run the full relevant suite before reporting.
4. On failure, inspect the Playwright error, screenshot, video, trace, and HTML report.
5. Re-open the failing flow with MCP/browser control when the failure is selector, timing, or visual-state related.
6. Fix test code or app behavior according to the requested scope. Do not hide real product failures by weakening assertions.

### Output Path

```
{root}/playwright-report/
{root}/test-results/
```

---

## Phase:Review

Summarize test coverage, failures, artifacts, and handoff items.

### Prerequisites

- Execute phase has produced a pass/fail result.
- Any failing trace or screenshot has been inspected.
- Any app changes made to satisfy tests have also passed relevant static checks when feasible.

### Steps

1. Report PASS/FAIL/SKIP per spec or scenario.
2. Include the command used, base URL, browser project, and report path.
3. List failures by user-visible behavior, not just stack trace text.
4. Note any scenarios intentionally not automated and why.
5. Hand results to `apb-validation-report` when the user is in a validate phase.

### Output Path

```
{root}/playwright-report/
validate report input: E2E Results section
```
