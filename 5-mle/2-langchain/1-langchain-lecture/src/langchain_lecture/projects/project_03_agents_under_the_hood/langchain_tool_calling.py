from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage

from langchain_lecture.projects.project_03_agents_under_the_hood.tools import (
    apply_discount,
    get_product_price,
    tool_registry,
)
from langchain_lecture.shared.models import get_chat_model


SYSTEM_PROMPT = (
    "You are a shopping assistant. Always call get_product_price before "
    "applying a discount. Always use apply_discount for discount math."
)


def run_agent(question: str, *, model=None, max_iterations: int = 10) -> str | None:
    tools = [get_product_price, apply_discount]
    tools_by_name = tool_registry()
    llm = model or get_chat_model(temperature=0)
    llm_with_tools = llm.bind_tools(tools)
    messages = [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=question)]

    for _ in range(max_iterations):
        ai_message = llm_with_tools.invoke(messages)
        tool_calls = getattr(ai_message, "tool_calls", None) or []
        if not tool_calls:
            return str(ai_message.content)

        messages.append(ai_message)
        for tool_call in tool_calls[:1]:
            tool_to_use = tools_by_name[tool_call["name"]]
            observation = tool_to_use.invoke(tool_call.get("args", {}))
            messages.append(
                ToolMessage(
                    content=str(observation),
                    tool_call_id=tool_call.get("id"),
                )
            )

    return None

