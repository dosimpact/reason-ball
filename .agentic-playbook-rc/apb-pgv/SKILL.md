---
name: apb-pgv
description: |
  gkit PGV (Plan -> Gradate -> Validate) cycle driver skill. Uses the gkit
  MCP tools to run a feature end-to-end through the three phases, with
  plan-enrichment sub-commands (plan-gradate, plan-validate, plan-skill-add)
  that recommend and review which apb-* skills to use at each downstream
  phase.
  Phases: Plan -> Gradate -> Validate.
  Triggers: apb-pgv, pgv, plan gradate validate, harness cycle,
  gkit 사이클, 플랜 그레이데이트 밸리데이트, 하네스 사이클,
  gkit サイクル, プラン グレーデート バリデート,
  gkit 循环, 计划 精炼 验证,
  ciclo pgv, cycle pgv, PGV-Zyklus, ciclo pgv
  Do NOT use for: creating new skills (use $apb-skill-create),
  PDCA-style workflows (use legacy $pdca on apb projects),
  direct state file edits (state must only change via gkit_* MCP tools).
---

# apb-pgv — PGV Cycle Driver

> Runs a feature through Plan → Gradate → Validate using the gkit MCP server.
> All PGV artifacts (plan/gradate/validate docs, state file) live under
> `.apb-workspace/docs/` at the project root.
> All state changes happen through `gkit_*` MCP tools; this skill must never
> edit `.apb-workspace/docs/.apb-status.json` directly.

## Usage

```
apb-pgv plan {feature-Name}              Start or resume the plan phase (auto-init state if missing)
apb-pgv plan-gradate {feature-Name}      Enrich plan for gradate; (1) recommend (2) review gradate-phase skills
apb-pgv plan-validate {feature-Name}     Enrich plan with E2E scenarios; (1) recommend (2) review validate-phase skills
apb-pgv plan-skill-add {feature-Name}    Write chosen gradate/validate skills into plan "Skills" section
apb-pgv gradate {feature-Name}           Enter gradate phase: design, implement, self-gap-check until gap < 1%
apb-pgv validate {feature-Name}          Enter validate phase: run plan E2E scenarios and produce validate report
```

Missing `{feature-Name}` → return this usage block and stop.

## Workspace Layout

All PGV documents and state are kept inside `.apb-workspace/docs/` so the
project root stays clean:

```
<projectDir>/
└── .apb-workspace/
    └── docs/
        ├── .apb-status.json
        ├── 01-plan/{feature}.plan.md
        ├── 02-gradate/{feature}.gradate.md
        ├── 03-validate/{feature}.validate.md
        └── 99-archive/{timestamp}-{feature}/...
```

## Phase Flow

```
[Plan] -> [Gradate] -> [Validate]
ㄴ Plan Optional : [Plan-Gradate] -> [Plan-Validate] -> [Plan-Skill-Add]
```

## Phase Progress Visualization

```
[Plan] -> [Gradate] -> [Validate]
ㄴ Plan Optional : [Plan-Gradate] -> [Plan-Validate] -> [Plan-Skill-Add]

Status:
  [Phase] done     -> phase completed (status file reflects it)
  [Phase] active   -> currently working
  [Phase] pending  -> not yet started
```

---

## Plan Phase

Initialize state if needed and create the plan document.

### Prerequisites

- `{feature-Name}` is provided (kebab-case recommended).
- gkit MCP server is configured in `.cognition/config.json`.

### Steps

1. Call `gkit_get_status` to check whether `.apb-workspace/docs/.apb-status.json` exists.
2. If the state file is missing, call `gkit_init` with the current project dir.
3. Call `gkit_pgv_plan` with `{feature-Name}`.
4. If the feature already exists with `status != null`, do **not** overwrite the plan file; inform the user.
5. Call `gkit_get_status --feature {feature-Name}` and summarize the result.

### Output Path

```
.apb-workspace/docs/01-plan/{feature-Name}.plan.md
```

---

## Plan-Gradate Phase

Enrich the plan to make gradate (design + implementation) easier, and recommend `apb-*` skills to use in the gradate phase.

### Prerequisites

- `.apb-workspace/docs/01-plan/{feature-Name}.plan.md` exists (error otherwise, tell the user to run `apb-pgv plan` first).

### Steps

1. Read the plan file.
2. Strengthen the `## Verification` section with: implementation scope, public interfaces, external/internal dependencies, risky areas.
3. **Recommend** gradate-phase skills:
   - Scan `.agents/skills/apb-*` whose SKILL.md metadata has `phase: gradate` (or whose description implies design/implementation).
   - Present a shortlist (max 5) with one-line rationale each.
