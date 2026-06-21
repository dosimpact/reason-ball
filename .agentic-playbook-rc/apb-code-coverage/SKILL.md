---
name: apb-code-coverage
phase: validate
description: |
  Runs test coverage scoped to files changed against the upstream base
  branch, and iteratively raises coverage on those files up to a target
  threshold (default 80%).
  Phases: Detect -> Sync -> Diff -> Measure -> Augment -> Verify.
  Triggers: code coverage, test coverage, diff coverage, PR coverage,
  raise coverage, coverage up,
  코드 커버리지, 테스트 커버리지, 커버리지 체크, 커버리지 올리기,
  コードカバレッジ, テストカバレッジ, 代码覆盖率, 测试覆盖率,
  cobertura de codigo, couverture de code, Codeabdeckung
  Do NOT use for: full-project coverage runs (run the npm script directly),
  CI coverage gate configuration (edit CI config),
  coverage report UI hosting (use $code-review or a coverage service).
---

# apb Code Coverage

> Measures test coverage only for files changed against the upstream base
> branch (e.g. `upstream/develop` or `upstream/master`), and optionally
> raises coverage on those files to a target threshold.

## Usage

```
$apb-code-coverage check-coverage                     Check TC coverage for files changed vs upstream base branch (DEFAULT)
$apb-code-coverage coverage-up [threshold=80]         Raise coverage on the changed files up to {threshold}% (loops until met or max iterations)
```

**Default action:** When invoked with no arguments
(`$apb-code-coverage`), run `check-coverage`.

## Phase Flow

```
check-coverage:  [Detect] -> [Sync] -> [Diff] -> [Measure]
coverage-up:     [Measure] -> [Augment] -> [Verify] -(loop if below threshold)-> [Augment]
```

`coverage-up` reuses `check-coverage`'s `Measure` output as its starting
point, then alternates between `Augment` (adding/expanding tests) and
`Verify` (re-running coverage) until the threshold is met or the max
iteration count is reached.

## Phase Progress Visualization

```
[Detect] -> [Sync] -> [Diff] -> [Measure] -> [Augment] -> [Verify]

Status:
  [Phase] done     -> phase completed
  [Phase] active   -> currently working
  [Phase] pending  -> not yet started
```

---

## Phase:Detect

Discover the project's test-coverage command from `package.json`.

### Prerequisites

- Current working directory is a Node.js project (`package.json` exists).
- Node / npm (or pnpm / yarn) toolchain installed.

### Steps

1. Read `package.json` at the project root.
2. Search `scripts` for a coverage-capable command, in this priority:
   - Script named `coverage`, `test:coverage`, `test:cov`, `cov`.
   - Any script whose body contains `--coverage`, `nyc`, `c8`,
     `jest --coverage`, `vitest run --coverage`, or similar.
3. If multiple candidates exist, prefer the most specific
   (`test:coverage` over generic `test`).
4. If none found, stop and ask the user to provide the command manually.
5. Print the resolved command (e.g. `npm run test:coverage`).

### Output Path

```
Console only (resolved command printed; no files written).
```

---

## Phase:Sync

Fetch the upstream remote so the base branch is up to date.

### Prerequisites

- Git repository initialized.
- An `upstream` remote is configured (fallback to `origin` if not).

### Steps

1. Determine the base remote: `upstream` if present, else `origin`.
2. Run `git fetch {remote} --prune`.
3. Resolve the base branch by checking which exists on the remote, in order:
   - `{remote}/develop`
   - `{remote}/main`
   - `{remote}/master`
4. Print the resolved base ref (e.g. `upstream/develop`).
5. On fetch failure (auth, network), print the error and stop.

### Output Path

```
Console only (resolved base ref printed; local git index updated by fetch).
```

---

## Phase:Diff

Extract the list of changed source files between `HEAD` and the base ref.

### Prerequisites

- Sync phase completed; base ref is known.
- Working tree state is acceptable (uncommitted changes are included
  in the diff set by default; warn the user if present).

### Steps

