from __future__ import annotations

from dataclasses import dataclass

from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from graph.provider.chat_model import ChatModelSettings


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
        settings = ChatModelSettings.from_env()
        return cls(settings.provider, settings.model, settings.base_url, settings.api_key)

    def build(self) -> ChatOpenAI:
        model_class = OAuthResponsesChatOpenAI if self.provider == "oauth-proxy" else ChatOpenAI
        return model_class(
            model=self.model, base_url=self.base_url, api_key=SecretStr(self.api_key),
            use_responses_api=self.provider == "oauth-proxy",
            streaming=True, disable_streaming=False, timeout=120, max_retries=1,
        )
