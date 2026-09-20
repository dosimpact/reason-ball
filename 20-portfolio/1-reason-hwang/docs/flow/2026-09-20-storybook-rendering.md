# 2026-09-20 — Storybook rendering correction

- Domain: shared. Decision: `UI-STORY-001`. Validation: `VAL-VIEW-001`.
- Stock: [Host Storybook Design](../stock/shared/storybook.md), linked from the [documentation map](../README.md).

## Context and cause

The existing uncommitted UI stories mostly supplied empty args to wrapper components. This produced blank buttons, empty containers, invisible skeletons/separators, and overlays without triggers. Sidebar used unsupported `asChild`; UI stories imported types from undeclared `@storybook/react`.

## Change and rationale

Populated 19 existing UI story files with fixtures, compound parts, dimensions, or corrected framework type imports as applicable. Replaced Sidebar composition with Base UI `render`, added its toggle/content, and isolated Docs rendering in a 400px iframe. Added four interaction stories for Collapsible, DropdownMenu, Sheet, and Tooltip. Production components and existing Storybook configuration were preserved.

## Scenarios and evidence

1. Given a UI default story, when rendered, show fixture content or an actionable trigger instead of an empty wrapper.
2. Given collapsible/menu/sheet triggers, when clicked, show content; subsequent close/Escape hides it.
3. Given Tooltip, when keyboard focus enters its trigger, show help; Escape dismisses it.
4. Given Sidebar Docs, render its fixed layout inside an isolated frame without covering the Docs page.

Executed from `1-reason-hwang` (the equivalent filtered Vitest invocation was also run from the host directory):

| Check | Result |
| --- | --- |
| `pnpm --filter reason-hwang-fe-host exec vitest run --project storybook` | PASS: 22 files, 31 tests, including four added interactions |
| `pnpm --filter reason-hwang-fe-host typecheck` | PASS |
| `pnpm --filter reason-hwang-fe-host lint` | PASS |
| `pnpm --filter reason-hwang-fe-host build-storybook` | PASS |
| Browser skill/Chrome on owned port 6007 | PASS: Button fixture, Card Docs, Sheet dialog open/close, Tooltip keyboard focus, Sidebar Docs frame and screenshot |

Local command logs: `/tmp/reason-storybook-{tests,types,lint,build}.log` (temporary, not committed). Browser DOM and screenshot evidence is in the task tool transcript. Initial interaction tests exposed asynchronous transitions and Tooltip content with a generic role; assertions were corrected to wait for visible content. Final suite: 31 PASS, 0 FAIL, 0 SKIP. Accessibility addon remains in the existing informational mode; this is not a claim of an accessibility audit.

## Preservation and follow-up

The user's server on 6006 and unrelated working tree changes were preserved. Only the owned 6007 server is stopped after verification. Existing Storybook scaffold/dependency changes remain outside this focused commit. The pre-existing untracked documentation map receives a navigation link but stays uncommitted to avoid absorbing unrelated documentation work. No unresolved rendering failure was observed in the tested scenarios.