4. **Review** the recommended list: for each candidate explicitly explain why it fits or does not fit this feature, then mark keep/drop.
5. Save the enriched plan back to the same file (do not create a new file).

### Output Path

```
.apb-workspace/docs/01-plan/{feature-Name}.plan.md        (updated in place)
```

---

## Plan-Validate Phase

Enrich the plan with E2E test scenarios and recommend `apb-*` skills to use in the validate phase.

### Prerequisites

- `.apb-workspace/docs/01-plan/{feature-Name}.plan.md` exists.

### Steps

1. Read the plan file.
2. Under `## Validation → E2E 시나리오`, add at least one concrete Given/When/Then (or equivalent) scenario per Validation bullet.
3. **Recommend** validate-phase skills:
   - Scan `.agents/skills/apb-*` whose metadata has `phase: validate` (e.g. `apb-bruno-api-tests`, `apb-playwright-e2e`, `apb-unit-test-write`, `apb-gap-analysis`, `apb-validation-report`, `apb-static-analysis`, `apb-code-coverage`).
   - Present a shortlist (max 5) with rationale.
4. **Review** each recommendation against the feature's actual surface (API? UI? library?) and keep/drop accordingly.
5. Save the updated plan back in place.

### Output Path

```
.apb-workspace/docs/01-plan/{feature-Name}.plan.md        (updated in place)
```

---

## Plan-Skill-Add Phase

Record the final chosen skills for gradate and validate inside the plan's Skills section.

### Prerequisites

- `.apb-workspace/docs/01-plan/{feature-Name}.plan.md` exists and already has gradate/validate recommendations from previous phases.

### Steps

1. Read the plan file.
2. Under `## Skills → Gradate 단계`, list the skills kept after plan-gradate review (`apb-*` names only).
3. Under `## Skills → Validate 단계`, list the skills kept after plan-validate review.
4. If a skill is outside the `apb-*` namespace, flag it and require user confirmation before adding.
5. Save the updated plan back in place.

### Output Path

```
.apb-workspace/docs/01-plan/{feature-Name}.plan.md        (updated in place)
```

---

## Gradate Phase

Produce the gradate document and drive implementation until the self-reported gap is < 1%.

### Prerequisites

- `.apb-workspace/docs/01-plan/{feature-Name}.plan.md` exists.
- Chosen gradate-phase skills are listed in the plan's `## Skills` section.

### Steps

1. Call `gkit_pgv_gradate` with `{feature-Name}` (creates the gradate doc and transitions status).
2. Fill the `## Implementation Draft` section (architecture overview, modules, interfaces, dependencies, data flow).
3. Invoke chosen gradate skills (e.g. `apb-react-directory-policy`) to keep the implementation aligned.
4. Implement the code following the gradate design.
5. Self-run a gap check: compare gradate design items vs. actual code and update the `## Gap Analysis (Pre-Validate)` section.
6. Loop steps 3-5 until the gap is < 1% (i.e. every designed item has a matching implementation), then proceed.
7. Call `gkit_get_status --feature {feature-Name}` and report the snapshot.

### Output Path

```
.apb-workspace/docs/02-gradate/{feature-Name}.gradate.md
(plus any optional supporting docs under .apb-workspace/docs/02-gradate/{feature-Name}.*.md)
```

---

## Validate Phase

Produce the validate report by running the E2E scenarios authored in plan-validate.

### Prerequisites

- `.apb-workspace/docs/02-gradate/{feature-Name}.gradate.md` exists (otherwise `gkit_pgv_validate` will error; instruct user to run gradate first).
- Chosen validate-phase skills are listed in the plan's `## Skills` section.

### Steps

1. Call `gkit_pgv_validate` with `{feature-Name}` (creates the validate report and transitions status).
2. Run each E2E scenario from the plan's `## Validation → E2E 시나리오` using the skills listed in `## Skills → Validate 단계`.
3. Invoke `apb-gap-analysis` to produce the gap table (Design ↔ Implementation).
4. Invoke `apb-validation-report` to populate the checklist (PASS/FAIL/SKIP), test results, and Action Items.
5. If the MCP server is not running or any `gkit_*` tool is not exposed, stop and return an actionable error to the user (do not edit the state file manually).
6. Call `gkit_get_status --feature {feature-Name}` and summarize: final status, document paths, overall verdict.

### Output Path

```
.apb-workspace/docs/03-validate/{feature-Name}.validate.md
```
