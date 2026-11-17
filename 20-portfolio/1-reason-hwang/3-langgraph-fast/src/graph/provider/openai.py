"""Compatibility adapter; the common chat provider flag owns routing."""
from graph.provider.chatgpt_oauth_proxy import ChatGptOauthProxyProvider


class OpenAIProvider(ChatGptOauthProxyProvider):
    def __init__(self, model: str | None = None) -> None:
        super().__init__(model=model)
