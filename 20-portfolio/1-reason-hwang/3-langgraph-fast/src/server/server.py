import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from pydantic import BaseModel, Field

from domains.sec_modeling.store import GraphStore as SecModelingGraphStore
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
from server.generative_ui.router import router as generative_ui_router
from server.mcp import router as mcp_router
from server.openapi_contract import load_standard_openapi
from server.routers.sec_ixbrl import router as sec_ixbrl_router
from server.routers.sec_modeling import router as sec_modeling_router
from server.runs import router as runs_router
from server.runs import runtime as runs_runtime
from server.sec_chat.router import router as sec_chat_router
from server.sec_deep_agent.router import router as sec_deep_agent_router
from server.store import router as store_router
from server.store import set_store_repository
from server.streaming import router as streaming_router
from server.system import router as system_router
from server.technical_analysis.router import router as technical_analysis_router
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
    postgres: PostgresRuntime | None = None
    app.state.postgres = None
    try:
        settings = get_settings()
        runtime_mode = os.getenv("LANGGRAPH_RUNTIME_MODE", "memory")
        if runtime_mode not in {"memory", "postgres"}:
            raise RuntimeError("LANGGRAPH_RUNTIME_MODE must be memory or postgres")
        if runtime_mode == "postgres" and not settings.postgres_configured:
            raise RuntimeError("PostgreSQL runtime mode requires configured PostgreSQL; no memory fallback")
        graph_only = runtime_mode == "postgres" or os.getenv("FASTAPI_STARTUP_GRAPH_ONLY", "false").lower() in {"1", "true"}
        if settings.env_profile is not None and not graph_only:
            prepare_neo4j_schema(profile=settings.env_profile, settings=settings)
            modeling_graph = SecModelingGraphStore()
            try:
                modeling_graph.initialize()
            finally:
                modeling_graph.close()
        if settings.postgres_configured:
            postgres = PostgresRuntime(
                conninfo=settings.postgres_conninfo(),
                profile=settings.env_profile or "local",
                schema=settings.postgres_schema,
                initialize_schema=runtime_mode != "postgres",
            )
            await postgres.open()
            if settings.env_profile == "local" and not graph_only and os.getenv("FASTAPI_ENABLE_LEGACY_MIGRATION", "false").lower() == "true":
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
        from server.assistants.router import _repository, configure_graph_registry
        from server.graph_registry import GraphRegistry
        from server.run_manager import RunManager
        queue = None
        if runtime_mode == "postgres":
            assert postgres is not None
            from infrastructure.postgres.fenced_saver import FencedAsyncPostgresSaver
            from infrastructure.postgres.runtime_queue import RuntimeQueue
            queue = RuntimeQueue(postgres.pool,
                namespace=os.getenv("LANGGRAPH_RUNTIME_NAMESPACE", "fastapi"),
                max_active=int(os.getenv("LANGGRAPH_MAX_ACTIVE", "10")),
                max_queued=int(os.getenv("LANGGRAPH_MAX_QUEUED", "10")),
                lease_seconds=float(os.getenv("LANGGRAPH_LEASE_SECONDS", "30")))
            if queue.lease_seconds < 3:
                raise RuntimeError("Lease must be at least 3 seconds")
            await queue.verify()
            postgres.checkpointer = FencedAsyncPostgresSaver(postgres.pool, queue.guard_write)
            runs_runtime.set_checkpointer(postgres.checkpointer)
        registry = GraphRegistry(postgres.checkpointer if postgres else None)
        configure_graph_registry(registry.schemas())
        await registry.seed(_repository)
        if queue:
            from server.postgres_run_manager import PostgresRunManager
            runs_runtime.manager = PostgresRunManager(runs_runtime, registry, queue)
        else:
            runs_runtime.manager = RunManager(runs_runtime, registry)
        await runs_runtime.manager.recover()
        app.state.graph_registry = registry
        app.state.postgres = postgres
        yield
    finally:
        try:
            if runs_runtime.manager is not None:
                await runs_runtime.manager.close()
        finally:
            runs_runtime.manager = None
            set_assistant_repository(InMemoryAssistantRepository())
            runs_runtime.set_repositories()
            runs_runtime.set_checkpointer()
            set_cron_repository(None)
            set_store_repository(None)
            set_a2a_task_repository(None)
            if postgres is not None:
                await postgres.close()
            app.state.postgres = None


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
app.include_router(sec_modeling_router)
app.include_router(sec_ixbrl_router)
app.include_router(generative_ui_router)
app.include_router(sec_chat_router)
app.include_router(sec_deep_agent_router)
app.include_router(technical_analysis_router)


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


@app.middleware("http")
async def runtime_scope(request: Request, call_next):
    if getattr(runs_runtime.manager,"durable",False) and (
        request.url.path.startswith("/api/generative-ui/")
        or request.url.path in {"/api/sec-chat/prepare","/api/sec-chat/chat"}
        or request.url.path.startswith("/api/sec-chat/threads/")
    ):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=501,content={"detail":"This process-local session API requires a dedicated single-worker service; PostgreSQL multi-worker support covers assistants/threads/runs"})
    return await call_next(request)


@app.get("/health/runtime", include_in_schema=False)
async def runtime_health():
    manager=runs_runtime.manager
    if not getattr(manager,"durable",False):
        return {"mode":"memory","single_worker_only":True}
    try:
        metrics=await manager.queue.metrics()
    except Exception as error:
        from fastapi import HTTPException
        raise HTTPException(503,"Runtime database metrics unavailable") from error
    return {"mode":"postgres","executionVersion":manager.version,"listenerConnected":manager.listener_connected,"databaseUnavailable":manager.db_failed,**metrics}
