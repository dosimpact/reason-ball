"""Official app initialization with deterministic graphs registered BEFORE dispatch.

Only graph/model/tool boundaries are fixtures. Registry seeding, manager, queue,
leases, saver, routes and SSE remain production implementations.
"""

from __future__ import annotations

import asyncio
import os
from typing import Annotated, TypedDict

import psycopg
from langchain_core.language_models.fake_chat_models import (
    FakeMessagesListChatModel,
    GenericFakeChatModel,
)
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, ToolMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

from server import graph_registry as registry_module
from settings import AppSettings


class FixtureState(TypedDict, total=False):
    messages: Annotated[list, add_messages]
    marker: str
    delay: float
    mode: str
    events: int
    bytes_per_event: int
    completed: int
    pid: int


async def effect(marker, phase):
    settings = AppSettings.from_env()
    async with await psycopg.AsyncConnection.connect(
        settings.postgres_conninfo()
    ) as conn:
        await conn.execute(f'SET search_path TO "{settings.postgres_schema}"')
        await conn.execute(
            "INSERT INTO qa_effects(marker,phase,pid) VALUES(%s,%s,%s)",
            (marker, phase, os.getpid()),
        )


async def prepare(state: FixtureState):
    marker = state.get("marker", "fixture")
    await effect(marker, "started")
    get_stream_writer()({"phase": "started", "marker": marker, "pid": os.getpid()})
    return {
        "pid": os.getpid(),
        "messages": [
            AIMessage(
                content="",
                id=marker + "-owner",
                tool_calls=[
                    {
                        "name": "read_fixture",
                        "args": {},
                        "id": marker + "-tool",
                        "type": "tool_call",
                    }
                ],
            ),
            ToolMessage(
                content="safe fixture result",
                tool_call_id=marker + "-tool",
                id=marker + "-result",
            ),
        ],
    }


async def complete(state: FixtureState):
    await asyncio.sleep(min(max(float(state.get("delay", 0.05)), 0), 60))
    if state.get("mode") == "error":
        raise ValueError("Intentional fixture error")
    writer = get_stream_writer()
    for index in range(min(state.get("events", 0), 400)):
        writer(
            {
                "index": index,
                "marker": state.get("marker"),
                "padding": "x" * min(state.get("bytes_per_event", 0), 1024 * 1024),
            }
        )
    model = GenericFakeChatModel(
        messages=iter([AIMessage(content="fixture streamed answer")])
    )
    answer = await model.ainvoke([HumanMessage(content="fixture")])
    await effect(state.get("marker", "fixture"), "completed")
    writer({"phase": "completed", "marker": state.get("marker")})
    return {"messages": [answer], "completed": state.get("completed", 0) + 1}


CANVAS_CALLS = []


class CanvasSpy(FakeMessagesListChatModel):
    def bind_tools(self, *args, **kwargs):
        return self

    async def astream(self, messages, config=None, **kwargs):
        CANVAS_CALLS.append(messages)
        yield AIMessageChunk(
            content='taLayout = Col([Markdown("고정 fixture의 검증된 지표 설명"), taPanel, taSignals], 4)'
        )


class FixtureRegistry(registry_module.GraphRegistry):
    def __init__(self, checkpointer=None, graphs=None):
        super().__init__(checkpointer, graphs)
        nested = StateGraph(FixtureState)
        nested.add_node("read", prepare)
        nested.add_edge(START, "read")
        nested.add_edge("read", END)
        builder = StateGraph(FixtureState)
        builder.add_node("prepare", nested.compile())
        builder.add_node("complete", complete)
        builder.add_edge(START, "prepare")
        builder.add_edge("prepare", "complete")
        builder.add_edge("complete", END)
        self.graphs["qa_read_graph"] = builder.compile(checkpointer=self.checkpointer)
        self.graphs["qa_effect_graph"] = builder.compile(checkpointer=self.checkpointer)
        self.read_only_graphs = set(getattr(self, "read_only_graphs", ())) | {
            "qa_read_graph"
        }
        from graph.primary_graphs.technical_analysis_canvas_agent.workflow import (
            build_technical_analysis_canvas_agent,
        )
        from graph.subgraphs.openui_output.workflow import validate_program
        from tests.test_technical_analysis_agent import fixture_fetcher

        canvas = build_technical_analysis_canvas_agent(
            model=CanvasSpy(responses=[]),
            fetcher=fixture_fetcher,
            validator=validate_program,
        )
        self.graphs["technical_analysis_canvas_agent"] = canvas.builder.compile(
            checkpointer=self.checkpointer
        )


registry_module.GraphRegistry = FixtureRegistry

from server import server as server_module

app = server_module.app


@app.get("/qa/runtime")
async def runtime_identity():
    from server.runs.runtime import runtime

    manager = runtime.manager
    return {
        "pid": os.getpid(),
        "manager": type(manager).__name__,
        "owner": getattr(manager, "owner_id", None),
        "namespace": getattr(getattr(manager, "queue", None), "namespace", None),
    }


@app.get("/qa/canvas-model")
async def canvas_model_calls():
    return {"calls": len(CANVAS_CALLS)}
