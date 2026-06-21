---
name: skill-creator
description: |
  프로젝트 로컬 Codex 스킬을 생성하거나 갱신하는 워크플로우.
  supports: init, write, validate, package.
  Actions: init->스킬 디렉터리와 메타 구조 준비, write->SKILL.md 작성,
  validate->템플릿/트리거/구조 점검, package->배포 가능한 형태로 정리.
  Triggers: skill creator, create skill, make skill, skill scaffold, 스킬 만들기, 스킬 생성, SKILL.md 작성
---

# Skill Creator

> Unified skill for creating project-local Codex skills under the repository root `.agents/skills/`.

## Usage

```bash
$skill-creator init        스킬 디렉터리와 기본 구조 초기화
$skill-creator write       SKILL.md와 필요한 보조 리소스 작성
$skill-creator validate    트리거, 템플릿, 경로, 필수 섹션 검증
$skill-creator package     최종 구조 정리 및 배포 가능 상태 점검
```

## Workflow

```text
Init -> Write -> Validate -> Package
  |        |         |           |
  |        |         |           v
  |        |         |       Deliverable-ready skill folder
  |        |         v
  |        |     Template compliance + trigger quality check
  |        v
  |    Frontmatter + Usage + Workflow + Stage definitions
  v
Skill directory / SKILL.md / optional agents|references|scripts
```

## Stage Progress Visualization

```text
[Init] -> [Write] -> [Validate] -> [Package]

Status indicators:
  [Stage] done     -> stage completed
  [Stage] active   -> currently working
  [Stage] pending  -> not yet started
```

---

## Init Stage (skill-creator init)

Create the base skill directory in the project root and define the target scope.

### Prerequisites

- 프로젝트 루트 경로를 확인한다.
- 출력 위치는 기본적으로 `.agents/skills/<skill-name>/`를 사용한다.
- 스킬 이름은 kebab-case로 정한다.

### Steps

1. Create the directory: `mkdir -p .agents/skills/<skill-name>`
2. Decide whether the skill needs only `SKILL.md` or also `agents/`, `references/`, `scripts/`, `assets/`
3. Capture the skill goal in one sentence
4. List trigger phrases that should activate the skill
5. Decide the stage model to be documented in the skill

### Output

- `.agents/skills/<skill-name>/`
- planned section list for `SKILL.md`

---

## Write Stage (skill-creator write)

Write the skill metadata and the main operational guide in `SKILL.md`.

### Prerequisites

- `Init Stage`에서 스킬 이름과 목적이 정리되어 있어야 한다.
- 포함할 스테이지 이름이 확정되어 있어야 한다.
- 필수 템플릿 섹션 `Usage`, `Workflow`, 각 `Stage` 구조를 확인한다.

### Steps

1. Add YAML frontmatter with `name` and `description`
2. Write a one-line summary describing what the skill does
3. Add a `Usage` section with command-style examples
4. Add a `Workflow` section showing the end-to-end sequence
5. Define each stage using `## <Stage Name> Stage`
6. Under every stage, include both `### Prerequisites` and `### Steps`
7. Add only the minimum examples needed to make the workflow executable

### Writing Rules

- `SKILL.md`는 불필요한 배경 설명보다 실행 절차를 우선한다.
- 설명은 짧게 쓰고, 반복되는 세부사항은 필요한 경우에만 `references/`로 분리한다.
- 트리거 문구는 실제 사용자가 입력할 표현 위주로 적는다.
- 스킬 본문은 가능하면 500줄 이하로 유지한다.

---

## Validate Stage (skill-creator validate)

Check that the skill can be discovered and used consistently by another agent.

### Prerequisites

- `SKILL.md` 초안이 작성되어 있어야 한다.
- 스테이지별 `Prerequisites`, `Steps`가 모두 들어 있어야 한다.
- 출력 디렉터리 구조가 실제 파일과 일치해야 한다.

### Steps

1. Verify the frontmatter includes both `name` and `description`
2. Verify the body includes `Usage` and `Workflow`
3. Verify every stage contains `Prerequisites` and `Steps`
4. Verify paths are relative to the project root unless explicitly documented otherwise
5. Remove duplicated guidance that adds token cost without changing behavior
6. Confirm the trigger phrases are broad enough to be discoverable but not overly generic

### Validation Checklist

- required frontmatter exists
- required template sections exist
- stage names and command labels match
- output directory is under `.agents/skills/`
- examples do not depend on missing files without explanation

---

## Package Stage (skill-creator package)

Finalize the skill folder so it is ready for repeated local use.

### Prerequisites

- `Validate Stage` checks are complete
- 필요한 보조 디렉터리가 정리되어 있어야 한다.
- 스킬이 실제 프로젝트 구조와 충돌하지 않아야 한다.

### Steps

1. Keep only files that directly support skill execution
2. Add optional `agents/openai.yaml` only when UI metadata is required
3. Add `references/`, `scripts/`, or `assets/` only when the workflow truly needs them
4. Re-read the skill from top to bottom and remove non-essential text
5. Confirm the final deliverable path is `.agents/skills/<skill-name>/`

### Deliverables

- `SKILL.md` at the skill root
- optional supporting folders only when justified by the workflow

---

## Core Rules

- The primary output directory is the project root path `.agents/skills/<skill-name>/`.
- `SKILL.md` is required for every skill.
- Every skill must expose a clear trigger surface through frontmatter description.
- Every stage must define both `Prerequisites` and `Steps`.
- Prefer concise operational guidance over long conceptual explanation.
- Do not create extra documents unless they are directly needed for execution.
