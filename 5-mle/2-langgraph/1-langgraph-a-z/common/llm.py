"""OpenAI chat model factory used by graph examples."""

from __future__ import annotations

import os

from langchain_openai import ChatOpenAI

MODEL_ALIASES: dict[str, str] = {
    "luna": os.environ.get("OPENAI_MODEL_LUNA", "gpt-6-luna"),
    "terra": os.environ.get("OPENAI_MODEL_TERRA", "gpt-6.1-terra"),
}

DEFAULT_MODEL = os.environ.get(
    "LANGGRAPH_MODEL",
    os.environ.get("OPENAI_MODEL", "luna"),
)


def resolve_model(model_alias: str | None = None) -> str:
    """Resolve a configured model alias to an OpenAI model id."""
    selected = model_alias or DEFAULT_MODEL
    return MODEL_ALIASES.get(selected, selected)


def create_llm(
    model_alias: str | None = None,
    *,
    temperature: float | None = None,
    reasoning_effort: str | None = None,
) -> ChatOpenAI:
    """선택한 경우에만 Responses API의 reasoning.effort를 전달한다."""
    options = {"model": resolve_model(model_alias), "temperature": temperature}
    # Terra의 도구 호출은 Responses API를 사용한다.
    if options["model"] == "gpt-6.1-terra":
        options["use_responses_api"] = True
    if reasoning_effort is not None:
        options.update(
            reasoning={"effort": reasoning_effort},
            use_responses_api=True,
            timeout=60,
            max_retries=1,
        )
    return ChatOpenAI(**options)


__all__ = ["DEFAULT_MODEL", "MODEL_ALIASES", "create_llm", "resolve_model"]
