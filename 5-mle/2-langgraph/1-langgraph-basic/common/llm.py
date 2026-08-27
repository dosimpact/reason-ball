"""
공통 LLM 팩토리.

모든 graph/* 예제는 LLM 이 필요할 때 `create_llm()` 한 줄만 호출합니다.
OpenAI API 키는 표준 `OPENAI_API_KEY` 환경변수를 사용합니다.
"""

from __future__ import annotations

import os

from langchain_openai import ChatOpenAI

# ---------------------------------------------------------------------------
# OpenAI Configuration
# ---------------------------------------------------------------------------
OPENAI_MODEL_NORMAL = os.environ.get("OPENAI_MODEL_NORMAL", "gpt-5-nano")

MODEL_ALIASES: dict[str, str] = {
    "default": os.environ.get("OPENAI_MODEL_DEFAULT", "gpt-4o-mini"),
    "fast": os.environ.get("OPENAI_MODEL_FAST", "gpt-4o-mini"),
    "normal": OPENAI_MODEL_NORMAL,
    "smart": os.environ.get("OPENAI_MODEL_SMART", "gpt-5-mini"),
    "reasoning": os.environ.get("OPENAI_MODEL_REASONING", "o4-mini"),
}

DEFAULT_MODEL = os.environ.get("LANGGRAPH_MODEL", os.environ.get("OPENAI_MODEL", "default"))


def _resolve_model(model_alias: str) -> str:
    """기존 alias 또는 직접 지정한 OpenAI model id 를 실제 model id 로 해석."""
    return MODEL_ALIASES.get(model_alias, model_alias)


# GPT api Provider 결정
def create_llm(model_alias: str = DEFAULT_MODEL) -> ChatOpenAI:
    """ChatOpenAI LLM 인스턴스를 생성합니다."""
    return ChatOpenAI(model=_resolve_model(model_alias))


__all__ = [
    "DEFAULT_MODEL",
    "MODEL_ALIASES",
    "OPENAI_MODEL_NORMAL",
    "create_llm",
]
