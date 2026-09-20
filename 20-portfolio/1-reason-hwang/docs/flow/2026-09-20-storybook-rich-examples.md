# 2026-09-20 — Rich UI Storybook examples

- Domain: shared frontend UI.
- Decision: `UI-STORY-002`; validation: `VAL-VIEW-001`.
- Stock: [Host Storybook Design](../stock/shared/storybook.md), Implementation and Example coverage.

## Context and accepted change

The initial rendering correction made the stories visible, but the user requested richer examples. Expand the existing 19 component story files while preserving their Default IDs and production component APIs.

The UI suite now contains 83 stories (59 additions), with 90 stories across UI and starter examples. Story-only gallery helpers provide labeled comparisons with responsive columns. Coverage includes variant/size/icon choices, empty/loading/error/disabled/read-only states, long text and filenames, and contextual project, messaging, attachment, settings, and navigation layouts.

Interactive fixtures keep state local: menu checkbox/radio preferences, sheet form editing, sidebar selection/collapse, and conversation insertion. New `play` checks verify preferences, edit/save, and first-message transitions. Controls remain available for configurable default examples; fixed galleries disable irrelevant controls. ESLint excludes generated `storybook-static/**` bundles.

## Given / When / Then

1. Given a primitive gallery, when opened on desktop or a narrow viewport, labeled variants remain readable and switch from two columns to one without horizontal clipping.
2. Given Preferences, when checkbox/radio options change, the visible summary reflects the selected state.
3. Given EditProject, when the name is edited and saved, the panel closes and the local project summary updates.
4. Given an empty conversation, when a message is added, the empty prompt disappears and the message/count become visible.
5. Given Workspace Sidebar, selecting a menu updates its active state and content heading; the toggle changes its layout.

## Validation evidence

| Check | Result |
| --- | --- |
| `pnpm --filter reason-hwang-fe-host exec vitest run --project storybook` | PASS: 22 files, 90 tests, 0 failures/skips |
| `pnpm --filter reason-hwang-fe-host typecheck` | PASS |
| `pnpm --filter reason-hwang-fe-host lint` | PASS after excluding generated bundles and removing one unused import |
| `pnpm --filter reason-hwang-fe-host build-storybook` | PASS |
| `git diff --check` | PASS |
| Browser skill / Chrome, owned port 6007 | PASS: scenarios below |

Browser evidence in the task transcript:

- `ui-button--variants`: screenshot at desktop width and 390×844; labeled variants form a two-column and one-column gallery respectively. Temporary viewport override reset afterward.
- `ui-sidebar--workspace`: rendered navigation, profile and metric cards; selecting 프로젝트 changed the heading to 프로젝트; toggle exercised. One semantic click timed out; the visible state was inspected and a screenshot-grounded click confirmed the behavior.
- `ui-messagescroller--empty-conversation`: observed `0 messages` and empty prompt, clicked 메시지 추가, observed `1 messages` and the first message with no empty prompt.
- New automated interaction evidence: `ui-dropdownmenu--preferences`, `ui-sheet--edit-project`, `ui-messagescroller--add-message`.

Temporary command evidence: `/tmp/reason-rich-{tests,types,lint,build,format,dev}.log`. Screenshots/DOM evidence are in the task transcript. Existing addon accessibility mode is informational; this is not a full accessibility audit.

## Reconciliation and cleanup

During the task, concurrent workspace commit `ffe26d6` incorporated the expanded examples and existing scaffold. That commit was preserved. The final scoped commit contains the remaining Controls/lint cleanup and synchronized stock/flow evidence. Existing port 6006 was left untouched; owned port 6007 is stopped after validation. No production component or backend behavior changed.
