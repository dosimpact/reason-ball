from __future__ import annotations

from collections.abc import Callable
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, SystemMessage
from langchain_core.tools import BaseTool

from graph.subgraph.technical_analysis.prompts import SYSTEM_PROMPT
from graph.subgraph.technical_analysis.state import TechnicalAnalysisState


def create_call_model_node(
    model: BaseChatModel,
    analysis_tool: BaseTool,
) -> Callable[[TechnicalAnalysisState], Any]:
    model_with_tools = model.bind_tools([analysis_tool])

    async def call_model(state: TechnicalAnalysisState) -> dict[str, list[BaseMessage]]:
        messages: list[BaseMessage] = [SystemMessage(content=SYSTEM_PROMPT)]
        messages.extend(state.get("messages", []))
        response = await model_with_tools.ainvoke(messages)
        return {"messages": [response]}

    return call_model
