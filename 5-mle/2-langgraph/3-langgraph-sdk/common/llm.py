"""OpenAI chat model factory used by graph examples."""

from __future__ import annotations

import os

from langchain_openai import ChatOpenAI


MODEL_ALIASES: dict[str, str] = {
    "default": os.environ.get("OPENAI_MODEL_DEFAULT", "gpt-4o-mini"),
    "fast": os.environ.get("OPENAI_MODEL_FAST", "gpt-4o-mini"),
    "normal": os.environ.get(
        "OPENAI_MODEL_NORMAL",
        os.environ.get("OPENAI_MODEL_CHEAP", "gpt-5-nano"),
    ),
    "smart": os.environ.get("OPENAI_MODEL_SMART", "gpt-5-mini"),
    "reasoning": os.environ.get("OPENAI_MODEL_REASONING", "o4-mini"),
}

DEFAULT_MODEL = os.environ.get(
    "LANGGRAPH_MODEL",
    os.environ.get("OPENAI_MODEL", "default"),
)


def resolve_model(model_alias: str | None = None) -> str:
    """Resolve a configured model alias to an OpenAI model id."""
    selected = model_alias or DEFAULT_MODEL
    return MODEL_ALIASES.get(selected, selected)


def create_llm(model_alias: str | None = None, *, temperature: float = 0) -> ChatOpenAI:
    """Create a deterministic OpenAI chat model for examples and tests."""
    return ChatOpenAI(model=resolve_model(model_alias), temperature=temperature)


__all__ = ["DEFAULT_MODEL", "MODEL_ALIASES", "create_llm", "resolve_model"]
