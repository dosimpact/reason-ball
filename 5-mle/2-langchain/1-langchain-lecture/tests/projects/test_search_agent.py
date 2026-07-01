from __future__ import annotations

from langchain_lecture.projects.project_02_search_agent.schemas import (
    AgentResponse,
    Source,
)


def test_agent_response_schema():
    response = AgentResponse(
        answer="Use LangChain v1 agents.",
        sources=[Source(url="https://docs.langchain.com/")],
    )

    assert response.answer == "Use LangChain v1 agents."
    assert response.sources[0].url == "https://docs.langchain.com/"

