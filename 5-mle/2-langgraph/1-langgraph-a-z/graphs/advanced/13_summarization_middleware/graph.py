"""Demonstrate automatic conversation compaction before an agent model call.

쉽게 이해하기
-------------
대화 요약은 오래된 대화를 짧게 줄여 다음 모델 호출의 입력을 관리하는 방법이다.
예: 긴 여행 상담을 요약하고 최근 질문은 그대로 남긴다.
SummarizationMiddleware가 정한 조건에 도달하면 모델 호출 전에 요약을 수행한다.

그래프 구조
-----------
대화가 임계값에 도달하면 모델 호출 전에 오래된 내용을 요약하고, 요약과 남은 메시지로 응답을 생성한다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "서울에서 3일 여행을 계획해요. 지하철을 이용할게요."
    }
  ]
}
```
관찰할 결과: 같은 thread에 DEMO_TURNS를 차례대로 보내 요약 호출과 보존되는 메시지를 확인합니다.

실행 조건·방법:
기본은 API 키 없는 데모 모델입니다. Python은 build_graph()와 config의 thread_id를 사용합니다. 서버 graph는 platform persistence를 사용합니다. 실제 모델 모드는 main의 --openai 조건을 따릅니다.
"""

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
        self, messages: list[BaseMessage], stop: list[str] | None = None,
        run_manager: Any | None = None, **kwargs: Any
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
        self, messages: list[BaseMessage], stop: list[str] | None = None,
        run_manager: Any | None = None, **kwargs: Any
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
    platform: bool = False,
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
        checkpointer=None if platform else InMemorySaver(),
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


graph = build_graph(platform=True)


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
