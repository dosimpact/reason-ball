"""Real routers/native functions; deterministic model/Yahoo and no UI validator HTTP."""

import json
from contextlib import asynccontextmanager

from fastapi import FastAPI
from langchain_core.messages import AIMessage
from langgraph.checkpoint.memory import InMemorySaver
from talib_http_app import prices

from domains.talib_agent.catalog import describe
from graph.primary_graphs.talib_agent.tools import build_tools
from graph.primary_graphs.talib_agent.workflow import build_talib_agent
from server.assistants import router as assistants_router
from server.assistants.repository import InMemoryAssistantRepository
from server.assistants.router import configure_graph_registry, set_assistant_repository
from server.graph_registry import GraphRegistry
from server.run_manager import RunManager
from server.runs import router as runs_router
from server.runs import runtime
from server.threads import router as threads_router
from tests.fixtures.openui_composition_model import CompositionModel

SUMMARIES = []


class EvidenceAgent:
    async def ainvoke(self, state):
        tools = {tool.name: tool for tool in build_tools(fetcher=prices)}
        local = dict(state)
        messages = []
        requests = [
            {"id": name.lower(), "function": name} for name in ("SQZMOM", "OBV", "AD")
        ]
        requests.append(
            {
                "id": "signed-roc",
                "function": "ROC",
                "parameters": {"timeperiod": 1},
                "inputs": {
                    "price": {
                        "values": [-2, -1, 1, 2],
                        "dates": [
                            "2026-01-01",
                            "2026-01-02",
                            "2026-01-03",
                            "2026-01-04",
                        ],
                    }
                },
            }
        )
        for name, args in (
            ("get_price_ohlcv", {"ticker": "AAPL", "count": 60}),
            ("run_talib_functions", {"requests": requests}),
        ):
            result = await tools[name].ainvoke(
                {
                    "type": "tool_call",
                    "id": name,
                    "name": name,
                    "args": {**args, "state": local},
                }
            )
            update = result.update
            messages.extend(update["messages"])
            if name == "run_talib_functions":
                SUMMARIES.append(json.loads(update["messages"][-1].content))
            local.update(
                {key: value for key, value in update.items() if key != "messages"}
            )
        return {
            **local,
            "messages": [
                *messages,
                AIMessage(content="검증된 시계열 근거와 명시적 입력 제약"),
            ],
        }


async def validate(program):
    return []


async def follows(*args):
    return {"followUps": [], "followUpsStatus": "ready"}


@asynccontextmanager
async def lifespan(app):
    runtime.reset()
    SUMMARIES.clear()
    repository = InMemoryAssistantRepository()
    set_assistant_repository(repository)
    graph = build_talib_agent(
        model=CompositionModel(),
        agent=EvidenceAgent(),
        validator=validate,
        followups=follows,
    ).builder.compile(checkpointer=InMemorySaver())
    registry = GraphRegistry(graphs={"talib_agent": graph})
    configure_graph_registry(registry.schemas())
    await registry.seed(repository)
    runtime.manager = RunManager(runtime, registry)
    try:
        yield
    finally:
        await runtime.manager.close()
        runtime.manager = None
        runtime.reset()


app = FastAPI(lifespan=lifespan)
for router in (assistants_router, threads_router, runs_router):
    app.include_router(router)


@app.get("/qa/evidence")
async def evidence():
    return {"sqzmom": describe("SQZMOM"), "summaries": SUMMARIES}
