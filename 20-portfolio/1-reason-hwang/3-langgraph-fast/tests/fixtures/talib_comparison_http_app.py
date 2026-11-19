"""Actual routers + TA-Lib workflow; comparison model/data are deterministic."""

from contextlib import asynccontextmanager

from langgraph.checkpoint.memory import InMemorySaver
from talib_http_app import app, runtime

from graph.primary_graphs.talib_agent.workflow import build_talib_agent
from server.assistants.repository import InMemoryAssistantRepository
from server.assistants.router import configure_graph_registry, set_assistant_repository
from server.graph_registry import GraphRegistry
from server.run_manager import RunManager
from tests.fixtures.openui_composition_model import CompositionModel
from tests.test_talib_comparison import (
    ComparisonAgent,
    no_followups,
    no_validation_errors,
)

agent = ComparisonAgent()


@asynccontextmanager
async def comparison_lifespan(application):
    runtime.reset()
    repository = InMemoryAssistantRepository()
    set_assistant_repository(repository)
    exported = build_talib_agent(
        model=CompositionModel(),
        agent=agent,
        validator=no_validation_errors,
        followups=no_followups,
    )
    graph = exported.builder.compile(checkpointer=InMemorySaver())
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


@app.get("/qa/comparison")
async def comparison_calls():
    return {"calls": agent.calls}


app.router.lifespan_context = comparison_lifespan
