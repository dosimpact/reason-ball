---
name: apb-playbook-create
description: |
  Guide for creating, updating, and inserting LangGraph SDK playbook entries
  that capture implementation lessons in a reusable Korean guide format.
  Phases: Create Playbook -> Update Playbook -> Insert Playbook -> Refactor Playbook.
  Triggers: playbook, langgraph sdk playbook, apb playbook create,
  create playbook, update playbook, insert playbook, refactor playbook, 플레이북,
  LangGraph SDK 플레이북, 플레이북 작성, 플레이북 업데이트, 플레이북 삽입,
  플레이북 리팩터링.
  Do NOT use for: generic skill creation (use $apb-skill-create),
  generic documentation templates (use $apb-templates), runtime validation
  reports (use $apb-validation-report).
---

# Playbook Create

> Maintain the LangGraph SDK playbook by creating the document, updating
> existing entries, or inserting new implementation lessons.

## Usage

```
$apb-playbook-create create-playbook     Create or initialize the LangGraph SDK playbook
$apb-playbook-create update-playbook     Update an existing playbook topic from new learning
$apb-playbook-create insert-playbook     Insert a new playbook topic using the standard template
$apb-playbook-create refactor-playbook   Normalize category/task headings and prefix numbers
```

## Phase Flow

```
[Create Playbook] -> [Update Playbook] -> [Insert Playbook] -> [Refactor Playbook]
```

## Phase Progress Visualization

```
[Create Playbook] -> [Update Playbook] -> [Insert Playbook] -> [Refactor Playbook]

Status:
  [Phase] done     -> phase completed
  [Phase] active   -> currently working
  [Phase] pending  -> not yet started
```

---

## Phase:Create Playbook

Create or initialize the LangGraph SDK playbook document without replacing
existing entries.

### Prerequisites

- The target project is the LangGraph SDK learning project.
- The intended playbook path is:

  ```
  /Users/studio/workspace/projects/reason-ball/5-mle/2-langgraph/3-langgraph-sdk/docs/핵심 노트-playbook.md
  ```

### Steps

1. Inspect the target path before writing.
2. If the file exists, preserve all current content and treat this phase as
   complete.
3. If the file is missing, create it with this title:

   ```markdown
   # Langgraph SDK Playbook
   ```

4. Keep the document in Korean, while preserving SDK/API names in English.
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
/Users/studio/workspace/projects/reason-ball/5-mle/2-langgraph/3-langgraph-sdk/docs/핵심 노트-playbook.md
```

---

## Phase:Update Playbook

Revise an existing playbook entry when implementation work reveals a clearer
or more accurate LangGraph SDK practice.

### Prerequisites

- The playbook file exists.
- The target task already exists as an H3 heading under a numbered H2 category.
- New learning is backed by implementation, tests, debugging results, or SDK
  behavior observed in the project.

### Steps

1. Read the current playbook before editing.
2. Find the matching H3 playbook task under its H2 category, for example:

   ```markdown
   ## 1. Streaming

   ### 1.1 특정 노드 및 진행 상황 (step)을 표기
   ```

3. Update only the matching H3 task unless the user explicitly requests a wider
   rewrite.
4. Preserve the existing structure:

   ```markdown
   ## {category_number}. {category}

   ### {category_number}.{task_number} {task}

   목적 : {why this pattern exists}

   상세 로직

   1. {backend or graph concern}
     - {concrete implementation rule}

   2. {frontend or SDK concern}
     - {concrete implementation rule}
   ```

5. Prefer concrete LangGraph SDK facts over generic advice. Include API names,
   state field names, stream modes, node names, or failure symptoms when they
   prevent future mistakes.
6. Keep bullets concise and action-oriented.
7. Avoid duplicate statements already present in the same topic.
8. Do not use `### 상세 로직`; write `상세 로직` as plain body text under the
   H3 task.

### Output Path

```
/Users/studio/workspace/projects/reason-ball/5-mle/2-langgraph/3-langgraph-sdk/docs/핵심 노트-playbook.md
```

---

## Phase:Insert Playbook

Insert a new LangGraph SDK playbook topic using the standard entry template.

### Prerequisites

- The playbook file exists or `Create Playbook` has been completed.
- The new topic has a clear implementation lesson, not just a general note.
- Existing H2 category headings and H3 task headings have been checked to avoid
  duplicate topics.

### Steps

