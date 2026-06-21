# 22 Custom Event Renderer

## Coding Scope

- Graph: `graphs/22_custom_event_renderer.py` adapts `18_custom_streaming`.
- Frontend: `src/examples/22-custom-event-renderer/` renders inline progress events.

## Implementation Plan

1. Emit custom events for phase, progress, warning, and status.
2. Create typed renderers for known event kinds.
3. Place progress components inline in the chat flow.
4. Preserve unknown custom events in a raw inspector.

## SDK And State Notes

Use `custom` stream mode and avoid overloading assistant text messages for progress.

## Risks

- Custom event names need versioning to avoid renderer drift.
- Rapid progress updates can cause noisy rendering without coalescing.

## Acceptance Criteria

- Custom events are visually distinct from assistant messages.
- Progress updates replace or update the right inline component.
- Unknown event kinds remain inspectable.
