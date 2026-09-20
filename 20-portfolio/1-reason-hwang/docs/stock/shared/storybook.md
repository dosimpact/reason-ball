# Host Storybook Design

> Scope: shared frontend UI. Decisions: `UI-STORY-001`, `UI-STORY-002`.

## Purpose and behavior

The host Storybook presents reusable UI components independently of backend services. Default UI stories must show meaningful fixture content or a visible trigger; container components alone are not useful examples. Skeletons and separators require explicit dimensions or a sized parent.

## Implementation

- Stories live in `1-fe-host/src/components/ui/*.stories.tsx` and use types from the declared `@storybook/nextjs-vite` dependency.
- Compound components include their content, triggers, and required providers. Base UI composition uses `render`, not Radix-style `asChild`.
- Sidebar includes navigation and a toggle. Its Docs example uses an isolated iframe to contain fixed positioning.
- The existing preview imports application `globals.css`; stories use the application theme and Tailwind styles.
- Collapsible, DropdownMenu, Sheet, and Tooltip expose separate Interaction stories with `play` checks. Portal queries use the canvas owner document; assertions wait for transitions. Tooltip checks exercise keyboard focus and Escape.
- Fixtures do not require authentication or API services. Stateful examples update story-local React state only; no data is persisted or sent to a backend.
- `UI-STORY-002`: the 19 UI component files provide 83 stories spanning variants, sizes, content, empty/loading/error/disabled states, and composed application examples. Existing Default story IDs remain stable.
- `src/stories/ui-gallery.tsx` provides story-only, labeled comparison galleries. They use two columns on wider screens and one column on narrow screens, with application theme tokens.
- Default stories for Button, Badge, Bubble, Attachment, Avatar, Input, and Textarea expose explicit Controls. Fixed comparison/composition stories disable irrelevant controls.
- Project cards include metadata, empty and skeleton states; messaging examples include conversation alignment, attachments, generation and delivery errors; MessageScroller supports local message insertion and an empty conversation.
- DropdownMenu Preferences, Sheet EditProject, and MessageScroller AddMessage have interaction assertions for visible state changes. Sidebar includes icon/offcanvas collapse and floating/inset layouts with local navigation selection.
- ESLint excludes `storybook-static/**` so a static build does not cause lint to inspect generated bundles.

## Commands and acceptance

Run from `1-reason-hwang`:

```sh
pnpm --filter reason-hwang-fe-host storybook
pnpm --filter reason-hwang-fe-host build-storybook
pnpm --filter reason-hwang-fe-host exec vitest run --project storybook
pnpm --filter reason-hwang-fe-host typecheck
pnpm --filter reason-hwang-fe-host lint
```

The development default is port 6006. Validation may use a separate owned port. Follow [VAL-VIEW-001](../../validation/pure-view.md): verify content and interaction in the browser in addition to build and automated story tests.

Evidence: [2026-09-20 rendering correction](../../flow/2026-09-20-storybook-rendering.md).

## Example coverage

| Family | Examples |
| --- | --- |
| Button / Badge / Avatar | variants, sizes, icons, loading/disabled, workflow status, team, image fallback |
| Input / Textarea | filled, invalid, disabled, read-only, password, search, long text, composer |
| Card / Skeleton / Separator | project overview, metrics, empty/loading, content placeholders, horizontal/vertical sections |
| Bubble / Message / MessageScroller | conversation, reactions, long content, attachments, errors, generation, scrolling, empty/compact/add-message |
| Attachment / Marker / Breadcrumb | upload lifecycle, sizes, file collection, long filenames, activity timeline, collapsed/long paths |
| Collapsible / DropdownMenu / Sheet / Tooltip / Sidebar | FAQ/files, menu groups/submenus/preferences, placements/edit form, toolbar help, workspace layouts |

Expansion evidence: [2026-09-20 rich examples](../../flow/2026-09-20-storybook-rich-examples.md).
