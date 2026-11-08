"""Example 48: LangChain TodoListMiddleware with visible todo state.

쉽게 이해하기
-------------
TodoListMiddleware는 agent가 할 일 목록을 쓰고 갱신하도록 돕는 공통 처리다.
예: 조사 중 → 조사 완료 상태를 todos에 기록한다.
이 예제는 정해진 데모 모델로 목록 변경을 화면에서 확인한다.

그래프 구조
-----------
고정 데모 모델이 write_todos를 순차 호출해 할 일 상태를 갱신하고, 중복 호출 시 오류 처리도 보여준다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Show the implementation steps as a todo list."
    }
  ]
}
```
관찰할 결과: 순차 write_todos와 최종 todos의 completed 상태를 확인합니다.

추가 입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "duplicate-call"
    }
  ]
}
```
관찰할 결과: 중복 병렬 write_todos 요청의 오류 ToolMessage를 확인합니다.

실행 조건·방법:
기본은 API 키 없는 결정적 모델이며 비동기 실행 중 단계 지연이 있습니다.
"""
# 예제 개요: TodoListMiddleware가 todo 상태를 갱신하는 과정을 결정적 모델로 재현합니다.
# 핵심 흐름: API 키 없이 순차 write_todos 호출과 중복 병렬 호출 오류를 관찰할 수 있습니다.

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


# 미들웨어를 관찰하기 위해 실제 API 대신 정해진 도구 호출을 반환하는 데모 모델입니다.
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

    # 완료된 todo 갱신 수를 기준으로 다음 도구 호출을 결정하고 마지막에는 완료 응답을 반환합니다.
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


# 그래프 구성: create_agent가 모델과 도구의 반복 실행을 구성하고 미들웨어를 연결합니다.
def build_graph():
    return create_agent(
        model=TodoDemoModel(),
        tools=[],
        system_prompt=TODO_SYSTEM_PROMPT,
        middleware=[TodoListMiddleware()],
        name="48_todo_list_middleware",
    )


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()


# 단독 실행 데모: 이 파일을 직접 실행할 때만 샘플 입력으로 그래프를 호출합니다.
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
