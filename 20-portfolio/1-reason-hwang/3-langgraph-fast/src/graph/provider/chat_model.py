"""One provider selection for every conversational OpenAI-compatible model."""
from __future__ import annotations

import os
from dataclasses import dataclass

from langchain_openai import ChatOpenAI
from pydantic import SecretStr


def _setting(name: str, fallback: str) -> str:
    return os.getenv(name, "").strip() or fallback


@dataclass(frozen=True)
class ChatModelSettings:
    provider: str
    model: str
    base_url: str
    api_key: str

    @classmethod
    def from_env(cls) -> ChatModelSettings:
        provider = _setting("CHAT_LLM_PROVIDER", "oauth-proxy")
        if provider not in {"oauth-proxy", "openai"}:
            raise ValueError("CHAT_LLM_PROVIDER must be oauth-proxy or openai")
        if provider == "oauth-proxy":
            model = _setting("CHAT_LLM_OAUTH_MODEL", _setting("OPENAI_MODEL", "gpt-5.3-codex-spark"))
            base_url = _setting("CHAT_LLM_OAUTH_BASE_URL", _setting("OPENAI_BASE_URL", "http://127.0.0.1:2890/v1"))
            api_key = _setting("CHAT_LLM_OAUTH_API_KEY", _setting("OPENAI_API_KEY", "chatgpt-oauth-placeholder"))
        else:
            # OPENAI_MODEL/BASE_URL historically point to Codex in this workspace.
            # Never carry those proxy settings into the paid API provider.
            model = _setting("CHAT_LLM_OPENAI_MODEL", "gpt-4.1-mini")
            base_url = _setting("CHAT_LLM_OPENAI_BASE_URL", "https://api.openai.com/v1")
            api_key = _setting("CHAT_LLM_OPENAI_API_KEY", _setting("OPENAI_API_KEY", ""))
            if not api_key or "placeholder" in api_key.lower():
                raise ValueError("Set CHAT_LLM_OPENAI_API_KEY (or a real OPENAI_API_KEY) for openai mode")
        base_url = base_url.rstrip("/")
        if provider == "oauth-proxy" and not base_url.endswith("/v1"):
            base_url += "/v1"
        return cls(provider, model, base_url, api_key)

    def build(self, **kwargs) -> ChatOpenAI:
        return ChatOpenAI(
            model=self.model, base_url=self.base_url, api_key=SecretStr(self.api_key),
            **kwargs,
        )


def chat_model() -> ChatOpenAI:
    return ChatModelSettings.from_env().build(timeout=180, max_retries=1)
