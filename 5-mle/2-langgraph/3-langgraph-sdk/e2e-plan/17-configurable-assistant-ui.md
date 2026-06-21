# 17 Configurable Assistant UI E2E Plan

## Setup

- LangGraph API runs at `http://localhost:2931`.
- React UI runs at `http://localhost:2934` with `VITE_LANGGRAPH_API_URL=http://localhost:2931`.
- Local `.env` must include a valid `OPENAI_API_KEY`.
- The LangGraph server exposes the `configurable_assistant` graph.
- Example navigation includes `17 Configurable Assistant UI`.
- The UI provides a default API URL, prompt textarea, model alias select, style select or segmented control, temperature input, system prompt textarea, and buttons named `Compare configs`, `Run default`, `Run override`, and `Reset`.
- The SDK client streams with `updates` and `custom` modes and passes run overrides through `config.configurable`.

## User Actions

1. Open the app and select `17 Configurable Assistant UI`.
2. Confirm the default API URL and all panels are present: `Config Form`, `Run Status`, `Effective Config`, `Output Comparison`, `Config Diff`, `Config Events`, `Final Answer`, `Final State`, and `Raw Stream Events`.
3. Enter a unique prompt that can be recognized in the final state without relying on exact LLM output.
4. Set the override model alias to `fast`.
5. Set the override style to `playful` or `strict`.
6. Set the override temperature to `0.2`.
7. Enter a unique custom system prompt.
8. Click `Compare configs`.
9. Wait for `Run complete`.
10. Review the result cards, effective config, config diff, config events, final answer, final state, and raw stream events.

## Expected UI States

- `Config Form` keeps the prompt, model alias, style, temperature, and system prompt values visible and editable.
- `Run Status` shows both default and override runs reaching a complete state after comparison.
- `Effective Config` shows the latest effective runtime values, including model, style, temperature, and system prompt.
- `Output Comparison` shows separate `Default Run` and `Override Run` result cards.
- `Config Diff` compares default and override values for model, style, temperature, and system prompt.
- `Config Events` includes `config_applied` events for the default and override runs.
- `Final Answer` is populated after completion but is not asserted against exact LLM wording.
- `Final State` contains `effective_config`, `response`, and `config_events`.
- `Raw Stream Events` contains both `updates` and `custom` stream events, including the config event payloads.

## Backend Assertions

- The SDK client streams against graph id `configurable_assistant`.
- Stream mode includes both `updates` and `custom`.
- The default run sends an empty `config.configurable` override and resolves graph defaults.
- The override run sends `model`, `style`, `temperature`, and `system_prompt` through `config.configurable`.
- The effective config for the default run includes default values such as `style: concise` and `temperature: 0`.
- The effective config for the override run includes the selected override values such as `model: fast`, selected style, `temperature: 0.2`, and the custom system prompt.
- Final graph state includes `effective_config`, `response`, `response_summary`, `config_events`, `final`, and trace data.
- Custom stream payloads include `type: config_applied`.

## Subagent Tracking Notes

- Implementation-tracking subagents should keep example 17 marked in progress until the React route, `configurable_assistant` graph registration, and this E2E spec pass together.
- The E2E subagent should update `progress/e2e-progress.md` after the broader workflow allows progress-file edits.
- Mark the E2E status complete only after a Playwright MCP run verifies config override propagation, default-vs-override comparison, final state fields, and raw `updates` plus `custom` stream events against the real OpenAI-backed graph.

## Cleanup

- The test uses unique prompt and system prompt strings for each run and does not create durable store records.
- Page storage should be cleared before the test if the UI stores form values, selected config, expanded panels, or stream results locally.
