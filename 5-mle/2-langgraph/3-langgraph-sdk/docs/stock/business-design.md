# LangGraph SDK examples: business design

Current state: 2026-10-06.

## Product and learning journey

This application is a learning workspace for LangGraph graph backends and React interfaces. The current catalog in `src/data/examples.ts` contains 54 entries across five learning paths: MVP, Core, Generative UI, Artifact, and CopilotKit. `goal.md` defines the learning topics; `plan/` contains their detailed designs.

Users select an example from grouped navigation, configure the example's available inputs, run its graph, and inspect responses, stream events, state, tools, or artifacts. Implemented catalog status is distinct from current runtime availability and validation coverage.

## UI-GH-01: shared interface

The shared interface follows GitHub Primer's light design conventions: repository-style identity and overview, a compact example sidebar, neutral white/gray surfaces, thin borders, system typography, green primary actions, blue links and selection indicators, and semantic success/warning/error states.

The header identifies `langgraph / sdk-examples`, shows the actual example count, and links to SDK documentation. Navigation groups retain collapse/expand controls. The active example has a contextual learning-path description and its existing plan path. At narrow widths, users open a mobile example menu and panels stack vertically. Keyboard users receive visible focus outlines; the active example exposes `aria-current`.

The initial SDK connection example includes an empty response explanation before execution. Existing example graph actions and result flows remain available.

## Documentation and validation

- Detailed shared design: `plan/github-design-system.md`.
- UI verification contract: `e2e-plan/github-design-system.md`.
- Architecture: `docs/stock/system-design.md`.
- Change history: `docs/flow/2026-10-06-github-design-system.md`.
- Coordination and validation evidence: `progress/planning.md`, `progress/implement.md`, and `progress/e2e-progress.md`.

## UI-PUSH-CHAT-25: progress in chat

Example 25 is a multi-turn chat. Each user prompt triggers three internal LLM calls on dummy material, with `데이터 검색중`, `자료 취합중`, and `자료 완성중` UI, followed by a fourth LLM call for the final answer. The conversation and prior progress stay visible. New chat resets the local view. Each turn has one Assistant bubble from work start through completion: work-start status, three short public progress summaries, and the final answer. Stage summaries describe work/results and are rendered as a compact list inside the Assistant turn. The progress list is collapsed by default under a “작업 과정” disclosure; users can open or close it independently for each turn. The final answer streams progressively in the same Assistant bubble outside that disclosure. Interrupted streams retain received partial text with an interrupted label. Each item shows an icon, stage title, status, and inline summary, without separate cards. They are not additional chat messages. Failed turns remain visible with an interrupted status. Diagnostics are collapsed by default. See `plan/25-push-ui-message.md` and `docs/flow/2026-10-06-push-ui-chat.md`.
