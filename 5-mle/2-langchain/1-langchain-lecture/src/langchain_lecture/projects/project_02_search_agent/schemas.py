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

