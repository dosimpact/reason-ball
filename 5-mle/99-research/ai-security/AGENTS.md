# Repository Guidelines

## Project Structure & Module Organization

This repository is a research workspace for AI chat application security requirements and Straiker AI coverage evaluation. The objective is tracked in `goal.md`.

Use this structure:

- `goal.md`: project objective and scope.
- `research/`: source notes, vendor research, and Straiker AI findings.
- `requirements/`: security controls, requirement IDs, and coverage mappings.
- `output/`: final reports, exported tables, and deliverables. Keep all report outputs here.
- `assets/`: diagrams, screenshots, and images.
- `tests/`: validation scripts or checklists if executable tooling is introduced.

Use lowercase kebab-case filenames, for example `requirements/ai-chat-security-controls.md`.

## Build, Test, and Development Commands

No build system or test runner is configured yet. Use manual checks:

- `rg "TODO|TBD|FIXME" .`: find unresolved placeholders.
- `rg "https?://" research requirements output`: review cited sources.
- `markdownlint "**/*.md"`: lint Markdown if available.
- `git diff --check`: detect trailing whitespace after Git is initialized.

## Coding Style & Naming Conventions

Write concise Markdown with clear headings, stable requirement IDs, and sourced claims. Prefer tables for requirement inventory, coverage scoring, milestones, roadmap, and action items.

Use IDs such as `SEC-001`. Each requirement should include title, risk addressed, priority, evidence, and verification method.

## Testing Guidelines

There is no automated test framework yet. Treat review checklists as validation. Before finalizing reports, verify links, sources, stable IDs, reproducible scoring, and clear roadmap thresholds.

If scripts are added later, place tests under `tests/`, for example `test_requirement_coverage.py`.

## Research & Report Requirements

Produce these artifacts:

- A numbered list of AI chat application security requirements.
- A milestone, roadmap, or action-item table showing how many requirements define each maturity level.
- A Straiker AI research summary using current public sources.
- A coverage matrix mapping Straiker AI capabilities to the requirement IDs.
- A final report under `output/`.

Separate verified facts from assumptions. Include source name, URL, access date, and a short relevance note.

## GraphRAG Runbook Sub-Agent Rules

When this workspace is used to delegate `graphrag-toolkit` runbook writing to sub-agents, each sub-agent must write in Korean and target readers who are new to graph DBs, RAG, and GraphRAG. Use the runbook table of contents in `/Users/studio/workspace/Research/lexical-db/graphrag-toolkit/docs-site/src/content/docs/runbook/overview.mdx` as the source of truth.

Assign one major section or a tightly related subsection group per sub-agent. Each sub-agent must:

- Read the relevant `graphrag-toolkit` docs and source before drafting.
- Explain prerequisite concepts before repository-specific implementation details.
- Connect every concept to concrete files, commands, classes, examples, or notebooks in `graphrag-toolkit`.
- Provide runnable commands and expected outcomes where practical.
- Mark AWS credentials, permissions, service dependencies, and cost-impacting steps explicitly.
- Separate verified behavior from assumptions or recommended design choices.
- Avoid duplicating adjacent chapters; instead, add cross-references by section title.

Use this chapter structure unless there is a clear reason to adapt it:

1. 학습 목표
2. 왜 필요한가
3. 핵심 개념
4. 이 저장소에서의 위치
5. 단계별 실습
6. 검증 방법
7. 자주 발생하는 문제
8. 다음에 읽을 내용

Sub-agent output should be Markdown or MDX that can be copied into `docs-site/src/content/docs/runbook/`. Prefer concise explanations, tables for comparisons, and Mermaid diagrams only when they clarify architecture or flow. Do not invent APIs, configuration keys, or behavior; verify against code, examples, or existing docs. Finish each task with a short handoff note listing files reviewed, assumptions, unresolved questions, and suggested follow-up chapters.

## Commit & Pull Request Guidelines

This directory is not initialized as a Git repository, so no commit history exists. Until conventions emerge, use Conventional Commit-style messages, for example `docs: add straiker ai coverage matrix`.

Pull requests should include a summary, changed files, key sources, scoring changes, and unresolved questions.

## Security & Configuration Tips

Do not commit secrets, customer data, private prompts, API keys, or unpublished vendor materials. Keep research assessments factual, sourced, and separated from assumptions or open questions.
