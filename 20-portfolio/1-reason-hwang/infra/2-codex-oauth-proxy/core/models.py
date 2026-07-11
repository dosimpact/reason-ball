"""Codex model IDs and compatibility aliases used by the proxy."""

DEFAULT_CODEX_MODEL = "gpt-5.4-mini"

# Verified against POST https://chatgpt.com/backend-api/codex/responses.
SUPPORTED_CODEX_MODELS = (
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.5",
    "gpt-5.4",
    "gpt-5.4-mini",
    "gpt-5.3-codex-spark",
)

# Requested model IDs that the live Codex endpoint currently rejects.
UNAVAILABLE_CODEX_MODELS = (
    "gpt-5.6-luna",
)

# Unsupported or legacy OpenAI model names mapped to a working Codex model.
MODEL_ALIASES: dict[str, str] = {
    "gpt-4o": DEFAULT_CODEX_MODEL,
    "gpt-4o-mini": DEFAULT_CODEX_MODEL,
    "gpt-4o-2024-08-06": DEFAULT_CODEX_MODEL,
    "gpt-4.1-mini": DEFAULT_CODEX_MODEL,
    "gpt-4-turbo": DEFAULT_CODEX_MODEL,
    "gpt-4": DEFAULT_CODEX_MODEL,
    "gpt-3.5-turbo": DEFAULT_CODEX_MODEL,
    "o4-mini": DEFAULT_CODEX_MODEL,
    "o3-mini": DEFAULT_CODEX_MODEL,
    "gpt-5-nano": DEFAULT_CODEX_MODEL,
}


def map_model(model: str) -> str:
    """Map an unsupported model alias to a Codex-compatible model ID."""
    return MODEL_ALIASES.get(model, model)
