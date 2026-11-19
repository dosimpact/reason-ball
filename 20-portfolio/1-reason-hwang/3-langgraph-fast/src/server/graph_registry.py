"""One allowlisted graph catalog shared with langgraph dev; no request code loading."""
from __future__ import annotations

import importlib
import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from fastapi import HTTPException
from langgraph.checkpoint.memory import InMemorySaver

from server.assistants.models import AssistantCreate, GraphSchemaNoId


class GraphRegistry:
    # Unknown/new graphs fail safe: interruption may require manual review.
    read_only_graphs=frozenset({'main_graph','simple_llm','technical_analysis_graph','price_agent','starter_graph','technical_analysis_agent','technical_analysis_canvas_agent'})
    def __init__(self, checkpointer=None, graphs=None):
        self.checkpointer = checkpointer or InMemorySaver()
        self.graphs = {}
        if graphs is not None:
            self.graphs = graphs
            return
        catalog = json.loads((Path(__file__).resolve().parents[2] / "langgraph.json").read_text())
        for graph_id, target in catalog["graphs"].items():
            path, symbol = target.split(":", 1)
            module = path.removeprefix("./src/").removesuffix(".py").replace("/", ".")
            exported = getattr(importlib.import_module(module), symbol)
            # Recompile the same StateGraph builder, preserving dev's exported graph.
            self.graphs[graph_id] = exported.builder.compile(
                checkpointer=self.checkpointer, name=exported.name
            )

    def get(self, graph_id):
        if graph_id not in self.graphs:
            raise HTTPException(404, "Graph not found")
        return self.graphs[graph_id]

    def schemas(self):
        return {key: GraphSchemaNoId(
            input_schema=graph.get_input_jsonschema(),
            output_schema=graph.get_output_jsonschema(),
            state_schema=graph.get_output_jsonschema(),
            config_schema=graph.config_schema().model_json_schema(),
        ) for key, graph in self.graphs.items()}

    async def seed(self, repository):
        import inspect
        for key in self.graphs:
            payload = AssistantCreate(
                assistant_id=uuid5(NAMESPACE_URL, "reason-hwang:fastapi:" + key),
                graph_id=key, name=key, if_exists="do_nothing",
                metadata={"default_graph": True},
            )
            try:
                result = repository.create(payload)
                if inspect.isawaitable(result):
                    await result
            except Exception as error:
                from psycopg.errors import UniqueViolation
                if not isinstance(error, UniqueViolation):
                    raise
                # Concurrent worker startup may race on the same deterministic
                # default ID. Verify the winner rather than fail the second boot.
                existing = repository.get(payload.assistant_id)
                if inspect.isawaitable(existing):
                    existing = await existing
                if existing.graph_id != key:
                    raise RuntimeError("Default assistant identity conflict") from error

    async def resolve(self, identifier):
        from server.assistants.router import _assistant_or_graph
        graph_id, assistant = await _assistant_or_graph(identifier)
        return self.get(graph_id), graph_id, assistant
