"""검색 도구를 사용하는 LangChain 에이전트 흐름을 보여주는 예제입니다. 도구와 모델을 묶어 에이전트 실행 단위를 구성합니다."""

from __future__ import annotations

from langchain_lecture.projects.project_02_search_agent.schemas import AgentResponse
from langchain_lecture.shared.models import get_chat_model


def build_search_agent(model=None, tools=None):
    from langchain.agents import create_agent
    from langchain_tavily import TavilySearch

    resolved_model = model or get_chat_model(temperature=0)
    resolved_tools = tools or [TavilySearch()]
    return create_agent(
        model=resolved_model,
        tools=resolved_tools,
        response_format=AgentResponse,
    )


def run_search_agent(query: str, model=None, tools=None):
    agent = build_search_agent(model=model, tools=tools)
    return agent.invoke({"messages": [{"role": "user", "content": query}]})

