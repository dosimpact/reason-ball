"""API fixture for the real Canvas graph's OpenUI model-input boundary."""

import json
from contextlib import asynccontextmanager

from fastapi_parity_app import app, validation_lifespan
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel

from domains.technical_analysis.presentation import canvas_item_errors
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

    def with_structured_output(self, schema):
        return self

    async def ainvoke(self, messages, config=None, **kwargs):
        CAPTURED.append(messages)
        context = json.loads(messages[1].content)["presentationContext"]
        nodes, statements = [], []
        for index, item in enumerate(context["canvasItems"]):
            query = f"chart{index}"
            args = {**context["chartQuery"], "instances": json.dumps(item["instances"])}
            statements.append(query + ' = Query("technical_analysis_chart", ' + json.dumps(args) + ', ' + json.dumps(context["chartFallback"]) + ')')
            nodes.append('CanvasItem(' + json.dumps(item["id"]) + ', ' + json.dumps(item["title"]) + ', [FinancialChart(' + query + ')])')
        return {"program": "root = Col([" + ",".join(nodes) + "], 4)\n" + "\n".join(statements)}


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
        "serverContextConstraints": all("Follow the server-supplied presentationContext constraints" in p for p in prompts),
        "modelOwnsCompleteProgram": all("complete OpenUI program" in p for p in prompts),
        "allowedScope": all("presentationContext" in p for p in prompts),
        "invalidQueryBlocked": bool(canvas_item_errors('root = CanvasItem("foreign", "", [])', {"saved:chart"})),
        "extraAssignmentBlocked": bool(canvas_item_errors('root = CanvasItem("saved:chart", "", [])\nother = CanvasItem("saved:chart", "", [])', {"saved:chart"})),
    }


app.router.lifespan_context = probe_lifespan
