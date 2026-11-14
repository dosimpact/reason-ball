# Official shadcn/ui expansion

Observed official Components index: https://ui.shadcn.com/docs/components (2026-11-10).
`coverage.json` maps all 66 official component pages to registered OpenUI names: 28 existing entries and 38 additions. The separate AI Elements section is excluded.

New `components/ui` primitives were downloaded from `https://ui.shadcn.com/r/styles/new-york-v4/{slug}.json`. Trace and Questionnaire use current `radix-nova` registry sources because the older style has no registry item. These are upstream shadcn sources, adapted to local imports, Lucide icons, existing Button sizes, and a deterministic Sidebar skeleton width. Combobox uses the current official Base UI primitive; Questionnaire and MessageScroller use `@shadcn/react`. Resizable uses react-resizable-panels v4. This is copied upstream implementation plus project-specific OpenUI compositions, not an independent reimplementation of the primitives.

`additionalComponents` and `additionalContentRefs` integrate with the parent library and content union. `additionalFixtures` are complete Card programs with official slugs. Optional `children` on container compositions accept registered OpenUI references; Resizable exposes separate `firstContent` and `secondContent` arrays. No imports from parent unions avoid schema cycles.

Combobox, Field, InputGroup, InputOTP, NativeSelect, Toggle and ToggleGroup accept an optional final `name` prop and store values in OpenUI form state. Without name they remain locally interactive. Menus, Command, button groups and Sidebar items trigger the existing conversation action. Toast explicitly shows a local notification. Navigation and attachments follow their declared links.

Fixtures demonstrate composition. They are not evidence that every upstream variant or every generated model program was exercised. Browser evidence is collected separately by the component gallery checks.
