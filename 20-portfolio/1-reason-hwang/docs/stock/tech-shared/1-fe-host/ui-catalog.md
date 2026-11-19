# Installed shadcn UI catalog

Decision: `UI-CATALOG-001`. Scope: tech-shared / 1-fe-host.

The host installs reusable components from the shadcn Base UI registry under `src/shared/ui/`. `components.json` retains `base-mira`, neutral CSS variables, Phosphor icons, and the existing aliases. Installations use the package-local shadcn CLI and skip existing files unless an intentional update is requested.

## Inventory

The catalog includes the reusable UI components listed below. Field provides form composition.

`accordion`, `alert`, `alert-dialog`, `aspect-ratio`, `attachment`, `avatar`, `badge`, `breadcrumb`, `bubble`, `button`, `button-group`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `code-block`, `combobox`, `command`, `context-menu`, `dialog`, `direction`, `drawer`, `dropdown-menu`, `empty`, `field`, `hover-card`, `input`, `input-group`, `input-otp`, `item`, `kbd`, `label`, `marker`, `menubar`, `message`, `message-scroller`, `native-select`, `navigation-menu`, `pagination`, `popover`, `progress`, `questionnaire`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `spinner`, `switch`, `table`, `tabs`, `textarea`, `toast`, `toggle`, `toggle-group`, `tooltip`.

## Documentation-only / composed entries

| Requested name | Preparation |
| --- | --- |
| Data Table | `table.tsx` plus `@tanstack/react-table`; `UI/Data Table` demonstrates local search, sorting, and empty results; define domain-specific columns when integrating |
| Date Picker | `calendar.tsx` + `popover.tsx` + `date-fns`; `UI/Date Picker` demonstrates selection and an initially empty value |
| Typography | Current documentation redirects to Typeset, a CSS design guide; no standalone CLI component was generated; `UI/Typography` demonstrates headings, body, quotes, lists, and inline code |

Sources: [Data Table](https://ui.shadcn.com/docs/components/base/data-table), [Date Picker](https://ui.shadcn.com/docs/components/base/date-picker), [Typeset](https://ui.shadcn.com/docs/typeset), [CLI](https://ui.shadcn.com/docs/cli).

## Dependencies and use

Registry dependencies include `cn`, `cmdk`, `input-otp`, `react-resizable-panels`, `react-day-picker`, `date-fns`, `embla-carousel-react`, `recharts`, and `shiki`. Questionnaire uses `@shadcn/react`. The workspace lockfile records exact resolutions.

Registry components use their generated helpers or the existing `@/lib/utils` aliases. Mount the Toast Toaster where the application uses it.

## Validation scope

`UI-STORY-003` covers styled components and composition examples. Stories cover variants, clicks, selections, local filtering and sorting, survey completion, and overlays.

Story-local state and fixed fixtures require no backend. Toast uses a per-story manager, overlay Docs examples use isolated frames, and chart/resizable examples provide explicit dimensions. `vitest.config.ts` prebundles catalog dependencies.

Run the commands in [Storybook design](storybook.md).

## UI-CATALOG-002: CodeBlock

The base-mira CodeBlock includes an optional highlighter backed by the locked `shiki` dependency. `UI/Code Block` covers numbered text and diff/wrap composition. The OpenUI Code adapter uses the header, title, actions, copy, and content primitives with plain text.
