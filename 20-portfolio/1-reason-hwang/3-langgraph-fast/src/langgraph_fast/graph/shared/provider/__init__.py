from langgraph_fast.graph.shared.provider.chatgpt_oauth_proxy import (
    ChatGptOauthProxyProvider,
)
from langgraph_fast.graph.shared.provider.openai import OpenAIProvider


def get_provider(name: str):
    normalized = name.strip().lower()
    if normalized == "openai":
        return OpenAIProvider()
    if normalized in {"chatgpt-oauth-proxy", "proxy"}:
        return ChatGptOauthProxyProvider()
    raise ValueError(f"Unsupported provider: {name}")


__all__ = ["ChatGptOauthProxyProvider", "OpenAIProvider", "get_provider"]
