# Dashboard runtime

- `models.py`: panel/command schema.
- `store.py`: SQLite transactions, revision conflicts, operation deduplication, grid collision and pin rules.
- `validation.py`: asks frontend `/api/validate` to parse independent OpenUI programs before publication.
- `tools.py`: thread-scoped agent tools using the same store commands as direct UI actions.
- `graph.py`: Deep Agent with SEC collector subagent, inherited PDF search and dashboard tools.
- `api.py`: `/dashboard/chat` AG-UI and `/dashboard/state/{thread_id}` reads/commands.

Canvas snapshots are server-owned and survive reload. STATE_DELTA currently replaces `/dashboard` as one atomic JSON Patch operation; it is standard AG-UI but not a bandwidth-optimized per-field patch. Browser-only exports are exposed as explicit user download/print controls. They do not claim an automatic browser filesystem write.
