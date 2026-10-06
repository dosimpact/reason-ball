# 2026-10-06 — LLM-MODELS-06

Context: user provided exact model IDs for this SDK workspace.

Change: synchronize `.env`, `.env.example`, and `common/llm.py` defaults: default/fast/normal → gpt-6-luna; smart/reasoning → gpt-6-sol. Keep OPENAI_MODEL=default. Replace obsolete model/price comments with the configured alias mapping; remove OPENAI_MODEL_CHEAP fallback. Preserve other settings and credentials.

Rationale: local configuration, sample configuration, and Python fallbacks should agree. This records the requested IDs without claiming verified provider availability.

Stock: `docs/stock/system-design.md`, LLM-MODELS-06.

Validation: reviewed alias-only diff. No provider calls, tests, or process restarts performed. Restart the graph process to reload module-level environment values.
