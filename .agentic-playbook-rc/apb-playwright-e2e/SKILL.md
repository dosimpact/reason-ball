---
name: apb-playwright-e2e
phase: validate
description: |
  Authors UI end-to-end tests with Playwright, converting plan E2E
  scenarios (Given/When/Then) into `*.spec.ts` files with `test.describe`,
  `test`, and `expect` blocks. Handles baseURL/env via `playwright.config.ts`
  and produces an HTML report.
  Phases: Inspect -> Scaffold -> Author -> Run.
  Triggers: playwright, ui e2e, browser test, end-to-end, spec.ts,
  플레이라이트, 브라우저 테스트, 이투이 UI, E2E,
  プレイライト, UI E2E, 浏览器测试, 端到端测试,
  pruebas e2e ui, tests e2e ui, Playwright UI Test
  Do NOT use for: API E2E (use $apb-bruno-api-tests),
  unit tests (use $apb-unit-test-write),
  filling the final validate report (use $apb-validation-report).
---

# apb-playwright-e2e

> Turns the plan's UI scenarios into runnable Playwright specs.

## Usage

```
apb-playwright-e2e init {root}            Scaffold playwright.config.ts and tests/ directory
apb-playwright-e2e add {name}             Add a single *.spec.ts from a plan scenario
apb-playwright-e2e run [--project=chromium] Run the suite and emit an HTML report
```

Input (prerequisite): `.apb-workspace/docs/01-plan/{feature}.plan.md` with UI scenarios.
Output: `*.spec.ts` files (default `e2e/playwright/tests/`).

## Phase Flow

```
[Inspect] -> [Scaffold] -> [Author] -> [Run]
```

## Phase Progress Visualization

```
[Inspect] -> [Scaffold] -> [Author] -> [Run]

Status:
  [Phase] done     -> phase completed
  [Phase] active   -> currently working
  [Phase] pending  -> not yet started
```

---

## Inspect Phase

### Prerequisites

- Plan has UI-facing Given/When/Then scenarios.
- Target `baseURL` and auth strategy are known.

### Steps

1. List each UI scenario in the plan; identify pages, roles, and required fixtures.
2. Decide on projects (chromium/firefox/webkit) and whether the suite needs auth setup.

### Output Path

```
(no file; internal plan)
```

---

## Scaffold Phase

### Prerequisites

- `@playwright/test` is installable, or the project already uses Playwright.

### Steps

1. Install/confirm `@playwright/test` (prefer package manager command over editing package.json).
2. Create `playwright.config.ts` with:
   - `testDir: './tests'`
   - `use: { baseURL: process.env.BASE_URL ?? '…' }`
   - `projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }]`
   - `reporter: [['html']]`
3. If auth is required, create `tests/auth.setup.ts` that stores state via `page.context().storageState(...)`.
4. Create `tests/` directory.

### Output Path

```
{root}/playwright.config.ts
{root}/tests/
{root}/tests/auth.setup.ts   (optional)
```

---

## Author Phase

### Prerequisites

- Scaffold complete.
- One scenario = one `*.spec.ts`.

### Steps

1. For each scenario create `tests/{kebab-name}.spec.ts` using this pattern:
   ```ts
   import { test, expect } from '@playwright/test';

   test.describe('{Feature} — {Scenario}', () => {
     test.beforeEach(async ({ page }) => {
       // Given
     });

     test('{Then summary}', async ({ page }) => {
       // When
       // Then
       await expect(page.getByRole('…')).toBeVisible();
     });
   });
   ```
2. Prefer role/name locators (`getByRole`, `getByLabel`) over brittle CSS selectors.
3. Use `await page.waitForLoadState('networkidle')` only when the scenario needs a stable state; otherwise rely on auto-waiting assertions.
4. Link each spec to the plan scenario with a comment header (`// plan scenario: <id>`).

### Output Path

```
{root}/tests/{kebab-name}.spec.ts
```

---

## Run Phase

### Prerequisites

- Specs authored.
- `BASE_URL` or equivalent env vars set.

### Steps

1. Run `npx playwright test` (or the project's script).
2. Archive the HTML report path.
3. Produce a PASS/FAIL/SKIP summary per spec.
4. Hand off to `apb-validation-report`.

### Output Path

```
{root}/playwright-report/
```
