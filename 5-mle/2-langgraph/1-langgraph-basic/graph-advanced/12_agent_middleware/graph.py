"""Observe the agent, model, and tool lifecycle of a create_agent graph.

The scripted model makes one tool call and then answers from its result, so this
example runs without an API key. The middleware uses the public LangChain hooks;
it does not add nodes to the surrounding LangGraph workflow.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from langchain.agents import create_agent
from langchain.agents.middleware import (
    AgentMiddleware,
    AgentState,
    ModelRequest,
    ModelResponse,
)
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, ToolMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from langchain_core.tools import tool
from langchain.tools.tool_node import ToolCallRequest
from langgraph.runtime import Runtime
from langgraph.types import Command


@tool
def multiply(a: int, b: int) -> int:
    """Multiply two integers."""
    return a * b


class ScriptedModel(BaseChatModel):
    """Request one tool call, then use its result in the final answer."""

    @property
    def _llm_type(self) -> str:
        return "scripted_middleware_demo"

    def bind_tools(self, tools: Any, **kwargs: Any) -> ScriptedModel:
        return self

    def _generate(
        self, messages: list[BaseMessage], stop: list[str] | None = None, **kwargs: Any
    ) -> ChatResult:
        tool_results = [message for message in messages if isinstance(message, ToolMessage)]
        if tool_results:
            answer = AIMessage(content=f"계산 결과는 {tool_results[-1].content}입니다.")
        else:
            answer = AIMessage(
                content="",
                tool_calls=[
                    {"name": "multiply", "args": {"a": 6, "b": 7}, "id": "multiply-1"}
                ],
            )
        return ChatResult(generations=[ChatGeneration(message=answer)])


class LifecycleMiddleware(AgentMiddleware):
    """Record where middleware can intervene in the create_agent loop."""

    def __init__(self, events: list[str] | None = None) -> None:
        super().__init__()
        self.events = events if events is not None else []

    def _record(self, event: str) -> None:
        self.events.append(event)
        print(event)

    def before_agent(self, state: AgentState, runtime: Runtime) -> None:
        self._record("before_agent")

    def before_model(self, state: AgentState, runtime: Runtime) -> None:
        self._record("before_model")

    def wrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], ModelResponse],
    ) -> ModelResponse:
        self._record("wrap_model_call:before")
        response = handler(request)
        self._record("wrap_model_call:after")
        return response

    def after_model(self, state: AgentState, runtime: Runtime) -> None:
        self._record("after_model")

    def wrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], ToolMessage | Command],
    ) -> ToolMessage | Command:
        self._record(f"wrap_tool_call:before:{request.tool_call['name']}")
        result = handler(request)
        self._record(f"wrap_tool_call:after:{request.tool_call['name']}")
        return result

    def after_agent(self, state: AgentState, runtime: Runtime) -> None:
        self._record("after_agent")


def build_graph(events: list[str] | None = None):
    return create_agent(
        model=ScriptedModel(),
        tools=[multiply],
        middleware=[LifecycleMiddleware(events)],
        name="advanced_agent_middleware",
    )


graph = build_graph()


if __name__ == "__main__":
    result = graph.invoke({"messages": [{"role": "user", "content": "6 곱하기 7은?"}]})
    print(f"answer: {result['messages'][-1].content}")
