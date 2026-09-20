# Host Storybook Design

> Scope: shared frontend UI. Decision: `UI-STORY-001`.

## Purpose and behavior

The host Storybook presents reusable UI components independently of backend services. Default UI stories must show meaningful fixture content or a visible trigger; container components alone are not useful examples. Skeletons and separators require explicit dimensions or a sized parent.

## Implementation

- Stories live in `1-fe-host/src/components/ui/*.stories.tsx` and use types from the declared `@storybook/nextjs-vite` dependency.
- Compound components include their content, triggers, and required providers. Base UI composition uses `render`, not Radix-style `asChild`.
- Sidebar includes navigation and a toggle. Its Docs example uses an isolated iframe to contain fixed positioning.
- The existing preview imports application `globals.css`; stories use the application theme and Tailwind styles.
- Collapsible, DropdownMenu, Sheet, and Tooltip expose separate Interaction stories with `play` checks. Portal queries use the canvas owner document; assertions wait for transitions. Tooltip checks exercise keyboard focus and Escape.
- Fixtures do not require authentication or API services.

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
