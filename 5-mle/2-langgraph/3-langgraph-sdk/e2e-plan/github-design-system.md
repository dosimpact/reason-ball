# GitHub design system verification

Date: 2026-10-06. Requirement: UI-GH-01.

## Setup

- Inspect the existing owned frontend at `http://localhost:2805/` with Playwright MCP or the available browser-control MCP.
- Capture the starting desktop appearance before editing, then reload after the frontend changes.
- The LangGraph API is configured by the existing environment. Styling verification does not require a new server or provider call.

## User actions and expected states

1. Open the initial SDK connection example at a desktop width. Expect a neutral GitHub-inspired repository header, compact grouped example navigation, blue active navigation indicator, bordered white panels, and green primary action.
2. Collapse and expand an example group. Expect the count and expanded state to remain accurate, and examples to remain selectable.
3. Select a basic chat example and an artifact or CopilotKit example. Expect the active header and selected navigation to update, with existing controls and example contents present.
4. Inspect fields, enabled/disabled buttons, and keyboard focus. Expect readable labels, visible focus indicators, and distinguishable disabled states.
5. Inspect at a narrow mobile width (approximately 390 px). Open the mobile example menu, select an example, and expect it to close. Expect stacked panels and no page-level horizontal overflow.
6. Optionally use the SDK connection Load assistants action against the already running backend. Expect its existing loading/result/error behavior to remain visible. Do not claim graph/provider coverage from visual inspection.

## Backend assertions

- No SDK payload, graph ID, environment contract, or backend implementation changes are planned.
- Verify source scope and browser console for new frontend errors. Report any backend availability limitation separately.

## Cleanup and evidence

- Leave existing servers and user threads intact; remove only browser tabs created for verification when appropriate.
- Record desktop/mobile screenshots and the observed PASS/FAIL results in `progress/e2e-progress.md` and `docs/flow/2026-10-06-github-design-system.md`.
