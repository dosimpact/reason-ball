"""Observe custom lifecycle hooks and the built-in TodoListMiddleware.

Scripted models make the tool calls reproducible without an API key. The custom
middleware uses public LangChain hooks; it does not add nodes to the graph.
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
    TodoListMiddleware,
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


class TodoScriptedModel(ScriptedModel):
    """Write a plan, calculate, replace the plan, then answer."""

    duplicate_writes: bool = False

    def _generate(
        self, messages: list[BaseMessage], stop: list[str] | None = None, **kwargs: Any
    ) -> ChatResult:
        tool_calls = [
            call
            for message in messages
            if isinstance(message, AIMessage)
            for call in message.tool_calls
        ]
        todo_writes = sum(call["name"] == "write_todos" for call in tool_calls)
        multiplied = any(call["name"] == "multiply" for call in tool_calls)

        if any(
            isinstance(message, ToolMessage) and message.status == "error"
            for message in messages
        ):
            answer = AIMessage(content="병렬 write_todos 호출이 거절되었습니다.")
        elif todo_writes == 0:
            initial_todos = [
                {"content": "6 × 7 계산", "status": "in_progress"},
                {"content": "결과 보고", "status": "pending"},
            ]
            calls = [
                {"name": "write_todos", "args": {"todos": initial_todos}, "id": "todos-start"}
            ]
            if self.duplicate_writes:
                calls.append(
                    {
                        "name": "write_todos",
                        "args": {"todos": initial_todos},
                        "id": "todos-duplicate",
                    }
                )
            answer = AIMessage(
                content="",
                tool_calls=calls,
            )
        elif not multiplied:
            answer = AIMessage(
                content="",
                tool_calls=[
                    {"name": "multiply", "args": {"a": 6, "b": 7}, "id": "multiply-1"}
                ],
            )
        elif todo_writes == 1:
            answer = AIMessage(
                content="",
                tool_calls=[
                    {
                        "name": "write_todos",
                        "args": {"todos": [
                            {"content": "6 × 7 계산", "status": "completed"},
                            {"content": "결과 보고", "status": "completed"},
                        ]},
                        "id": "todos-finish",
                    }
                ],
            )
        else:
            product = next(
                message.content
                for message in messages
                if isinstance(message, ToolMessage) and message.name == "multiply"
            )
            answer = AIMessage(content=f"계산 결과는 {product}입니다.")
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


def build_todo_graph(events: list[str] | None = None, *, duplicate_writes: bool = False):
    return create_agent(
        model=TodoScriptedModel(duplicate_writes=duplicate_writes),
        tools=[multiply],
        middleware=[LifecycleMiddleware(events), TodoListMiddleware()],
        name="advanced_todo_list_middleware",
    )


graph = build_graph()
todo_graph = build_todo_graph()


if __name__ == "__main__":
    print("=== custom lifecycle middleware ===")
    result = graph.invoke({"messages": [{"role": "user", "content": "6 곱하기 7은?"}]})
    print(f"answer: {result['messages'][-1].content}")

    print("\n=== built-in TodoListMiddleware + lifecycle middleware ===")
    result = todo_graph.invoke(
        {"messages": [{"role": "user", "content": "6 곱하기 7을 계산하고 결과를 보고해줘."}]}
    )
    print(f"todos: {result['todos']}")
    print(f"answer: {result['messages'][-1].content}")
