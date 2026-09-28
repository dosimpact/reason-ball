"""Demonstrate automatic conversation compaction before an agent model call."""

from __future__ import annotations

import os
import sys
from typing import Any

from langchain.agents import create_agent
from langchain.agents.middleware import SummarizationMiddleware
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from langgraph.checkpoint.memory import InMemorySaver
from pydantic import PrivateAttr


class DemoSummaryModel(BaseChatModel):
    """Stand in for an LLM while recording when summarization was requested."""

    _prompts: list[str] = PrivateAttr(default_factory=list)

    @property
    def prompts(self) -> list[str]:
        return self._prompts

    @property
    def _llm_type(self) -> str:
        return "demo_summary_model"

    def _generate(
        self, messages: list[BaseMessage], stop: list[str] | None = None, **kwargs: Any
    ) -> ChatResult:
        self._prompts.append(str(messages[-1].content))
        summary = "사용자는 서울 여행을 계획하며 지하철 이동을 선호합니다."
        return ChatResult(generations=[ChatGeneration(message=AIMessage(content=summary))])


class DemoResponseModel(BaseChatModel):
    """Record the context actually delivered to the main agent model."""

    _contexts: list[list[BaseMessage]] = PrivateAttr(default_factory=list)

    @property
    def contexts(self) -> list[list[BaseMessage]]:
        return self._contexts

    @property
    def _llm_type(self) -> str:
        return "demo_response_model"

    def _generate(
        self, messages: list[BaseMessage], stop: list[str] | None = None, **kwargs: Any
    ) -> ChatResult:
        self._contexts.append(list(messages))
        return ChatResult(
            generations=[ChatGeneration(message=AIMessage(content="확인했습니다."))]
        )


def build_graph(
    *,
    response_model: BaseChatModel | None = None,
    summary_model: BaseChatModel | None = None,
    trigger_tokens: int = 100,
    keep_messages: int = 2,
):
    return create_agent(
        model=response_model or DemoResponseModel(),
        tools=[],
        middleware=[
            SummarizationMiddleware(
                model=summary_model or DemoSummaryModel(),
                trigger=("tokens", trigger_tokens),
                keep=("messages", keep_messages),
            )
        ],
        checkpointer=InMemorySaver(),
        name="advanced_summarization_middleware",
    )


def build_openai_graph():
    """Use real models after configuring OPENAI_API_KEY in the environment."""
    return create_agent(
        model="openai:gpt-5",
        tools=[],
        middleware=[
            SummarizationMiddleware(
                model="openai:gpt-5-mini",
                trigger=("tokens", 4000),
                keep=("messages", 20),
            )
        ],
        checkpointer=InMemorySaver(),
        name="advanced_summarization_middleware_openai",
    )


graph = build_graph()


DEMO_TURNS = [
    "서울에서 3일 여행을 계획해요. 지하철을 주로 이용하고 싶어요. 첫날은 시내를 둘러볼게요.",
    "둘째 날은 박물관을 가고 싶어요. 지하철로 이동하는 동선을 생각해 주세요.",
    "셋째 날에는 강변을 산책하고 싶어요. 앞의 일정도 기억해 주세요.",
    "이제 전체 계획의 핵심을 간단히 말해 주세요.",
]


if __name__ == "__main__":
    if "--openai" in sys.argv:
        if not os.getenv("OPENAI_API_KEY"):
            raise SystemExit("OPENAI_API_KEY 환경변수가 필요합니다.")
        live_graph = build_openai_graph()
        live_config = {"configurable": {"thread_id": "summarization-openai-demo"}}
        print("질문을 입력하세요. 빈 줄이면 종료합니다.")
        while question := input("user> ").strip():
            result = live_graph.invoke(
                {"messages": [{"role": "user", "content": question}]},
                config=live_config,
            )
            print(f"agent> {result['messages'][-1].content}")
            print(f"stored_messages={len(result['messages'])}")
    else:
        summary_model = DemoSummaryModel()
        response_model = DemoResponseModel()
        demo = build_graph(summary_model=summary_model, response_model=response_model)
        config = {"configurable": {"thread_id": "summarization-demo"}}

        for turn, question in enumerate(DEMO_TURNS, 1):
            result = demo.invoke(
                {"messages": [{"role": "user", "content": question}]},
                config=config,
            )
            print(
                f"turn={turn} summary_calls={len(summary_model.prompts)} "
                f"stored_messages={len(result['messages'])}"
            )

        print(f"summary: {result['messages'][0].content}")
        print(f"latest user message: {response_model.contexts[-1][-1].content}")
