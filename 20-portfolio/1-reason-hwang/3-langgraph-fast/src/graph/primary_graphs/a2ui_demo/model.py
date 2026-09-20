from __future__ import annotations

import os
from dataclasses import dataclass

from langchain_openai import ChatOpenAI
from pydantic import SecretStr


class OAuthResponsesChatOpenAI(ChatOpenAI):
    """Codex accepts typed developer messages, but rejects typed system messages.

    Keep this compatibility rule local to the demo's OAuth provider. API-key
    requests and the existing Chat Completions provider retain their own format.
    """

    def _get_request_payload(self, input_, *, stop=None, **kwargs):
        payload = super()._get_request_payload(input_, stop=stop, **kwargs)
        payload["input"] = [
            {**item, "role": "developer"}
            if item.get("type") == "message" and item.get("role") == "system"
            else item
            for item in payload.get("input", [])
        ]
        return payload


@dataclass(frozen=True)
class ModelSettings:
    provider: str
    model: str
    base_url: str
    api_key: str

    @classmethod
    def from_env(cls) -> ModelSettings:
        provider = os.getenv("A2UI_MODEL_PROVIDER", "oauth-proxy")
        if provider not in {"oauth-proxy", "api-key"}:
            raise ValueError("A2UI_MODEL_PROVIDER must be oauth-proxy or api-key")
        model = os.getenv("A2UI_MODEL", os.getenv("OPENAI_MODEL", "")).strip()
        if not model:
            raise ValueError("Set A2UI_MODEL (or OPENAI_MODEL)")
        if provider == "oauth-proxy":
            base_url = os.getenv("A2UI_MODEL_BASE_URL", os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:18741/v1"))
            api_key = os.getenv("A2UI_MODEL_API_KEY", "chatgpt-oauth-placeholder")
        else:
            base_url = os.getenv("A2UI_MODEL_BASE_URL", "https://api.openai.com/v1")
            api_key = os.getenv("A2UI_MODEL_API_KEY", os.getenv("OPENAI_API_KEY", ""))
            if not api_key or "placeholder" in api_key:
                raise ValueError("Set A2UI_MODEL_API_KEY for api-key mode")
        return cls(provider, model, base_url.rstrip("/"), api_key)

    def build(self) -> ChatOpenAI:
        model_class = OAuthResponsesChatOpenAI if self.provider == "oauth-proxy" else ChatOpenAI
        return model_class(
            model=self.model, base_url=self.base_url, api_key=SecretStr(self.api_key),
            use_responses_api=self.provider == "oauth-proxy",
            streaming=True, disable_streaming=False, timeout=120, max_retries=1,
        )
