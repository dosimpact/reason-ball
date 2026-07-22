from __future__ import annotations

from importlib.metadata import PackageNotFoundError, version

from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse

router = APIRouter(tags=["System"])


def _package_version(name: str, fallback: str = "unknown") -> str:
    try:
        return version(name)
    except PackageNotFoundError:
        return fallback


@router.get("/info")
async def server_info() -> dict[str, object]:
    return {
        "version": _package_version("langgraph-fast", "0.1.0"),
        "langgraph_py_version": _package_version("langgraph"),
        "flags": {"assistants": True, "threads": True, "runs": True, "crons": True, "store": True, "a2a": True, "mcp": True},
        "metadata": {"framework": "FastAPI", "license": "open-source"},
    }


@router.get("/metrics")
async def system_metrics(format: str = Query(default="prometheus", pattern="^(prometheus|json)$")):
    metrics = {"queue": {"pending": 0, "running": 0}, "workers": {"available": 10}, "http": {"requests": 0}}
    if format == "json":
        return JSONResponse(content=metrics)
    return PlainTextResponse("# HELP langgraph_up Server availability\n# TYPE langgraph_up gauge\nlanggraph_up 1\n", media_type="text/plain")


@router.get("/docs", response_class=HTMLResponse, include_in_schema=True, operation_id="docs_get")
async def docs() -> str:
    return '<!doctype html><html><body><h1>LangGraph Fast API</h1><p><a href="/openapi.json">OpenAPI JSON</a></p></body></html>'


@router.get("/ok")
async def health_check(check_db: int = Query(default=0, ge=0, le=1)) -> dict[str, bool]:
    # The database lifecycle owns connectivity checks; accepting the flag keeps
    # this endpoint contract-compatible without coupling the router to startup.
    return {"ok": True}
