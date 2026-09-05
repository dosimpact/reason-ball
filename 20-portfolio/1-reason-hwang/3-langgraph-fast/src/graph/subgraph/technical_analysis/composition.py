from __future__ import annotations

from langchain_core.language_models import BaseChatModel

from domains.technical_analysis.ports import TechnicalAnalysisEngine
from graph.provider import ChatGptOauthProxyProvider
from infrastructure.technical_analysis.talib import TaLibAnalysisEngine


def build_default_dependencies() -> tuple[BaseChatModel, TechnicalAnalysisEngine]:
    model = ChatGptOauthProxyProvider().chat_model()
    engine = TaLibAnalysisEngine()
    return model, engine
