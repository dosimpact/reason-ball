---
name: apb-playbook-create
description: |
  Guide for creating, updating, and inserting playbook entries that capture
  reusable reasoning, decision logic, implementation lessons, and operating
  rules in a Korean guide format.
  Phases: Create Playbook -> Update/Insert Playbook -> Refactor Playbook.
  Triggers: playbook, apb playbook create, reasoning playbook,
  create playbook, update playbook, insert playbook, update insert playbook,
  refactor playbook, 플레이북, 사고판단 플레이북, 규칙서, 플레이북 작성,
  플레이북 업데이트, 플레이북 삽입, 플레이북 리팩터링.
  Do NOT use for: generic skill creation (use $apb-skill-create),
  generic documentation templates (use $apb-templates), runtime validation
  reports (use $apb-validation-report).
---

# Playbook Create

> Maintain a playbook by creating the document, updating existing entries, or
> inserting new lessons that clarify reusable reasoning and decision rules.

## Usage

```
$apb-playbook-create create-playbook     Create or initialize a playbook
$apb-playbook-create update-playbook     Update or insert a playbook topic from new learning
$apb-playbook-create insert-playbook     Update or insert a playbook topic from new learning
$apb-playbook-create refactor-playbook   Normalize category/task headings and prefix numbers
```

## Phase Flow

```
[Create Playbook] -> [Update/Insert Playbook] -> [Refactor Playbook]
```

## Phase Progress Visualization

```
[Create Playbook] -> [Update/Insert Playbook] -> [Refactor Playbook]

Status:
  [Phase] done     -> phase completed
  [Phase] active   -> currently working
  [Phase] pending  -> not yet started
```

---

## Common Playbook Rules

These rules apply to every phase.

1. Keep the document in Korean, while preserving product, SDK, API, command,
   file, or domain-specific names in their original language.
2. H3 is the smallest reusable playbook unit. Each H3 should cover one focused
   judgment rule, implementation pattern, validation flow, review checklist,
   operational response, or maintenance procedure.
3. If source material contains multiple concepts, keep only the core rule in
   the current H3 and create separate H3 tasks for other reusable rules when
   needed.
4. Avoid turning one H3 into a full lecture note. Long definitions, exhaustive
   examples, downstream analysis methods, charts, and model choices should
   appear only when they are necessary to apply that H3's rule.
5. Prefer this H3 structure:

   ```markdown
   ### {category_number}.{task_number} {task}

   목적 : {why this rule or pattern exists}

   상세 로직

   1. 판단 기준 및 적용 조건
     - {when to apply this rule, pattern, or decision}
     - {important constraint, exception, or failure mode}

   2. 실행 절차 및 구현 규칙
     - {concrete implementation, operation, or documentation rule}
     - {important verification, sync, or maintenance constraint}
   ```

6. Prefer two numbered sections only: `판단 기준 및 적용 조건` and
   `실행 절차 및 구현 규칙`. Add a third section only when an actionable
   exception or pitfall cannot fit cleanly into those two sections.
7. Keep each numbered section short: usually 2-4 bullets. If a section needs
   more than 4 bullets, split the topic or remove supporting explanation.
8. Prefer concrete project facts over generic advice. Include API names, state
   fields, commands, file paths, domain terms, decision criteria, or failure
   symptoms when they prevent future mistakes.
9. Do not use `### 상세 로직`; write `상세 로직` as plain body text under the
   H3 task.

---

## Phase:Create Playbook

Create or initialize a playbook document without replacing existing entries.

### Prerequisites

- The target project or domain has recurring reasoning, implementation,
  operation, or decision logic worth preserving as rules.
- The intended playbook path is provided by the user or inferred from the
  project context. If the user does not provide a path, use the repository's
  established docs location or ask only when no safe path can be inferred.
- Record the resolved path and reuse it consistently in every phase:

  ```
  {resolved_playbook_path}
  ```

### Steps

1. Inspect the target path before writing.
2. Apply `Common Playbook Rules` when creating any initial structure or topic.
3. If the file exists, preserve all current content and treat this phase as
   complete.
4. If the file is missing, create it with this title:

   ```markdown
   # Playbook
   ```

5. Do not add example-specific content during this phase unless the user
   provides a concrete playbook topic.
6. Use numbered H2 category headings and numbered H3 task headings when adding
   structure later:

   ```markdown
   ## 1. {category}

   ### 1.1 {playbook task}
   ```

### Output Path

```
{resolved_playbook_path}
```

---

## Phase:Update/Insert Playbook

Update an existing playbook entry or insert a new one when real work reveals a
clear reusable reasoning rule, decision criterion, implementation practice, or
operational constraint.

### Prerequisites

