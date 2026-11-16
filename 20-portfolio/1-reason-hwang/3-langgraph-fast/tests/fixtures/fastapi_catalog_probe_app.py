"""API fixture for the real Canvas graph's OpenUI model-input boundary."""

from contextlib import asynccontextmanager

from fastapi_parity_app import app, validation_lifespan
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessageChunk

from domains.technical_analysis.canvas import layout_errors
from graph.primary_graphs.technical_analysis_canvas_agent.workflow import (
    build_technical_analysis_canvas_agent,
)
from graph.subgraphs.openui_output.catalog import load_openui_catalog
from graph.subgraphs.openui_output.workflow import validate_program
from tests.test_technical_analysis_agent import fixture_fetcher

CAPTURED = []


class CatalogSpy(FakeMessagesListChatModel):
    def bind_tools(self, *args, **kwargs):
        return self

    async def astream(self, messages, config=None, **kwargs):
        CAPTURED.append(messages)
        yield AIMessageChunk(
            content='taLayout = Grid([taPanel, Markdown("검증된 지표 설명"), taSignals], 2, 320, 4)'
        )


@asynccontextmanager
async def probe_lifespan(application):
    async with validation_lifespan(application):
        registry = application.state.graph_registry
        graph = build_technical_analysis_canvas_agent(
            model=CatalogSpy(responses=[]),
            fetcher=fixture_fetcher,
            validator=validate_program,
        )
        registry.graphs["technical_analysis_canvas_agent"] = graph.builder.compile(
            checkpointer=registry.checkpointer
        )
        from server.assistants.router import configure_graph_registry

        configure_graph_registry(registry.schemas())
        yield


@app.get("/qa/catalog-probe")
async def capture_status():
    catalog = load_openui_catalog()
    prompts = [messages[0].content for messages in CAPTURED]
    return {
        "calls": len(prompts),
        "latestCatalogExactPrefix": all(p.startswith(catalog) for p in prompts),
        "IndicatorControls": all("IndicatorControls(" in p for p in prompts),
        "catalogQuery": all("technical_analysis_catalog" in p for p in prompts),
        "scopeAfterCatalog": all(
            p.index("TA CANVAS SCOPE") >= len(catalog) for p in prompts
        ),
        "serverOwnsRootQuery": all(
            "server owns the prefix, Query, IndicatorControls, data and final root" in p
            for p in prompts
        ),
        "allowedScope": all(
            "Use only Col/Row/Grid/Text/Title/Markdown" in p for p in prompts
        ),
        "invalidQueryBlocked": bool(
            layout_errors('taLayout = Col([taPanel, Query("x",{}), taSignals], 4)')
        ),
        "extraAssignmentBlocked": bool(
            layout_errors("taLayout = Col([taPanel, taSignals], 4)\nsnapshot = {}")
        ),
    }


app.router.lifespan_context = probe_lifespan