1. Read the full playbook and list existing H2 category headings and H3 task
   headings.
2. Choose or create a short Korean H2 category title that groups related
   implementation lessons.
3. Choose a short Korean H3 task title that describes the implementation
   pattern.
4. Insert the new H3 task after the most related task in the matching category.
   If there is no related category, append a new H2 category after the existing
   content.
5. H2 and H3 headings must include prefix numbers:

   ```markdown
   ## 1. {category}

   ### 1.1 {task}
   ```

6. Use this template:

   ```markdown
   ## {category_number}. {category}

   ### {category_number}.{task_number} {task}

   목적 : {LangGraph SDK implementation goal}

   상세 로직

   1. LangGraph 상태 및 그래프 로직
     - {state schema, node return, graph config, checkpoint, interrupt, or stream rule}
     - {important backend constraint or failure mode}

   2. Frontend 및 SDK 처리
     - {client call, thread handling, stream handling, UI state, or sync rule}
     - {important frontend constraint or failure mode}
   ```

7. Add more numbered sections only when the lesson genuinely needs another
   concern, such as testing, persistence, or deployment.
8. Include known pitfalls when they are actionable, for example mismatched node
   names, missing state fields, incorrect stream mode, or stale thread state.
9. Keep the style consistent with the existing Korean playbook entry.
10. After insertion, renumber H2 and H3 prefix numbers so they are sequential
    and match their hierarchy.

### Output Path

```
/Users/studio/workspace/projects/reason-ball/5-mle/2-langgraph/3-langgraph-sdk/docs/핵심 노트-playbook.md
```

---

## Phase:Refactor Playbook

Normalize an existing LangGraph SDK playbook so category and task headings
follow the standard hierarchy and prefix-number convention.

### Prerequisites

- The playbook file exists.
- The document has one or more implementation lessons that can be grouped under
  H2 categories and H3 playbook tasks.
- Refactoring must preserve the implementation facts unless the user asks for a
  content rewrite.

### Steps

1. Read the full playbook before editing.
2. List all H2 headings and decide whether each one is a category or an
   implementation task.
3. Convert broad grouping headings to numbered H2 category headings:

   ```markdown
   ## 1. {category}
   ```

4. Convert implementation-level playbook entries to numbered H3 task headings:

   ```markdown
   ### 1.1 {task}
   ```

5. Remove `### 상세 로직` headings and replace them with plain body text:

   ```markdown
   상세 로직
   ```

6. Ensure every H3 task keeps this structure:

   ```markdown
   ### {category_number}.{task_number} {task}

   목적 : {why this pattern exists}

   상세 로직

   1. LangGraph 상태 및 그래프 로직
     - {concrete implementation rule}

   2. Frontend 및 SDK 처리
     - {concrete implementation rule}
   ```

7. Renumber all H2 and H3 prefixes after moving or converting headings:
   - H2 categories use `1.`, `2.`, `3.` in document order.
   - H3 tasks use `{h2_number}.1`, `{h2_number}.2`, `{h2_number}.3` within
     each category.
   - H3 prefixes must always match the parent H2 prefix.
8. Check that no implementation task remains as H2 and no `### 상세 로직`
   heading remains.
9. Keep bullets concise, preserve concrete SDK/API names, and avoid duplicate
   statements introduced during refactoring.

### Output Path

```
/Users/studio/workspace/projects/reason-ball/5-mle/2-langgraph/3-langgraph-sdk/docs/핵심 노트-playbook.md
```

---

## Heading Rules

- H1 is reserved for the document title only:

  ```markdown
  # Langgraph SDK Playbook
  ```

- H2 is reserved for numbered category-level headings. A category groups
  related LangGraph SDK implementation lessons and must not contain a concrete
  implementation task directly in the heading.

  ```markdown
  ## 1. {category}
  ```

- H3 is reserved for numbered playbook-task headings. A playbook task is the
  concrete implementation unit, such as a chat UI, streaming pattern, checkpoint
  flow, or interrupt handling pattern.

  ```markdown
  ### 1.1 {playbook task}
  ```

- H2 and H3 headings require prefix numbers. H2 prefixes use document order
  (`1.`, `2.`, `3.`), and H3 prefixes use the parent H2 number plus local task
  order (`1.1`, `1.2`, `2.1`).
- Do not use `### 상세 로직`. The phrase `상세 로직` is plain body text inside
  each H3 task.
