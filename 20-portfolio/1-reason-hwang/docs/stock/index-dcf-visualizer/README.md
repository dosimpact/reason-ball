# Index DCF Visualizer

## Domain boundary

This domain owns the Index DCF Visualizer: its financial assumptions, calculation behavior, input constraints, warnings, presentation, and user interaction.

## Owning components

- `1-fe-host`: the `/index-dcf-visualizer` page, calculation logic exposed through the UI, visualization components, input handling, and browser tests.
- Shared host and test infrastructure documented under `../shared/` supports this domain but does not own its business rules.

## Current capability boundary

- Accept DCF-related inputs through the host UI.
- Calculate and visualize index DCF results.
- Surface validation and warning behavior for supported input scenarios.
- Validate calculation behavior and user interaction through the host's focused and end-to-end tests.

## Documentation routing

Add financial terminology, formulas, assumptions, input/output contracts, UX behavior, warnings, and domain-specific test scenarios here. Keep general frontend shell, Module Federation, workspace commands, and cross-domain validation policy in `../shared/`.
