---
name: apb-templates
description: |
  PDCA document templates for consistent documentation. Provides template
  selection guide based on phase and project level.
  Phases: Select -> Apply.
  Triggers: template, plan document, design document, analysis, report,
  템플릿, 계획서, 설계서, テンプレート, 模板, plantilla, modèle, Vorlage, modello
  Do NOT use for: executing PDCA actions (use $pdca instead).
---

# apb Document Templates

> Use these templates when generating PDCA documents for consistent format and structure.

## Usage

```
$apb-templates select {phase}    Select the correct PDCA template for a phase and project level
$apb-templates apply {template}  Apply the selected template with concrete variable values
```

## Phase Flow

```
[Select] -> [Apply]
```

## Phase Progress Visualization

```
[Select] -> [Apply]

Status:
  [Phase] done     -> phase completed
  [Phase] active   -> currently working
  [Phase] pending  -> not yet started
```

---

## Phase:Select

Choose the correct template for the requested PDCA phase and project level.

### Prerequisites

- The requested document phase is known.
- Project level is known or can be inferred as Starter, Dynamic, or Enterprise.

### Steps

1. Match the requested PDCA phase to the template selection matrix.
2. If the phase is Design, choose the Starter, Dynamic, or Enterprise design template.
3. Confirm the output path pattern before applying the template.

### Output Path

```
(no file; produces a selected template path and destination path)
```

---

## Phase:Apply

Create a document from the selected template using concrete project values.

### Prerequisites

- Select phase completed.
- Required variables such as `{feature}`, `{date}`, `{author}`, `{project}`, and `{version}` are known.

### Steps

1. Load the selected template from `references/`.
2. Replace every `{variable}` placeholder with concrete values.
3. Write the document to the selected output path.
4. Preserve document standards, common header, status tracking, and cross-reference rules.

### Output Path

```
docs/{phase-path}/{feature}.{type}.md
```

---

## Reference: Available Templates

| Template | File | Purpose |
|----------|------|---------|
| Plan | `references/plan.template.md` | Feature planning document |
| Design | `references/design.template.md` | Technical design (Dynamic level) |
| Design (Starter) | `references/design-starter.template.md` | Simplified design for beginners |
| Design (Enterprise) | `references/design-enterprise.template.md` | Enterprise MSA design |
| Analysis | `references/analysis.template.md` | Gap analysis report |
| Report | `references/report.template.md` | Completion report |
| Do | `references/do.template.md` | Implementation guide |

## Reference: Template Selection Matrix

### By PDCA Phase

| Phase | Template | Output Path |
|-------|----------|-------------|
| Plan | plan.template.md | `docs/01-plan/features/{feature}.plan.md` |
| Design | design*.template.md | `docs/02-design/features/{feature}.design.md` |
| Do | do.template.md | Implementation guide (in-session) |
| Check | analysis.template.md | `docs/03-analysis/{feature}.analysis.md` |
| Act | (iterate based on analysis) | Updated source code |
| Report | report.template.md | `docs/04-report/features/{feature}.report.md` |

### By Project Level

| Level | Design Template | Notes |
|-------|----------------|-------|
| Starter | design-starter.template.md | Simplified, pages + components only |
| Dynamic | design.template.md | Full template with API + data model |
| Enterprise | design-enterprise.template.md | MSA, K8s, Terraform, observability |

## Reference: Variable Substitution

Templates use `{variable}` syntax. Replace these when generating documents:

| Variable | Description | Example |
|----------|-------------|---------|
| `{feature}` | Feature name (kebab-case) | `user-auth` |
| `{date}` | Creation date | `2026-02-14` |
| `{author}` | Document author | `Team` |
| `{project}` | Project name | `my-saas` |
| `{version}` | Document version | `0.1` |

## Reference: Document Output Paths

```
docs/
├── 01-plan/
│   └── features/
│       └── {feature}.plan.md
├── 02-design/
│   └── features/
│       └── {feature}.design.md
├── 03-analysis/
│   └── {feature}.analysis.md
└── 04-report/
    └── features/
        └── {feature}.report.md
```

## Reference: Document Standards

### File Naming Rules

```
{feature}.{type}.md             # user-auth.design.md
{number}_{english_name}.md      # 01_system_architecture.md
```

### Common Header

All PDCA documents must include:

```markdown
# {Document Title}

> **Summary**: {One-line description}
>
> **Author**: {Name}
> **Created**: {YYYY-MM-DD}
> **Status**: {Draft | Review | Approved | Deprecated}

---
```

### Version Control

Track changes within documents:

```markdown
## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-01-01 | Initial draft | Author |
```

### Cross-References

Link related PDCA documents:

```markdown
## Related Documents
- Plan: [feature.plan.md](../01-plan/features/feature.plan.md)
- Design: [feature.design.md](../02-design/features/feature.design.md)
- Analysis: [feature.analysis.md](../03-analysis/feature.analysis.md)
```

### Status Tracking

| Status | Meaning | AI Behavior |
|--------|---------|-------------|
| Approved | Use as reference | Follow as-is |
| In Progress | Being written | Notify of changes |
| On Hold | Temporarily paused | Request confirmation |
| Deprecated | No longer valid | Ignore |

### Conflict Resolution

- **Code vs Design mismatch**: Code is truth, suggest document update
- **Multiple versions**: Reference only the latest version

## Reference: Usage Notes

When a PDCA phase requires document creation:

1. Detect project level (Starter/Dynamic/Enterprise)
2. Select appropriate template from this skill's references
3. Replace `{variable}` placeholders with actual values
4. Create document at the correct output path
5. Update `.pdca-status.json` with phase progression

Templates are loaded on-demand from the `references/` directory.
