"""설정에 맞춰 OpenAI 또는 Ollama 채팅 모델을 생성합니다."""

from __future__ import annotations

from langchain_core.language_models.chat_models import BaseChatModel

from langchain_lecture.shared.config import AppConfig, load_config


def get_chat_model(
    config: AppConfig | None = None,
    *,
    temperature: float = 0,
    model: str | None = None,
) -> BaseChatModel:
    resolved = config or load_config()

    if resolved.model_provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=model or resolved.openai_model,
            api_key=resolved.openai_api_key,
            temperature=temperature,
        )

    if resolved.model_provider == "ollama":
        from langchain_ollama import ChatOllama

        return ChatOllama(
            model=model or resolved.ollama_model,
            base_url=resolved.ollama_base_url,
            temperature=temperature,
        )

    raise ValueError(
        f"Unsupported MODEL_PROVIDER {resolved.model_provider!r}. "
        "Expected 'openai' or 'ollama'."
    )

