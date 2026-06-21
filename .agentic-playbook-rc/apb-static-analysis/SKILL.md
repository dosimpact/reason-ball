---
name: apb-static-analysis
phase: validate
description: |
  Runs the project's static checks in one pass: lint (ESLint/Biome),
  type-check (tsc --noEmit), and security scan (npm audit / gitleaks when
  available). Summarizes errors by file and severity, and exits non-zero
  on any failure so CI / the validate report can flag it.
  Phases: Detect -> Run -> Aggregate.
  Triggers: static analysis, lint, typecheck, eslint, tsc, security scan,
  정적 분석, 린트, 타입체크, 보안 스캔,
  静的解析, リント, 型チェック, 静态分析, 类型检查,
  analisis estatico, analyse statique, statische Analyse
  Do NOT use for: running tests (use $apb-unit-test-write,
  $apb-playwright-e2e, $apb-bruno-api-tests),
  coverage (use $apb-code-coverage),
  writing the final validate report (use $apb-validation-report).
---

# apb-static-analysis

> Single entry point for lint + type-check + security checks.

## Usage

```
apb-static-analysis run           Run all detected checks and print a summary
apb-static-analysis run --diff    Run only on files changed vs. upstream base branch
```

Input (prerequisite): a JS/TS project (detected via `package.json`).
Output: a Markdown summary block ready for section 5 of the validate report and a non-zero exit code on failure.

## Phase Flow

```
[Detect] -> [Run] -> [Aggregate]
```

## Phase Progress Visualization

```
[Detect] -> [Run] -> [Aggregate]

Status:
  [Phase] done     -> phase completed
  [Phase] active   -> currently working
  [Phase] pending  -> not yet started
```

---

## Detect Phase

### Prerequisites

- `package.json` exists at the project root.

### Steps

1. Detect lint tool:
   - `eslint` present → `npx eslint .` (or the project's lint script).
   - `@biomejs/biome` present → `npx biome check`.
   - Otherwise mark lint as `SKIP`.
2. Detect type-check:
   - `typescript` present → `npx tsc --noEmit`.
   - Otherwise mark type-check as `SKIP`.
3. Detect security scan:
   - Prefer the project's existing script (`npm run audit`, `npm run security`).
   - Fallback: `npm audit --production --audit-level=high` and `gitleaks detect` if installed.

### Output Path

```
(no file; captures which tools will run)
```

---

## Run Phase

### Prerequisites

- Detect phase complete.

### Steps

1. Run each detected check with a timeout and capture stdout/stderr.
2. Record exit codes. Treat any non-zero as a FAIL for that check.
3. For `--diff`, pass the changed-file list to each tool (`eslint {files}`, `tsc --noEmit {files}`, `gitleaks detect --log-opts="<base>..HEAD"`).
4. Persist raw logs under `reports/static-analysis/{YYYY-MM-DD-HHMM}/`.

### Output Path

```
reports/static-analysis/{YYYY-MM-DD-HHMM}/{lint|typecheck|security}.log
```

---

## Aggregate Phase

### Prerequisites

- Run phase complete.

### Steps

1. Produce a Markdown summary:
   ```
   | Check      | Result | Errors | Warnings | Log |
   |------------|:------:|:------:|:--------:|-----|
   | Lint       | PASS   | 0      | 3        | … |
   | Type Check | FAIL   | 2      | 0        | … |
   | Security   | PASS   | 0      | 0        | … |
   ```
2. Below the table list the top 5 errors per failing check with file:line.
3. Overall exit code: `0` only if every non-SKIP check is PASS.
4. Hand off the summary to `apb-validation-report` for inclusion in section 2 (Validation Checklist) and/or as an Action Item when FAIL.

### Output Path

```
(stdout; the summary is pasted by apb-validation-report into the validate report)
```
