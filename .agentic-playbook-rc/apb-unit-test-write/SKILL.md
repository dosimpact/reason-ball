---
name: apb-unit-test-write
phase: validate
description: |
  Generates unit tests (Jest or Vitest) for a target file or module. Derives
  cases from the gradate document's Implementation Draft (public interfaces +
  edge cases) and ensures at least one happy-path and one error-path case.
  Phases: Detect -> Plan Cases -> Author -> Run.
  Triggers: unit test, jest, vitest, write tests, test cases,
  단위 테스트, 유닛 테스트, 테스트 작성,
  ユニットテスト, 单元测试, 写测试,
  pruebas unitarias, tests unitaires, Unit-Test
  Do NOT use for: UI E2E (use $apb-playwright-e2e),
  API E2E (use $apb-bruno-api-tests),
  coverage raising (use $apb-code-coverage).
---

# apb-unit-test-write

> Adds focused unit tests for the file(s) the feature introduces or changes.

## Usage

```
apb-unit-test-write for {path}     Write *.test.ts for a single file
apb-unit-test-write from-gradate   Author tests for every new public export in the gradate doc
```

Input (prerequisite): `.apb-workspace/docs/02-gradate/{feature}.gradate.md` (Implementation Draft section) and the source file(s).
Output: `{path}.test.ts` (or `{path}.spec.ts` if the project uses that convention).

## Phase Flow

```
[Detect] -> [Plan Cases] -> [Author] -> [Run]
```

## Phase Progress Visualization

```
[Detect] -> [Plan Cases] -> [Author] -> [Run]

Status:
  [Phase] done     -> phase completed
  [Phase] active   -> currently working
  [Phase] pending  -> not yet started
```

---

## Detect Phase

### Prerequisites

- A target file path, OR the gradate doc's Implementation Draft table of modules/interfaces.

### Steps

1. Detect the test framework: Jest if `jest` is in `package.json`, Vitest if `vitest`. Default to Vitest for new TS projects.
2. Detect existing test-file placement (sibling vs. `__tests__/`) and mimic it.
3. Detect project-level path aliases (tsconfig `paths`) to import correctly.

### Output Path

```
(no file; captures framework/placement for later phases)
```

---

## Plan Cases Phase

### Prerequisites

- Target exports known (either from the source file AST or the gradate interface table).

### Steps

1. For every public function/class list:
   - 1 happy-path case
   - At least 1 edge case (null/empty/boundary)
   - 1 error-path case (throws / rejects)
2. If the target calls external modules, plan mocks (e.g., `jest.fn()`, `vi.fn()`).
3. Keep cases close to the gradate's described behavior; do not speculate new behavior.

### Output Path

```
(no file; internal case plan)
```

---

## Author Phase

### Prerequisites

- Plan Cases phase complete.

### Steps

1. Create the test file next to the source (or in the project's convention).
2. Structure with `describe` per export and `it`/`test` per case. Example (Vitest):
   ```ts
   import { describe, it, expect, vi } from 'vitest';
   import { target } from './target';

   describe('target', () => {
     it('happy path', () => { /* ... */ });
     it('edge: empty input', () => { /* ... */ });
     it('throws on invalid input', () => { /* ... */ });
   });
   ```
3. Each test must have at least one `expect(...)` assertion.
4. Do not add snapshot tests unless the project already uses them.

### Output Path

```
{sameDir}/{basename}.test.ts        (or project's convention)
```

---

## Run Phase

### Prerequisites

- Test file written.

### Steps

1. Run the project's test command scoped to the new file: `npx vitest run {path}` / `npx jest {path}`.
2. Fix failures iteratively; do not alter source code semantics beyond what the gradate doc specifies.
3. Report PASS/FAIL counts back to `apb-validation-report`.

### Output Path

```
(stdout; also linked in the validate report)
```
