# 2026-10-06: Korean translations for example plans

## Context and decision

The user requested Korean translations for every Markdown file under `plan/` while preserving the English source. Keep each source intact and append a Korean section after `---`.

## Change and rationale

- Added Korean translations to all 50 Markdown plans in `plan/`, including the GitHub design plan.
- Preserved the original English text, Markdown structure, code identifiers, paths, and API names.
- Updated the system design to record the bilingual plan convention for future edits.

Affected stock section: system design, documentation conventions.

## Validation and follow-up

- Verified all 50 plan files contain one Korean section separator and header.
- `git diff --check` passed.
- No application code or runtime behavior changed.
