"""FastAPI routes implementing the LangGraph Assistants contract."""

import inspect
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from server.assistants.models import (
    Assistant,
    AssistantCountRequest,
    AssistantCreate,
    AssistantPatch,
    AssistantSearchRequest,
    AssistantVersionsSearchRequest,
    GraphSchema,
    GraphSchemaNoId,
)
from server.assistants.repository import (
    AssistantAlreadyExistsError,
    AssistantNotFoundError,
    AssistantVersionNotFoundError,
    InMemoryAssistantRepository,
)

router = APIRouter(tags=["Assistants"])

_repository: Any = InMemoryAssistantRepository()
_graph_schemas: dict[str, GraphSchemaNoId] = {
    graph_id: GraphSchemaNoId(
        input_schema={"type": "object"},
        output_schema={"type": "object"},
        state_schema={"type": "object"},
        config_schema={"type": "object"},
        context_schema={"type": "object"},
    )
    for graph_id in ("main_graph", "tenk_subgraph", "starter_graph")
}
_subgraphs: dict[str, dict[str, GraphSchemaNoId]] = {
    "main_graph": {
        "tenk_subgraph": _graph_schemas["tenk_subgraph"],
        "starter_graph": _graph_schemas["starter_graph"],
    },
    "tenk_subgraph": {},
    "starter_graph": {},
}


def set_assistant_repository(repository: Any) -> None:
    """Replace assistant metadata storage (primarily for durable adapters/tests)."""

    global _repository
    _repository = repository


def export_state() -> dict[str, object]:
    exporter = getattr(_repository, "export_state", None)
    return exporter() if exporter is not None else {}


def import_state(state: dict[str, object]) -> None:
    importer = getattr(_repository, "import_state", None)
    if importer is not None:
        importer(state)


async def _invoke(method: str, *args: Any, **kwargs: Any) -> Any:
    result = getattr(_repository, method)(*args, **kwargs)
    return await result if inspect.isawaitable(result) else result


def configure_graph_registry(
    schemas: dict[str, GraphSchemaNoId],
    subgraphs: dict[str, dict[str, GraphSchemaNoId]] | None = None,
) -> None:
    """Inject graph schemas discovered from the application's graph registry."""

    global _graph_schemas, _subgraphs
    _graph_schemas = schemas
    _subgraphs = subgraphs or {graph_id: {} for graph_id in schemas}


def _not_found(message: str) -> HTTPException:
    return HTTPException(status_code=404, detail=message)


async def _assistant_or_graph(identifier: str) -> tuple[str, Assistant | None]:
    try:
        assistant = await _invoke("get", UUID(identifier))
        return assistant.graph_id, assistant
    except (ValueError, AssistantNotFoundError):
        if identifier in _graph_schemas:
            return identifier, None
        raise _not_found(f"Assistant or graph '{identifier}' not found") from None


@router.post("/assistants", response_model=Assistant)
async def create_assistant(payload: AssistantCreate) -> Assistant:
    if payload.graph_id not in _graph_schemas:
        raise _not_found(f"Graph '{payload.graph_id}' not found")
    try:
        return await _invoke("create", payload)
    except AssistantAlreadyExistsError as exc:
        raise HTTPException(status_code=409, detail="Assistant already exists") from exc


@router.post("/assistants/search", response_model=list[dict[str, Any]])
async def search_assistants(payload: AssistantSearchRequest) -> list[dict]:
    return await _invoke("search", payload)


@router.post("/assistants/count", response_model=int)
async def count_assistants(payload: AssistantCountRequest) -> int:
    return await _invoke("count", payload)


@router.get("/assistants/{assistant_id}", response_model=Assistant)
async def get_assistant(assistant_id: UUID) -> Assistant:
    try:
        return await _invoke("get", assistant_id)
    except AssistantNotFoundError as exc:
        raise _not_found("Assistant not found") from exc


@router.delete("/assistants/{assistant_id}", response_model=None)
async def delete_assistant(
    assistant_id: UUID,
    delete_threads: Annotated[bool, Query()] = False,
) -> None:
    # Compatibility parameter only. Checkpoint and checkpoint-write/blob rows are
    # intentionally retained by policy; this repository cannot access them.
    try:
        await _invoke("delete", assistant_id, delete_threads=delete_threads)
    except AssistantNotFoundError as exc:
        raise _not_found("Assistant not found") from exc


@router.patch("/assistants/{assistant_id}", response_model=Assistant)
async def patch_assistant(assistant_id: UUID, payload: AssistantPatch) -> Assistant:
    if payload.graph_id is not None and payload.graph_id not in _graph_schemas:
        raise _not_found(f"Graph '{payload.graph_id}' not found")
    try:
        return await _invoke("patch", assistant_id, payload)
    except AssistantNotFoundError as exc:
        raise _not_found("Assistant not found") from exc


@router.get("/assistants/{assistant_id}/graph")
async def get_assistant_graph(
    assistant_id: str,
    xray: Annotated[bool | int, Query()] = False,
) -> dict[str, list[dict[str, Any]]]:
    graph_id, _ = await _assistant_or_graph(assistant_id)
    nodes = [{"id": graph_id, "type": "graph"}]
    if xray:
        nodes.extend(
            {"id": namespace, "type": "subgraph"}
            for namespace in _subgraphs.get(graph_id, {})
        )
    return {"nodes": nodes, "edges": []}


@router.get("/assistants/{assistant_id}/subgraphs")
async def get_assistant_subgraphs(
    assistant_id: UUID,
    recurse: Annotated[bool, Query()] = False,
) -> dict[str, GraphSchemaNoId]:
    del recurse
    try:
        graph_id = (await _invoke("get", assistant_id)).graph_id
    except AssistantNotFoundError as exc:
        raise _not_found("Assistant not found") from exc
    return _subgraphs.get(graph_id, {})


@router.get("/assistants/{assistant_id}/subgraphs/{namespace}")
async def get_assistant_subgraphs_by_namespace(
    assistant_id: UUID,
    namespace: str,
    recurse: Annotated[bool, Query()] = False,
) -> dict[str, GraphSchemaNoId]:
    del recurse
    try:
        graph_id = (await _invoke("get", assistant_id)).graph_id
    except AssistantNotFoundError:
        return {}
    schema = _subgraphs.get(graph_id, {}).get(namespace)
    return {namespace: schema} if schema else {}


@router.get("/assistants/{assistant_id}/schemas", response_model=GraphSchema)
async def get_assistant_schemas(assistant_id: UUID) -> GraphSchema:
    try:
        graph_id = (await _invoke("get", assistant_id)).graph_id
    except AssistantNotFoundError as exc:
        raise _not_found("Assistant not found") from exc
    schema = _graph_schemas.get(graph_id)
    if schema is None:
        raise _not_found("Graph not found")
    return GraphSchema(graph_id=graph_id, **schema.model_dump())


@router.post("/assistants/{assistant_id}/versions", response_model=list[Assistant])
async def get_assistant_versions(
    assistant_id: UUID,
) -> list[Assistant]:
    return await _invoke(
        "versions",
        assistant_id, AssistantVersionsSearchRequest()
    )


@router.post("/assistants/{assistant_id}/latest", response_model=Assistant)
async def set_latest_assistant_version(
    assistant_id: UUID,
    version: Annotated[int, Query()],
) -> Assistant:
    try:
        return await _invoke("set_latest", assistant_id, version)
    except AssistantNotFoundError as exc:
        raise _not_found("Assistant not found") from exc
    except AssistantVersionNotFoundError as exc:
        raise _not_found("Assistant version not found") from exc
