---
name: apb-bruno-api-tests
phase: validate
description: |
  Scaffolds and extends a Bruno-style API E2E test suite that mirrors the
  `ads-assistant-main/e2e/bruno-api-tests` layout: `bruno.json`,
  `collection.bru` (shared headers + post-response script), numbered
  folders (`01-*`, `02-*`, ...), environments (`local.bru`, `dev.bru`,
  `staging.bru`), and per-endpoint `.bru` request files with `assert` +
  `tests` blocks.
  Phases: Inspect -> Scaffold -> Author -> Run.
  Triggers: bruno api test, bruno e2e, api e2e, .bru file, rest api test,
  브루노 api 테스트, api 이투이, REST 테스트,
  Bruno API テスト, API E2E, api 测试, e2e 接口测试,
  pruebas api bruno, tests api bruno, Bruno API Tests
  Do NOT use for: UI E2E (use $apb-playwright-e2e),
  unit tests (use $apb-unit-test-write),
  writing the final validate report (use $apb-validation-report).
---

# apb-bruno-api-tests

> Creates API E2E tests in the Bruno collection format used by
> `ads-assistant-main/e2e/bruno-api-tests`, keyed to the feature's plan
> E2E scenarios.

## Usage

```
apb-bruno-api-tests init {root}         Create bruno.json + collection.bru + environments/ skeleton
apb-bruno-api-tests add {folder} {name} Add a numbered folder or a new .bru request under it
apb-bruno-api-tests run {env}           Run the suite against a named environment
```

Input (prerequisite): `.apb-workspace/docs/01-plan/{feature}.plan.md` with at least one Given/When/Then scenario under `## Validation → E2E 시나리오`.
Output: `.bru` files under the chosen root (default: `e2e/bruno-api-tests/`).

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

## Phase:Inspect

Understand the target API surface and pick a root directory.

### Prerequisites

- Feature plan exists with API-level scenarios, OR the user points to an existing service.
- The user confirms the suite root path (defaults to `e2e/bruno-api-tests/`).

### Steps

1. Read the plan's `## Validation → E2E 시나리오` and list each scenario.
2. Group scenarios by domain (auth, threads, runs, …) → these will become numbered folders (`01-system`, `02-…`).
3. Identify variables that differ per environment (`baseUrl`, tokens, IDs).

### Output Path

```
(no file; produces an internal plan the Scaffold phase consumes)
```

---

## Phase:Scaffold

Create the collection skeleton if it does not already exist.

### Prerequisites

- Grouped scenario list from Inspect phase.

### Steps

1. If missing, write `bruno.json`:
   ```
   {
     "version": "1",
     "name": "{feature}-api-e2e-tests",
     "type": "collection",
     "ignore": ["node_modules", ".git"]
   }
   ```
2. If missing, write `collection.bru` with shared `headers` and a `script:post-response` that logs `[METHOD] URL → status (ms)`.
3. Under `environments/`, create `local.bru`, `dev.bru`, `staging.bru` with a `vars { ... }` block per environment.
4. Create numbered folders (`01-{group}`, `02-{group}`, ...).

### Output Path

```
{root}/bruno.json
{root}/collection.bru
{root}/environments/{local|dev|staging}.bru
{root}/{NN}-{group}/
```

---

## Phase:Author

Add one `.bru` file per scenario.

### Prerequisites

- Scaffold phase complete.
- Each scenario has: HTTP method, URL template, expected status, any body/assertions.

### Steps

1. For each scenario, create `{root}/{NN}-{group}/{kebab-name}.bru` with blocks in this order:
   - `meta { name, type: http, seq }`
   - `{get|post|put|delete} { url, body, auth }`
   - `assert { res.status: eq <code> }`
   - `tests { test("...", function() { expect(res.getStatus()).to.equal(<code>); }) }`
2. Use `{{baseUrl}}`, `{{consumerToken}}`, etc. for environment-bound values — never inline secrets.
3. Increment `seq` to enforce execution order where needed.
4. Cross-reference the plan scenario ID in a comment above `meta` for traceability.

### Output Path

```
{root}/{NN}-{group}/{kebab-name}.bru
```

---

## Phase:Run

Execute the suite and feed results back to validate.

### Prerequisites

- Bruno CLI (`bru`) installed or the user's preferred runner identified.
- Environment selected (default `local`).

### Steps

1. Run `bru run --env {env} {root}` (or the project's equivalent npm script).
2. Capture stdout/stderr and save to `{root}/reports/{YYYY-MM-DD-HHMM}.log`.
3. Summarize PASS/FAIL counts and failing scenarios.
4. Hand off results to `apb-validation-report` to fill the validate report's E2E Test Results table.

### Output Path

```
{root}/reports/{YYYY-MM-DD-HHMM}.log
```
