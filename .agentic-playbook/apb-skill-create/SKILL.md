---
name: apb-skill-create
description: |
  Guide for authoring a new apb skill with the standard phase-based
  structure. Ensures every new skill has consistent metadata, a Usage
  table, a Phase Flow, and phase detail blocks with
  Prerequisites / Steps / Output Path.
  Triggers: create skill, new skill, scaffold skill, skill author,
  apb skill create, 스킬 생성, 스킬 만들기, 新しいスキル, スキル作成,
  创建技能, 新建技能, crear skill, créer skill, Skill erstellen
  Do NOT use for: editing existing skills (edit SKILL.md directly),
  PDCA document authoring (use $apb-templates),
  apb rule reference (use $apb-rules).
---

# Skill Create

> Structural guide for creating a new skill. Produces a
> `SKILL.md` under `.agents/skills/{name}/` that follows the canonical
> phase-based layout.

## Usage

```
$apb-skill-create create {name}    Scaffold a new skill (default: .agents/skills/{name}/SKILL.md)  
```

## Required Structure

Every generated `SKILL.md` MUST contain these sections, in this order:

1. **Front matter** — `name`, `description` (with phase summary, triggers,
   and a `Do NOT use for` line)
2. **H1 title** + one-line blockquote summary
3. **`## Usage`** — fenced command table
4. **`## Phase Flow`** — arrow diagram `[A] -> [B] -> [C]`
5. **`## Phase Progress Visualization`** — status legend
   (`done` / `active` / `pending`)
6. **`## {Phase Name} Phase`** — one section per phase in the flow.
   Each phase section MUST contain, in order:
   - `### Prerequisites`
   - `### Steps`
   - `### Output Path`

## Authoring Steps

### Prerequisites

- `{name}` is kebab-case and unique under `.agents/skills/`.
- The user can describe the skill's purpose, phase list, and what it
  should NOT be used for.

### Steps

1. Create `.agents/skills/{name}/SKILL.md`.
2. Collect from the user:
   - One-paragraph description + phase summary.
   - Trigger keywords (multi-language recommended).
   - `Do NOT use for` list (2-3 alternative skills).
   - Ordered phase names (2-6 phases).
3. Write the front matter, H1, and blockquote summary.
4. Write `## Usage` as a fenced table of commands.
5. Write `## Phase Flow` and `## Phase Progress Visualization`.
6. For each phase in the flow, append a `## {Phase} Phase` block with
   `### Prerequisites`, `### Steps`, `### Output Path`.
7. Validate: all required sections exist in the order above, every phase
   has the three sub-sections, and `Output Path` is concrete (not a
   placeholder).

### Output Path

```
.agents/skills/{name}/SKILL.md
```

## Reference: Canonical SKILL.md Skeleton

```
---
name: {name}
description: |
  {what it does}
  Phases: {A} -> {B} -> {C}.
  Triggers: {en}, {ko}, {ja}, {zh}, ...
  Do NOT use for: {alt-1}, {alt-2}.
---

# {Skill Title}

> {one-line purpose}

## Usage

```
${name} {verb} {args}    {description}
```

## Phase Flow

```
[A] -> [B] -> [C]
```

## Phase Progress Visualization

```
[A] -> [B] -> [C]

Status:
  [Phase] done     -> phase completed
  [Phase] active   -> currently working
  [Phase] pending  -> not yet started
```

---

## {A} Phase

{one-line purpose}

### Prerequisites

- ...

### Steps

1. ...

### Output Path

```
path/to/artifact
```

(repeat one section per phase in the flow)
```
