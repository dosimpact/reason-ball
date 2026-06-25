"""Example 48: LangChain TodoListMiddleware with visible todo state."""

from __future__ import annotations

import asyncio
from typing import Any, Sequence

from langchain.agents import create_agent
from langchain.agents.middleware import TodoListMiddleware
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from langchain_core.tools import BaseTool


Todo = dict[str, str]
DEMO_STEP_DELAY_SECONDS = 5.0


def _todos(step: int) -> list[Todo]:
    snapshots: list[list[Todo]] = [
        [
            {"content": "Break the request into observable implementation steps", "status": "in_progress"},
            {"content": "Wire the backend todo state into the SDK stream", "status": "pending"},
            {"content": "Render the todo list and summarize the result", "status": "pending"},
        ],
        [
            {"content": "Break the request into observable implementation steps", "status": "completed"},
            {"content": "Wire the backend todo state into the SDK stream", "status": "in_progress"},
            {"content": "Render the todo list and summarize the result", "status": "pending"},
        ],
        [
            {"content": "Break the request into observable implementation steps", "status": "completed"},
            {"content": "Wire the backend todo state into the SDK stream", "status": "completed"},
            {"content": "Render the todo list and summarize the result", "status": "in_progress"},
        ],
        [
            {"content": "Break the request into observable implementation steps", "status": "completed"},
            {"content": "Wire the backend todo state into the SDK stream", "status": "completed"},
            {"content": "Render the todo list and summarize the result", "status": "completed"},
        ],
    ]
    return snapshots[min(step, len(snapshots) - 1)]


def _tool_message_count(messages: list[BaseMessage]) -> int:
    return sum(
        1
        for message in messages
        if isinstance(message, ToolMessage)
        and str(getattr(message, "content", "")).startswith("Updated todo list")
    )


def _wants_duplicate_demo(messages: list[BaseMessage]) -> bool:
    for message in messages:
        if isinstance(message, HumanMessage) and "duplicate-call" in str(message.content).lower():
            return True
    return False


def _has_duplicate_error(messages: list[BaseMessage]) -> bool:
    return any(
        isinstance(message, ToolMessage)
        and "should never be called multiple times in parallel" in str(message.content)
        for message in messages
    )


class TodoDemoModel(BaseChatModel):
    """Deterministic chat model that exercises TodoListMiddleware without API keys."""

    @property
    def _llm_type(self) -> str:
        return "todo-list-middleware-demo"

    def bind_tools(
        self,
        tools: Sequence[dict[str, Any] | type | BaseTool],
        *,
        tool_choice: str | None = None,
        **kwargs: Any,
    ) -> "TodoDemoModel":
        return self

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: Any | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        return self._next_result(messages)

    async def _agenerate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: Any | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        todo_updates = _tool_message_count(messages)
        if 0 < todo_updates < 4 and not _has_duplicate_error(messages):
            await asyncio.sleep(DEMO_STEP_DELAY_SECONDS)
        return self._next_result(messages)

    def _next_result(self, messages: list[BaseMessage]) -> ChatResult:
        todo_updates = _tool_message_count(messages)
        if _has_duplicate_error(messages):
            message = AIMessage(
                content=(
                    "The middleware rejected parallel write_todos calls. The UI can show "
                    "the error without replacing the todo board state."
                )
            )
            return ChatResult(generations=[ChatGeneration(message=message)])

        if todo_updates == 0 and _wants_duplicate_demo(messages):
            message = AIMessage(
                content="",
                tool_calls=[
                    {
                        "id": "duplicate-todos-a",
                        "name": "write_todos",
                        "args": {"todos": _todos(0)},
                    },
                    {
                        "id": "duplicate-todos-b",
                        "name": "write_todos",
                        "args": {"todos": _todos(1)},
                    },
                ],
            )
            return ChatResult(generations=[ChatGeneration(message=message)])

        if todo_updates < 4:
            step = todo_updates
            message = AIMessage(
                content="",
                tool_calls=[
                    {
                        "id": f"todos-{step + 1}",
                        "name": "write_todos",
                        "args": {"todos": _todos(step)},
                    }
                ],
            )
            return ChatResult(generations=[ChatGeneration(message=message)])

        message = AIMessage(
            content=(
                "The todo workflow is complete. The middleware created a structured list, "
                "replaced it on each write_todos call, and left the final completed list in state."
            )
        )
        return ChatResult(generations=[ChatGeneration(message=message)])


TODO_SYSTEM_PROMPT = (
    "You are the TodoListMiddleware SDK example. Use write_todos for the multi-step "
    "request, update the whole todo list as state changes, and give a final answer "
    "after the final todo update."
)


def build_graph():
    return create_agent(
        model=TodoDemoModel(),
        tools=[],
        system_prompt=TODO_SYSTEM_PROMPT,
        middleware=[TodoListMiddleware()],
        name="todo_list_middleware",
    )


graph = build_graph()


if __name__ == "__main__":
    out = graph.invoke(
        {
            "messages": [
                HumanMessage(
                    content=(
                        "Plan and complete a three-step LangGraph SDK todo list demo."
                    )
                )
            ]
        }
    )
    print(out["todos"])
