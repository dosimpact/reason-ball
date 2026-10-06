# 2026-10-06 — UI-PUSH-EDGES-25

Context: user requested declaring every graph connection explicitly.

Change: replace the nodes tuple, registration loop, and index-based edge loop with individual add_node/add_edge/add_conditional_edges calls. Replace the inline lambda with route_after_stage. Every destination is visible by name.

Rationale: make the five-node learning example readable directly from build_graph while preserving stage failures routing to END.

Stock: docs/stock/system-design.md, UI-PUSH-CHAT-25; example plan synchronized.

Validation: graph import/compilation and declared graph inspection. No tests or provider calls.
