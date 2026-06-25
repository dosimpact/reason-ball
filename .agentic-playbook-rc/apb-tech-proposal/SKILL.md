---
name: apb-tech-proposal
description: |
  Helps create and revise technical proposals from proposal templates.
  Phases: 브레인스토밍 -> 생성 -> 수정.
  Triggers: tech proposal, technical proposal, proposal template,
  apb tech proposal, 기술제안서, 제안서, 제안서 템플릿, 기술 제안
  Do NOT use for: generic PDCA document templates (use $apb-templates),
  generic skill creation (use $apb-skill-create), validation or QA reports
  (use $apb-validation-report).
---

# Tech Proposal

> Create or revise technical proposals from templates in the local template repository.

## Usage

```
$apb-tech-proposal create {proposal-name}    Select a template and draft a technical proposal
$apb-tech-proposal brainstorm                 Review a template and ask iterative questions to shape proposal content
$apb-tech-proposal edit {proposal-path}      Revise an existing technical proposal
```

## Phase Flow

```
[브레인스토밍] -> [생성] -> [수정]
```

## Phase Progress Visualization

```
[브레인스토밍] -> [생성] -> [수정]

Status:
  [Phase] done     -> phase completed
  [Phase] active   -> currently working
  [Phase] pending  -> not yet started
```

---

## Phase:브레인스토밍

Review a proposal template with the user and iteratively ask questions to discover the proposal content.

### Prerequisites

- The template repository exists at `.agentic-playbook-rc/apb-tech-proposal/template/`.
- At least one template is available, or the user provides the template content to use.
- The user wants collaborative exploration before generating or editing a proposal.

### Steps

1. List available templates from `.agentic-playbook-rc/apb-tech-proposal/template/`.
2. Ask the user which template to review; use `1-aws-proposal.md` as the initial default when the user does not specify another template.
3. Read the selected template and identify its major sections, placeholders, decision points, and missing inputs.
4. Ask focused questions section by section, such as customer/user, customer problem, decision request, goals, non-goals, architecture, alternatives, risks, milestones, owners, and success metrics.
5. Keep questions incremental: ask only the next useful set of questions instead of requesting every field at once.
6. Reflect the user's answers back as concise working notes and identify which template sections those answers can fill.
7. Do not write the proposal file during brainstorming unless the user explicitly asks to proceed to the 생성 phase.
8. Do not infer or invent answers from repository context unless the user explicitly asks for that behavior.
9. End with either a concise brainstorming summary or a clear handoff into the 생성 phase when the user is ready.

### Output Path

```
No file output by default. Optional handoff notes may be used as input to Phase:생성.
```

---

## Phase:생성

Create a technical proposal by selecting and applying a template.

### Prerequisites

- The proposal name is known and suitable for a file path.
- The template repository exists at `.agentic-playbook-rc/apb-tech-proposal/template/`.
- At least one template is available, or the user provides the template content to use.

### Steps

1. List available templates from `.agentic-playbook-rc/apb-tech-proposal/template/`.
2. Ask the user which template to use before drafting the proposal.
3. Use `1-aws-proposal.md` as the initial default template when the user does not specify another template.
4. Read the selected template and identify placeholders, required sections, and expected inputs.
5. Fill only the fields and sections that can be completed from explicit user-provided context, such as proposal name, organization, owner, dates, goals, architecture, risks, milestones, and decision request.
6. Do not infer or invent project, customer, organization, architecture, milestone, cost, risk, or decision details from repository context unless the user explicitly asks for that behavior.
7. When the user provides no proposal content beyond the template selection and proposal name, copy the selected template as-is to the output path and stop.
8. Preserve the selected template's structure and writing style.
9. Write the completed proposal to `docs/proposals/{proposal-name}.proposal.md`.

### Output Path

```
docs/proposals/{proposal-name}.proposal.md
```

---

## Phase:수정

Revise an existing technical proposal while preserving its structure.

### Prerequisites

- The target proposal path is known.
- The proposal file exists and can be read.
- The requested revision goal is known or can be clarified from the user.

### Steps

1. Read the existing proposal before editing.
2. Identify the requested revision scope, such as summary, customer problem, solution, architecture, timeline, cost, risk, or rollout plan.
3. Update only the relevant proposal sections unless the user explicitly requests a broader rewrite.
4. Preserve the proposal's original structure, headings, tone, and template conventions.
5. Keep technical claims concrete and aligned with the current project context.
6. Write the revised content back to the provided proposal path.

### Output Path

```
{proposal-path}
```