1. Run `git diff --name-only --diff-filter=ACMR {base_ref}...HEAD`.
2. Filter the result to source files the coverage tool can measure
   (default: `*.ts`, `*.tsx`, `*.js`, `*.jsx`; exclude `*.test.*`,
   `*.spec.*`, `__tests__/**`, `dist/**`, `build/**`, `node_modules/**`).
3. If the filtered list is empty, stop and tell the user there is
   nothing to measure.
4. Print the file count and the list (truncate if > 50).

### Output Path

```
.apb-code-coverage/changed-files.txt    (one path per line)
```

---

## Phase:Measure

Run coverage restricted to the changed files and print a summary.

### Prerequisites

- Detect phase resolved a coverage command.
- Diff phase produced a non-empty `changed-files.txt`.

### Steps

1. Load `changed-files.txt`.
2. Invoke the resolved coverage command with the file list scoped to
   the changed files. Examples:
   - Jest: `npm run test:coverage -- --collectCoverageFrom="<files>" --findRelatedTests <files>`
   - Vitest: `npm run test:coverage -- --coverage.include=<files> related <files>`
   - c8 / nyc: run the test command under `c8 --include=<files>` /
     `nyc --include=<files>`
3. Capture the coverage tool's summary output (statements, branches,
   functions, lines).
4. Print a per-file coverage table and an overall summary for the
   changed set.
5. Persist the raw report for follow-up inspection.
6. Exit non-zero if the overall coverage is below a user-provided
   threshold (optional; default: no threshold).

### Output Path

```
.apb-code-coverage/report.txt           (human-readable summary)
.apb-code-coverage/report.json          (raw coverage data, if the tool supports JSON output)
```

---

## Phase:Augment

Add or expand tests for the changed files until per-file coverage meets
the target threshold.

### Prerequisites

- Measure phase completed; `.apb-code-coverage/report.json` (or `report.txt`)
  exists with per-file coverage data.
- `.apb-code-coverage/changed-files.txt` exists.
- Target threshold resolved (default: `80`%; user may override via arg).
- Max iteration count resolved (default: `5`) — prevents infinite loops.

### Steps

1. Load the latest coverage report and the changed-files list.
2. Filter files whose line coverage is below `{threshold}`%.
3. For each below-threshold file, in priority order (lowest coverage first):
   - Locate the matching test file (`{file}.test.ts(x)` /
     `{file}.spec.ts(x)` / `__tests__/{file}.test.ts(x)`).
   - If missing, create one next to the source file using the project's
     existing test style (detect from a sibling test).
   - Identify uncovered lines/branches from the coverage report.
   - Add focused test cases covering those lines/branches.
4. Save the augmented tests; do NOT delete or weaken existing assertions.
5. Record this iteration in `.apb-code-coverage/augment.log`
   (timestamp, files touched, tests added).

### Output Path

```
<project>/**/*.test.{ts,tsx,js,jsx}       (new or extended test files)
.apb-code-coverage/augment.log           (one entry per iteration)
```

---

## Phase:Verify

Re-run the coverage script, check against the threshold, and loop back
to Augment if not yet met.

### Prerequisites

- Augment phase ran at least once in the current `coverage-up` invocation.
- Coverage command resolved by Detect is still valid.

### Steps

1. Re-run the Measure phase logic (coverage command scoped to
   `changed-files.txt`).
2. Compare each file's coverage against `{threshold}`%.
3. If every changed file meets the threshold:
   - Print a PASS summary (per-file + overall coverage, iterations used).
   - Stop with exit code 0.
4. Else, if iteration count < max iterations:
   - Print remaining below-threshold files and current coverage.
   - Loop back to the Augment phase with the updated report.
5. Else (max iterations reached):
   - Print a FAIL summary listing files that never met the threshold
     and the last-known coverage for each.
   - Stop with non-zero exit code so CI can fail.
6. Persist the final report.

### Output Path

```
.apb-code-coverage/report.txt           (final summary, overwritten each run)
.apb-code-coverage/report.json          (final raw data)
.apb-code-coverage/augment.log          (appended; full iteration history)
```
