# shadcn/ui source adaptations

The Button, Card, Badge, Input, Progress, Dialog, Popover and Tooltip implementations in this directory are adapted from the official shadcn/ui `new-york` registry, retrieved 2026-11-11:

- https://ui.shadcn.com/r/styles/new-york/button.json
- https://ui.shadcn.com/r/styles/new-york/card.json
- https://ui.shadcn.com/r/styles/new-york/badge.json
- https://ui.shadcn.com/r/styles/new-york/input.json
- https://ui.shadcn.com/r/styles/new-york/progress.json
- https://ui.shadcn.com/r/styles/new-york/dialog.json
- https://ui.shadcn.com/r/styles/new-york/popover.json
- https://ui.shadcn.com/r/styles/new-york/tooltip.json

Copyright (c) 2023 shadcn. The upstream MIT license is retained in [SHADCN-LICENSE](SHADCN-LICENSE). The `cn` helper follows the official `clsx` + `tailwind-merge` composition pattern; Button and Badge retain the `class-variance-authority` variant pattern. Button and Card support Radix Slot composition. Dialog, Popover, Tooltip and Progress use their actual Radix primitives.

Local adaptations map default styles to RAIN ROOM tokens, add explicit `existing` appearance options that omit default visual classes, retain the existing progress indicator's width behavior, and use the application's inline close icon. No global reset, light palette, border radius or default spacing is installed. `ScrollTrackList` is the existing project component and is not represented as upstream shadcn code.

`components.json` records Vite/Tailwind v4 configuration and aliases. Source files are owned by this repository after installation, as intended by shadcn/ui. Future registry updates must be reviewed as source changes: preserve these appearance options, public shared-layer imports and the existing token CSS. Do not run initialization to replace the application's stylesheet or blindly overwrite local primitives.

The Tailwind bridge registers the non-colliding shadcn semantic color utilities (`primary`, `foreground`, `input`, `ring`, `card`, `popover`, etc.) against the original palette. Existing `--color-background` and `--color-border` tokens are never redefined through self-referencing aliases; `bg-background` and `border-border` are explicit token-backed utilities instead. Default primitives explicitly request solid borders because Preflight remains disabled. Registry additions still require local styling review; the recorded CLI aliases do not authorize reinitializing or replacing design tokens.
