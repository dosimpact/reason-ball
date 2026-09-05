import os
from typing import Any

import httpx
from langchain_openai import ChatOpenAI


class ChatGptOauthProxyProvider:
    def __init__(self, base_url: str | None = None, model: str | None = None) -> None:
        configured_base_url = base_url or os.getenv(
            "OPENAI_BASE_URL",
            "http://127.0.0.1:18741/v1",
        )
        self.base_url = configured_base_url.rstrip("/")
        if not self.base_url.endswith("/v1"):
            self.base_url = f"{self.base_url}/v1"

        self.model = model or os.getenv("OPENAI_MODEL", "gpt-5.3-codex-spark")

    def chat_model(self) -> ChatOpenAI:
        """Return a LangChain chat model configured for the OAuth proxy."""
        return ChatOpenAI(
            model=self.model,
            base_url=self.base_url,
            api_key=lambda: os.getenv(
                "OPENAI_API_KEY",
                "chatgpt-oauth-placeholder",
            ),
            disable_streaming=True,
        )

    async def complete(self, message: str) -> str:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": "user", "content": message}],
        }
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(f"{self.base_url}/chat/completions", json=payload)
            response.raise_for_status()

        data = response.json()
        return data["choices"][0]["message"]["content"]
