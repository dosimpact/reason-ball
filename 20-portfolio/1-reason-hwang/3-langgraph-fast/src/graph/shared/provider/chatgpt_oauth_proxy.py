import os
from typing import Any

import httpx


class ChatGptOauthProxyProvider:
    def __init__(self, base_url: str | None = None, model: str | None = None) -> None:
        self.base_url = (base_url or os.getenv("CHATGPT_OAUTH_PROXY_URL", "http://127.0.0.1:8787")).rstrip("/")
        self.model = model or os.getenv("CHATGPT_OAUTH_PROXY_MODEL", "gpt-4.1-mini")

    async def complete(self, message: str) -> str:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": "user", "content": message}],
        }
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(f"{self.base_url}/v1/chat/completions", json=payload)
            response.raise_for_status()

        data = response.json()
        return data["choices"][0]["message"]["content"]
