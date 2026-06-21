from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass(frozen=True)
class AppConfig:
    model_provider: str
    openai_api_key: str | None
    openai_model: str
    ollama_base_url: str
    ollama_model: str
    langsmith_tracing: str
    langsmith_project: str


def load_config() -> AppConfig:
    load_dotenv()

    return AppConfig(
        model_provider=os.getenv("MODEL_PROVIDER", "openai").strip().lower(),
        openai_api_key=os.getenv("OPENAI_API_KEY") or None,
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        ollama_model=os.getenv("OLLAMA_MODEL", "llama3.1"),
        langsmith_tracing=os.getenv("LANGSMITH_TRACING", "true"),
        langsmith_project=os.getenv(
            "LANGSMITH_PROJECT", "agentic-design-patterns"
        ),
    )
