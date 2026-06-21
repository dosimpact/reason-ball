---
name: apb-validation-report
phase: validate
description: |
  Fills in the validate template produced by `gkit_pgv_validate`:
  Scope, Validation checklist (PASS/FAIL/SKIP), Gap Table, E2E results,
  Skill Usage Log, Action Items, and final verdict. Serves as the single
  "gate" skill that produces the final artifact of the validate phase.
  Phases: Gather -> Score -> Write -> Conclude.
  Triggers: validation report, validate report, qa report, PASS FAIL,
  검증 리포트, 결과 리포트, QA 리포트,
  バリデーションレポート, 検証レポート, 验证报告, 测试报告,
  informe de validacion, rapport de validation, Validierungsbericht
  Do NOT use for: running tests (use $apb-playwright-e2e,
  $apb-bruno-api-tests, $apb-unit-test-write),
  computing design-vs-code gaps (use $apb-gap-analysis),
  lint/type/security scans (use $apb-static-analysis).
---

# apb-validation-report

> Fills the validate phase's final report with concrete PASS/FAIL/SKIP
> evidence and closes the PGV loop.

## Usage

```
apb-validation-report build {feature}    Populate .apb-workspace/docs/03-validate/{feature}.validate.md end-to-end
apb-validation-report status {feature}   Summarize current PASS/FAIL/SKIP counts from the file
```

Input (prerequisites):
- `.apb-workspace/docs/03-validate/{feature}.validate.md` exists (created by `gkit_pgv_validate`).
- Gap Table from `apb-gap-analysis`.
- Test results from the test-author skills (`apb-playwright-e2e`, `apb-bruno-api-tests`, `apb-unit-test-write`).
- Optionally: `apb-static-analysis` output, `apb-code-coverage` output.

Output: `.apb-workspace/docs/03-validate/{feature}.validate.md` with every TODO replaced by real evidence.

## Phase Flow

```
[Gather] -> [Score] -> [Write] -> [Conclude]
```

## Phase Progress Visualization

```
[Gather] -> [Score] -> [Write] -> [Conclude]

Status:
  [Phase] done     -> phase completed
  [Phase] active   -> currently working
  [Phase] pending  -> not yet started
```

---

## Phase:Gather

### Prerequisites

- The feature's validate report exists (from `gkit_pgv_validate`).
- The plan's Validation checklist items are readable.

### Steps

1. Collect every Validation bullet from the plan and map it 1-to-1 to a row in the report's "2. Validation Checklist" table.
2. Collect E2E results from Playwright / Bruno / unit-test runs (logs, report paths).
3. Collect the Gap Table from `apb-gap-analysis`.
4. Collect outputs from `apb-static-analysis` and `apb-code-coverage` if present.

### Output Path

```
(no file; internal evidence bundle)
```

---

## Phase:Score

### Prerequisites

- Evidence bundle from Gather.

### Steps

1. For each Validation item assign exactly one of `PASS` / `FAIL` / `SKIP`. `SKIP` requires a written reason.
2. Count totals: `PASS`, `FAIL`, `SKIP`.
3. For each E2E scenario assign `PASS` / `FAIL` / `SKIP` and link the log path.
4. Compute the final verdict:
   - `PASS` — all items PASS and match rate ≥ 99%.
   - `CONDITIONAL PASS` — all critical items PASS, non-critical FAIL/SKIP are tracked as Action Items.
   - `FAIL` — any critical item is FAIL.

### Output Path

```
(no file; internal scoring)
```

---

## Phase:Write

### Prerequisites

- Scoring complete.

### Steps

1. Open `.apb-workspace/docs/03-validate/{feature}.validate.md` and replace each TODO in this order:
   - Section 1 (Scope): bullet list copied from the plan.
   - Section 2 (Validation Checklist): one row per item, Evidence cell must link to a file/log.
   - Section 3 (Gap Analysis): paste the Gap Table from `apb-gap-analysis`.
   - Section 4 (E2E Test Results): one row per scenario with Tool, Result, Log.
   - Section 5 (Skill Usage Log): tick every skill that was actually invoked.
   - Section 6 (Action Items): every FAIL/SKIP must appear here as a checkbox task.
   - Section 7 (Conclusion): the verdict from Score phase with a one-sentence rationale.
2. Preserve front-matter (Feature/Date/Status) and do not reorder sections.
3. After writing, re-read the file and ensure no `<!-- TODO -->` placeholders remain.

### Output Path

```
.apb-workspace/docs/03-validate/{feature}.validate.md
```

---

## Phase:Conclude

### Prerequisites

- Write phase complete.

### Steps

1. Print a one-paragraph summary: verdict, counts, blocking Action Items.
2. If verdict is `FAIL`, recommend: fix blockers, re-run the relevant test skills, then re-run `apb-validation-report build {feature}`.
3. If verdict is `PASS`, recommend archiving via `gkit_pgv_archive` when the work is fully merged.
4. Optionally post the summary to the commit message or PR body.

### Output Path

```
(no file; stdout summary)
```
