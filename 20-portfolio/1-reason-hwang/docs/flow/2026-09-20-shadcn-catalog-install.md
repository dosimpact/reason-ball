# 2026-09-20 — Preinstall shadcn catalog

- Scope: tech-shared / 1-fe-host. Decision: `UI-CATALOG-001`.
- Stock: [UI catalog](../stock/tech-shared/1-fe-host/ui-catalog.md); linked from the current Storybook design.
- Request: pre-download the supplied component list using the shadcn CLI.

## Implementation

Inspected current `components.json` and CLI help, then executed:

```sh
# Host package directory
pnpm exec shadcn add --all --dry-run
pnpm exec shadcn add --all --yes
# Workspace root
pnpm --filter reason-hwang-fe-host add @tanstack/react-table
pnpm --filter reason-hwang-fe-host add @shadcn/react@latest
```

Answered no to all 18 overwrite prompts. CLI created 42 new component files and skipped 20 existing files (19 UI components and use-mobile). Current inventory: 61 UI component files. Existing UI files, stories, theme and app layout have no diff.

The supplied Data Table and Date Picker entries are composition guides; Table/TanStack Table and Calendar/Popover/date-fns are installed. Typography redirects to the Typeset CSS guide and is not a downloadable standalone registry component. No invented `data-table.tsx`, `date-picker.tsx`, or `typography.tsx` was created. Registry `form` entry produced no file.

The initial typecheck caught the missing `@shadcn/react/questionnaire` export in 0.2.1. Updated to 0.3.1, preserving generated source; final typecheck passes. Package and workspace lockfile changes are retained. CLI-generated `cn` imports are supported by its installed dependency.

## Validation

`VAL-VIEW-001`: Given the new representative installation story, opening it displays Accordion, Checkbox, Switch, Progress, Calendar, and Questionnaire; clicking Accordion reveals the content, checking Checkbox updates it, and choosing a Questionnaire option selects it.

| Check | Result |
| --- | --- |
| `pnpm --filter reason-hwang-fe-host typecheck` | PASS |
| `pnpm --filter reason-hwang-fe-host lint` | PASS |
| `pnpm --filter reason-hwang-fe-host exec vitest run --project storybook` | PASS: 23 files / 91 tests |
| `pnpm --filter reason-hwang-fe-host build-storybook` | PASS |
| Browser skill / Chrome on owned port 6007 | PASS: installation-registry-smoke-check--installed, DOM and screenshot in task transcript; Questionnaire selection exercised |
| Existing tracked UI/app diff | Empty: prior implementations and examples preserved |

Local evidence logs: `/tmp/reason-shadcn-{dry,types,lint,tests,build,react,table,dev}.log`. Full behavior coverage for all new upstream components is outside this preinstallation request; the new story is a representative compatibility check. Existing accessibility addon mode remains informational.

## Preservation

Unrelated BFF and documentation migration changes were preserved. The new stock catalog and this flow are included in the scoped commit; the link added to the pre-existing untracked relocated Storybook document remains with that pending documentation migration. The owned 6007 server is stopped after verification; existing servers remain untouched.
