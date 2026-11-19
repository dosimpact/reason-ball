"""Compatibility adapter for graph callers using the original provider name."""
from langchain_openai import ChatOpenAI

from graph.provider.chat_model import ChatModelSettings


class ChatGptOauthProxyProvider:
    def __init__(self, base_url: str | None = None, model: str | None = None) -> None:
        self.settings = ChatModelSettings.from_env()
        self.base_url = self.settings.base_url
        self.model = self.settings.model

    def chat_model(self) -> ChatOpenAI:
        return self.settings.build(disable_streaming=True)

    async def complete(self, message: str) -> str:
        response = await self.chat_model().ainvoke(message)
        if isinstance(response.content, str):
            return response.content
        return "".join(
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in response.content
        )
