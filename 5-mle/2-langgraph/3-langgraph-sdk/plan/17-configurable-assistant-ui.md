# 17 Configurable Assistant UI

## Coding Scope

- Graph: `graphs/17_configurable_assistant.py` adapts `17_configurable`.
- Frontend: `src/examples/17-configurable-assistant-ui/` lets users adjust assistant/run config.

## Implementation Plan

1. Define configurable fields for model alias, system prompt, style, and temperature.
2. Build a config form with validation and reset.
3. Run the same prompt with default config and override config.
4. Display config used for each run alongside output.

## SDK And State Notes

Use SDK config fields supported by LangGraph runtime. Persist form values locally unless assistant-level persistence is added.

## Risks

- Unsupported config keys may be silently ignored by the graph.
- Model aliases must stay aligned with `.env.example` and local `.env`.

## Acceptance Criteria

- Changing config affects the next run without changing code.
- The UI shows the effective config per run.
- Invalid config values are blocked before run creation.
