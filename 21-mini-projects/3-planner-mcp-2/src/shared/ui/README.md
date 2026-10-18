# UI primitives

Manually installed [shadcn/ui](https://ui.shadcn.com/docs/installation/manual) components from the [new-york-v4 registry](https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/new-york-v4/ui), with the upstream MIT license retained in `SHADCN-LICENSE.md`.

The upstream Radix composition, slots, and public component APIs are retained. Tailwind utility strings are adapted to semantic classes in `components.css` because this application uses plain CSS. Dialog and dropdown portals, focus management, keyboard navigation, and Tabs behavior use the actual Radix primitives. Button and Badge variants use class-variance-authority. Resizable uses react-resizable-panels.

Import `components.css` once from the application stylesheet. Theme tokens are defined in the application stylesheet. These components consume `--background`, `--foreground`, `--muted`, `--muted-foreground`, `--border`, `--primary`, `--primary-foreground`, `--accent`, and `--destructive`.
