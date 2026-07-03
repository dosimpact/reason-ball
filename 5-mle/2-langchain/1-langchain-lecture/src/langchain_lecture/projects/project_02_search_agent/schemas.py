"""검색 도구를 사용하는 LangChain 에이전트 흐름을 보여주는 예제입니다. LLM 출력과 내부 데이터의 구조를 Pydantic 모델로 정의합니다."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Source(BaseModel):
    url: str = Field(description="The URL of the source.")


class AgentResponse(BaseModel):
    answer: str = Field(description="The agent answer.")
    sources: list[Source] = Field(
        default_factory=list,
        description="Sources used to generate the answer.",
    )