- The playbook file exists or `Create Playbook` has been completed.
- New learning is backed by implementation, tests, debugging results, user
  feedback, operational evidence, or observed project behavior.
- The topic has a clear reusable lesson, rule, or decision criterion, not just
  a general note.

### Steps

1. Read the full playbook and list existing H2 category headings and H3 task
   headings.
2. Apply `Common Playbook Rules` before deciding the final H3 scope.
3. Decide whether the learning updates an existing H3 or needs a new H3:
   - If a matching H3 already exists, update only that H3 unless the user asks
     for a wider rewrite.
   - If no matching H3 exists, insert a new H3 in the most related category.
4. Choose or create a short Korean H2 category title that groups related
   reasoning rules, decision criteria, implementation lessons, or operating
   practices.
5. Choose a short Korean H3 task title that describes one reusable judgment
   rule or implementation pattern.
6. For updates, preserve the existing H3 structure when it already follows the
   common rules. For inserts, use the common H3 structure.
7. For inserts, place the new H3 task after the most related task in the
   matching category. If there is no related category, append a new H2 category
   after the existing content.
8. H2 and H3 headings must include prefix numbers:

   ```markdown
   ## 1. {category}

   ### 1.1 {task}
   ```

9. Avoid duplicate statements already present in the same topic.
10. Keep the style consistent with the existing Korean playbook entry.
11. After update or insertion, renumber H2 and H3 prefix numbers so they are
    sequential and match their hierarchy.

### Output Path

```
{resolved_playbook_path}
```

---

## Phase:Refactor Playbook

Normalize an existing playbook so category and task headings follow the
standard hierarchy and prefix-number convention.

### Prerequisites

- The playbook file exists.
- The document has one or more implementation lessons that can be grouped under
  H2 categories and H3 playbook tasks.
- Refactoring must preserve the implementation facts unless the user asks for a
  content rewrite.
- Refactoring should reduce over-broad H3 entries into focused tasks when one
  task mixes several independent judgment rules.

### Steps

1. Read the full playbook before editing.
2. Apply `Common Playbook Rules` when deciding how to split, keep, or rewrite
   H3 tasks.
3. List all H2 headings and decide whether each one is a category or an
   implementation task.
4. Convert broad grouping headings to numbered H2 category headings:

   ```markdown
   ## 1. {category}
   ```

5. Convert implementation-level playbook entries to numbered H3 task headings:

   ```markdown
   ### 1.1 {task}
   ```

6. Remove `### 상세 로직` headings and replace them with plain body text:

   ```markdown
   상세 로직
   ```

7. Ensure every H3 task follows the common H3 structure:

   ```markdown
   ### {category_number}.{task_number} {task}

   목적 : {why this pattern exists}

   상세 로직

   1. 판단 기준 및 적용 조건
     - {concrete implementation rule}

   2. 실행 절차 및 구현 규칙
     - {concrete implementation rule}
   ```

8. Renumber all H2 and H3 prefixes after moving or converting headings:
   - H2 categories use `1.`, `2.`, `3.` in document order.
   - H3 tasks use `{h2_number}.1`, `{h2_number}.2`, `{h2_number}.3` within
     each category.
   - H3 prefixes must always match the parent H2 prefix.
9. Check that no implementation task remains as H2 and no `### 상세 로직`
   heading remains.
10. Keep bullets concise, preserve concrete product, SDK, API, command, file,
   and domain names, and avoid duplicate statements introduced during
   refactoring.

### Output Path

```
{resolved_playbook_path}
```

---

## Heading Rules

- H1 is reserved for the document title only:

  ```markdown
  # Playbook
  ```

- H2 is reserved for numbered category-level headings. A category groups
  related reasoning rules, decision criteria, implementation lessons, or
  operating practices and must not contain a concrete task directly in the
  heading.

  ```markdown
  ## 1. {category}
  ```

- H3 is reserved for numbered playbook-task headings. A playbook task is the
  concrete reusable unit, such as a decision rule, implementation pattern,
  validation flow, review checklist, operational response, or maintenance
  procedure.
- Each H3 should cover one focused reusable rule. If source material contains
  multiple concepts, keep only the core rule in the current H3 and create
  separate H3 tasks for the other concepts when needed.
- Avoid turning a single H3 into a full lecture note. Long definitions,
  exhaustive examples, downstream analysis methods, charts, and model choices
  should appear only when they are necessary to apply that H3's rule.

  ```markdown
  ### 1.1 {playbook task}
  ```

- H2 and H3 headings require prefix numbers. H2 prefixes use document order
  (`1.`, `2.`, `3.`), and H3 prefixes use the parent H2 number plus local task
  order (`1.1`, `1.2`, `2.1`).
- Do not use `### 상세 로직`. The phrase `상세 로직` is plain body text inside
  each H3 task.
