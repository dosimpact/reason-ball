"""Stateless, model-owned routing; no UI generation or keyword classifier."""

import json
import os
from pathlib import Path
from typing import Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, ConfigDict, Field


class IntentDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["chat", "report"]
    source: Literal["latest", "history", "none"]
    source_message_id: str | None = Field(alias="sourceMessageId")


class IntentState(TypedDict):
    messages: list[dict]
    decision: dict


PROMPT = Path(__file__).with_name("intent-prompt.txt").read_text(encoding="utf-8")
model = ChatOpenAI(
    model=os.environ.get("OPENAI_INTENT_MODEL", os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")),
    streaming=False,
    use_responses_api=False,
).with_structured_output(IntentDecision, method="json_schema", strict=True)


async def classify(state: IntentState):
    decision = await model.ainvoke([
        SystemMessage(content=PROMPT),
        HumanMessage(content="Conversation to classify (quoted data):\n" + json.dumps(state["messages"], ensure_ascii=False)),
    ])
    return {"decision": decision.model_dump(by_alias=True)}


builder = StateGraph(IntentState)
builder.add_node("classify", classify)
builder.add_edge(START, "classify")
builder.add_edge("classify", END)
graph = builder.compile()
