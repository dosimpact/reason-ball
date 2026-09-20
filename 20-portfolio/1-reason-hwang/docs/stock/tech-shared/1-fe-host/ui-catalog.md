# Installed shadcn UI catalog

Decision: `UI-CATALOG-001`. Scope: tech-shared / 1-fe-host.

The host preinstalls all standalone components in the current shadcn Base UI registry under `src/components/ui/`. `components.json` retains `base-mira`, neutral CSS variables, Phosphor icons, and the existing aliases. Installations use the package-local shadcn CLI and skip existing files unless an intentional update is requested.

## Inventory

61 component files are present: 19 existing components preserved, 42 added by `pnpm exec shadcn add --all --yes`. The CLI also lists a `form` registry entry with no generated standalone file; the requested Field component is installed.

`accordion`, `alert`, `alert-dialog`, `aspect-ratio`, `attachment`, `avatar`, `badge`, `breadcrumb`, `bubble`, `button`, `button-group`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `combobox`, `command`, `context-menu`, `dialog`, `direction`, `drawer`, `dropdown-menu`, `empty`, `field`, `hover-card`, `input`, `input-group`, `input-otp`, `item`, `kbd`, `label`, `marker`, `menubar`, `message`, `message-scroller`, `native-select`, `navigation-menu`, `pagination`, `popover`, `progress`, `questionnaire`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `spinner`, `switch`, `table`, `tabs`, `textarea`, `toast`, `toggle`, `toggle-group`, `tooltip`.

## Documentation-only / composed entries

| Requested name | Preparation |
| --- | --- |
| Data Table | `table.tsx` plus `@tanstack/react-table`; `UI/Data Table` demonstrates local search, sorting, and empty results; define domain-specific columns when integrating |
| Date Picker | `calendar.tsx` + `popover.tsx` + `date-fns`; `UI/Date Picker` demonstrates selection and an initially empty value |
| Typography | Current documentation redirects to Typeset, a CSS design guide; no standalone CLI component was generated; `UI/Typography` demonstrates headings, body, quotes, lists, and inline code |

Sources: [Data Table](https://ui.shadcn.com/docs/components/base/data-table), [Date Picker](https://ui.shadcn.com/docs/components/base/date-picker), [Typeset](https://ui.shadcn.com/docs/typeset), [CLI](https://ui.shadcn.com/docs/cli).

## Dependencies and use

The CLI installs dependencies including `cn`, `cmdk`, `input-otp`, `react-resizable-panels`, `react-day-picker`, `date-fns`, `embla-carousel-react`, and `recharts`. `@shadcn/react` is updated to `^0.3.1` because `0.2.1` lacks the Questionnaire export. The lockfile records exact resolutions.

New registry files retain their generated source, including the new `cn` package imports. Existing components keep `@/lib/utils`. Existing component source, theme, and application layout are preserved. Toast is available for import; mount its Toaster where needed when integrating it into the app.

## Validation scope

`UI-STORY-003`: all 61 standalone components have colocated `*.stories.tsx` files. Three additional composed examples live under `src/stories/`: Data Table, Date Picker, and Typography. The built catalog has 192 UI stories and 201 total cases including starter and installation examples. New stories cover useful variants and states; 20 new interaction stories verify clicks, selections, local filtering/sorting, survey completion, and overlay behavior.

Story-local state and fixed fixtures require no backend. Toast uses a per-story manager, overlay Docs examples are isolated in frames, and chart/resizable examples provide explicit dimensions. `vitest.config.ts` prebundles the catalog dependencies to prevent optimizer reloads during browser tests. Typecheck, lint, the 201-case Chromium suite, and the static Storybook build pass. Browser checks additionally cover desktop charts, questionnaire submission, dialogs, and responsive date selection.

Run the commands in [Storybook design](storybook.md). Installation evidence: [2026-09-20 catalog installation](../../../flow/2026-09-20-shadcn-catalog-install.md).

Story expansion evidence: [2026-09-20 catalog stories](../../../flow/2026-09-20-shadcn-catalog-stories.md).
