"""Owned HTTP validation app: production lifespan plus a deterministic compiled graph.

Never use this module as a production entry point. It deliberately adds one QA graph.
"""

import asyncio
import os
from contextlib import asynccontextmanager
from typing import Annotated, TypedDict

from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

from server.server import app
from server.server import lifespan as production_lifespan


class FixtureState(TypedDict, total=False):
    messages: Annotated[list, add_messages]
    action: str
    delay: float
    completed: int


async def prepare(state: FixtureState):
    get_stream_writer()({"phase": "started", "action": state.get("action", "ok")})
    return {
        "messages": [
            AIMessage(
                content="",
                id="fixture-tool-owner",
                tool_calls=[
                    {
                        "name": "fixture_read_only",
                        "args": {},
                        "id": "fixture-tool",
                        "type": "tool_call",
                    }
                ],
            ),
            ToolMessage(
                content="fixture safe result",
                tool_call_id="fixture-tool",
                id="fixture-tool-result",
            ),
        ]
    }


async def complete(state: FixtureState):
    await asyncio.sleep(min(max(float(state.get("delay", 0.2)), 0), 15))
    if state.get("action") == "error":
        raise ValueError("Intentional parity fixture error")
    model = GenericFakeChatModel(
        messages=iter([AIMessage(content="fixture streamed answer")])
    )
    answer = await model.ainvoke([HumanMessage(content="fixture")])
    get_stream_writer()({"phase": "completed"})
    return {"messages": [answer], "completed": state.get("completed", 0) + 1}


@asynccontextmanager
async def validation_lifespan(application):
    async with production_lifespan(application):
        registry = application.state.graph_registry
        builder = StateGraph(FixtureState)
        nested = StateGraph(FixtureState)
        nested.add_node("tool", prepare)
        nested.add_edge(START, "tool")
        nested.add_edge("tool", END)
        builder.add_node("prepare", nested.compile())
        builder.add_node("complete", complete)
        builder.add_edge(START, "prepare")
        builder.add_edge("prepare", "complete")
        builder.add_edge("complete", END)
        registry.graphs["qa_parity_graph"] = builder.compile(
            checkpointer=registry.checkpointer
        )
        from server.assistants.router import _repository, configure_graph_registry

        configure_graph_registry(registry.schemas())
        await registry.seed(_repository)
        yield


MODEL_GUARD = {"enabled": os.getenv("QA_FORBID_MODEL_REQUESTS") == "true", "calls": 0}
if MODEL_GUARD["enabled"]:
    from langchain_core.language_models.chat_models import BaseChatModel

    def forbidden_model(*args, **kwargs):
        MODEL_GUARD["calls"] += 1
        raise RuntimeError("QA model-free chart guard: model invocation forbidden")

    async def forbidden_async_model(*args, **kwargs):
        forbidden_model()

    async def forbidden_async_stream(*args, **kwargs):
        forbidden_model()
        yield  # Preserve the async iterator protocol without permitting a call.

    BaseChatModel.invoke = forbidden_model
    BaseChatModel.stream = forbidden_model
    BaseChatModel.ainvoke = forbidden_async_model
    BaseChatModel.astream = forbidden_async_stream


@app.get("/qa/model-guard")
async def model_guard_status():
    return MODEL_GUARD


app.router.lifespan_context = validation_lifespan
