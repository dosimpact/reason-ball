from __future__ import annotations

from langchain_core.language_models.chat_models import BaseChatModel

from agentic_design_patterns.shared.config import AppConfig, load_config


def get_chat_model(config: AppConfig | None = None, *, temperature: float = 0) -> BaseChatModel:
    """Return the configured chat model without exposing provider details to patterns."""
    resolved = config or load_config()

    if resolved.model_provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=resolved.openai_model,
            api_key=resolved.openai_api_key,
            temperature=temperature,
        )

    if resolved.model_provider == "ollama":
        from langchain_ollama import ChatOllama

        return ChatOllama(
            model=resolved.ollama_model,
            base_url=resolved.ollama_base_url,
            temperature=temperature,
        )

    raise ValueError(
        "Unsupported MODEL_PROVIDER "
        f"{resolved.model_provider!r}. Expected 'openai' or 'ollama'."
    )
