---
name: apb-gap-analysis
phase: validate
description: |
  Compares the gradate design document against the actual implementation
  and returns a structured Gap table (missing / extra / matched) plus an
  overall match rate percentage. Feeds directly into
  `apb-validation-report`.
  Phases: Collect -> Compare -> Report.
  Triggers: gap analysis, design vs code, coverage of design, drift,
  갭 분석, 설계 구현 차이, 드리프트,
  ギャップ分析, 差分分析, 设计与实现差异,
  análisis de brechas, analyse d'écart, Lückenanalyse
  Do NOT use for: runtime behavior testing (use $apb-unit-test-write,
  $apb-playwright-e2e, or $apb-bruno-api-tests),
  coverage percentage (use $apb-code-coverage),
  filling the validate report itself (use $apb-validation-report).
---

# apb-gap-analysis

> Produces the canonical Gap Table for the validate phase.

## Usage

```
apb-gap-analysis run {feature}    Emit Gap Table + match rate for the feature
```

Input (prerequisite): `.apb-workspace/docs/02-gradate/{feature}.gradate.md` (Implementation Draft: architecture, modules, interfaces, dependencies, data flow) AND the implementation code reachable from the repo.
Output: Gap Table markdown snippet ready to paste into `.apb-workspace/docs/03-validate/{feature}.validate.md` (section 3).

## Phase Flow

```
[Collect] -> [Compare] -> [Report]
```

## Phase Progress Visualization

```
[Collect] -> [Compare] -> [Report]

Status:
  [Phase] done     -> phase completed
  [Phase] active   -> currently working
  [Phase] pending  -> not yet started
```

---

## Collect Phase

### Prerequisites

- Gradate document exists.
- Implementation code is checked out in the current workspace.

### Steps

1. Extract the design checklist from the gradate doc:
   - Architecture nodes (modules/components)
   - Module table rows (Responsibility / Public Interface)
   - Dependencies
   - Data flow steps
2. For each item, note expected file/function names.
3. Ignore items explicitly marked "Optional" or "Out of Scope".

### Output Path

```
(no file; produces an internal checklist)
```

---

## Compare Phase

### Prerequisites

- Checklist from Collect phase.

### Steps

1. For each checklist item, search the repo (grep / AST) for a matching symbol.
2. Classify each item:
   - **Matched** — present and signatures look compatible.
   - **Missing** — not found.
   - **Partial** — found but signature/behavior differs (specify how).
   - **Extra** — implementation exists that is not in the design (must be justified).
3. Compute `matchRate = matched / (matched + missing + partial) * 100`. Extra items are reported but do not reduce the rate.

### Output Path

```
(no file; internal comparison result)
```

---

## Report Phase

### Prerequisites

- Compare phase complete.

### Steps

1. Render a Markdown Gap Table:
   ```
   | 설계 항목 | 구현 상태 | 비고 |
   |-----------|:---------:|------|
   | moduleA.fnX | ✅ 구현 | path/to/file.ts:42 |
   | moduleA.fnY | ❌ 미구현 | design line 17 |
   | moduleB.fnZ | ⚠ 부분 | signature mismatch |
   | moduleC.new | ➕ 설계 초과 | added in impl |
   ```
2. Prepend a summary line: `Overall Match Rate: NN%`.
3. If `matchRate >= 99`, recommend proceeding to `gkit_pgv_validate`. Otherwise list concrete follow-up actions per Missing / Partial item.
4. Pass the rendered block to `apb-validation-report` for inclusion in section 3.

### Output Path

```
.apb-workspace/docs/03-validate/{feature}.validate.md   (section 3 only; updated via apb-validation-report)
```
