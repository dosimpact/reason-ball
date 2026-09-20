from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from pydantic import BaseModel, Field

from graph.primary_graphs.main_graph.workflow import run_graph
from infrastructure.neo4j import prepare_neo4j_schema
from infrastructure.postgres import PostgresRuntime
from infrastructure.postgres.a2a_task_repository import PostgresA2ATaskRepository
from infrastructure.postgres.assistant_repository import PostgresAssistantRepository
from infrastructure.postgres.cron_repository import PostgresCronRepository
from infrastructure.postgres.run_repository import PostgresRunRepository
from infrastructure.postgres.snapshot_migration import (
    drop_legacy_tables,
    run_snapshot_backfill,
)
from infrastructure.postgres.store_repository import PostgresStoreRepository
from infrastructure.postgres.thread_repository import PostgresThreadRepository
from server.a2a import router as a2a_router
from server.a2a import set_a2a_task_repository
from server.assistants import router as assistants_router
from server.assistants.repository import InMemoryAssistantRepository
from server.assistants.router import set_assistant_repository
from server.crons import router as crons_router
from server.crons import set_cron_repository
from server.execution import execution_gate
from server.mcp import router as mcp_router
from server.openapi_contract import load_standard_openapi
from server.routers.tenk import graph_router as tenk_graph_router
from server.routers.tenk import router as tenk_router
from server.runs import router as runs_router
from server.runs import runtime as runs_runtime
from server.store import router as store_router
from server.store import set_store_repository
from server.streaming import router as streaming_router
from server.system import router as system_router
from server.threads import router as threads_router
from settings import get_settings


class GraphRunRequest(BaseModel):
    message: str = Field(..., min_length=1)
    provider: str = Field(default="openai")


class GraphRunResponse(BaseModel):
    provider: str
    message: str
    response: str


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    postgres: PostgresRuntime | None = None
    if settings.env_profile is not None:
        prepare_neo4j_schema(profile=settings.env_profile, settings=settings)
    if settings.postgres_configured:
        postgres = PostgresRuntime(
            conninfo=settings.postgres_conninfo(),
            profile=settings.env_profile or "local",
        )
        await postgres.open()
        if settings.env_profile == "local":
            async with postgres.pool.connection() as connection:
                cursor = await connection.execute(
                    "SELECT to_regclass('langgraph_fast_resources') AS legacy_table"
                )
                legacy = await cursor.fetchone()
                legacy_exists = bool(legacy and legacy.get("legacy_table"))
                if legacy_exists:
                    await run_snapshot_backfill(connection)
                    await drop_legacy_tables(connection)

        set_assistant_repository(PostgresAssistantRepository(postgres.pool))
        runs_runtime.set_repositories(
            PostgresThreadRepository(postgres.pool),
            PostgresRunRepository(postgres.pool),
        )
        runs_runtime.set_checkpointer(postgres.checkpointer)
        set_cron_repository(PostgresCronRepository(postgres.pool))
        set_store_repository(PostgresStoreRepository(postgres.pool))
        set_a2a_task_repository(PostgresA2ATaskRepository(postgres.pool))
        await runs_runtime.hydrate()
    app.state.postgres = postgres
    try:
        yield
    finally:
        set_assistant_repository(InMemoryAssistantRepository())
        runs_runtime.set_repositories()
        runs_runtime.set_checkpointer()
        set_cron_repository(None)
        set_store_repository(None)
        set_a2a_task_repository(None)
        if postgres is not None:
            await postgres.close()


app = FastAPI(
    title="LangGraph Fast",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
    lifespan=lifespan,
)
app.include_router(assistants_router)
app.include_router(threads_router)
app.include_router(runs_router)
app.include_router(streaming_router)
app.include_router(crons_router)
app.include_router(store_router)
app.include_router(a2a_router)
app.include_router(mcp_router)
app.include_router(system_router)
app.include_router(tenk_router)
app.include_router(tenk_graph_router)


def standard_openapi() -> dict:
    return load_standard_openapi()


app.openapi = standard_openapi  # type: ignore[method-assign]


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/graph/run", response_model=GraphRunResponse)
async def graph_run(request: GraphRunRequest) -> GraphRunResponse:
    result = await execution_gate.run(
        run_graph(message=request.message, provider_name=request.provider)
    )
    return GraphRunResponse(**result)


@app.get("/health/postgres", include_in_schema=False)
async def postgres_health(request: Request) -> dict[str, bool]:
    runtime = getattr(request.app.state, "postgres", None)
    if runtime is None:
        return {"configured": False, "ready": False}
    async with runtime.pool.connection() as connection:
        await connection.execute("SELECT 1")
    return {"configured": True, "ready": True}
