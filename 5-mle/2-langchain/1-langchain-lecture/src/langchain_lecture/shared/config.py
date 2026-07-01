from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass(frozen=True)
class AppConfig:
    model_provider: str
    openai_api_key: str | None
    openai_model: str
    ollama_model: str
    ollama_base_url: str
    pinecone_index_name: str


def load_config() -> AppConfig:
    load_dotenv()
    return AppConfig(
        model_provider=os.getenv("MODEL_PROVIDER", "openai").strip().lower(),
        openai_api_key=os.getenv("OPENAI_API_KEY") or None,
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        ollama_model=os.getenv("OLLAMA_MODEL", "qwen3:1.7b"),
        ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        pinecone_index_name=os.getenv("PINECONE_INDEX_NAME", "langchain-docs-2026"),
    )

