"""Actual runtime, graphs, native calculations and Host parser; no paid model/Yahoo."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from langgraph.checkpoint.memory import InMemorySaver

from graph.primary_graphs.talib_agent.workflow import build_talib_agent
from graph.primary_graphs.technical_analysis_agent.workflow import (
    build_technical_analysis_agent,
)
from graph.primary_graphs.technical_analysis_canvas_agent.workflow import (
    build_technical_analysis_canvas_agent,
)
from server.assistants import router as assistants_router
from server.assistants.repository import InMemoryAssistantRepository
from server.assistants.router import configure_graph_registry, set_assistant_repository
from server.graph_registry import GraphRegistry
from server.run_manager import RunManager
from server.runs import router as runs_router
from server.runs import runtime
from server.streaming import router as streaming_router
from server.technical_analysis import router as chart_module
from server.threads import router as threads_router
from tests.fixtures.openui_composition_model import CompositionModel
from tests.fixtures.talib_http_app import ScriptedAgent, fixed_followups
from tests.test_technical_analysis_agent import fixture_fetcher

MODELS = {}


class UnusedBusinessAgent:
    async def ainvoke(self, state):
        raise AssertionError("Use the structured fixture request for TA/Canvas")


@asynccontextmanager
async def lifespan(app):
    runtime.reset()
    MODELS.clear()
    repository = InMemoryAssistantRepository()
    set_assistant_repository(repository)
    graphs = {}
    for name, builder in (
        ("talib_agent", build_talib_agent),
        ("technical_analysis_agent", build_technical_analysis_agent),
        ("technical_analysis_canvas_agent", build_technical_analysis_canvas_agent),
    ):
        for failure in (False, True):
            identifier = name + ("_failure" if failure else "")
            model = CompositionModel(failure=failure)
            MODELS[identifier] = model
            kwargs = {
                "model": model,
                "fetcher": fixture_fetcher,
                "agent": ScriptedAgent()
                if name == "talib_agent"
                else UnusedBusinessAgent(),
            }
            if name == "talib_agent":
                kwargs["followups"] = fixed_followups
            graphs[identifier] = builder(**kwargs).builder.compile(
                checkpointer=InMemorySaver()
            )
    registry = GraphRegistry(graphs=graphs)
    configure_graph_registry(registry.schemas())
    await registry.seed(repository)
    runtime.manager = RunManager(runtime, registry)
    original_fetcher = chart_module.fetch_historical_prices
    chart_module.fetch_historical_prices = fixture_fetcher
    try:
        yield
    finally:
        chart_module.fetch_historical_prices = original_fetcher
        await runtime.manager.close()
        runtime.manager = None
        runtime.reset()


app = FastAPI(lifespan=lifespan)
for router in (
    assistants_router,
    threads_router,
    runs_router,
    streaming_router,
    chart_module.router,
):
    app.include_router(router)


@app.get("/qa/composition")
async def composition_calls():
    return {
        key: {
            "calls": len(model.calls),
            "contexts": [call["presentationContext"] for call in model.calls],
        }
        for key, model in MODELS.items()
    }
