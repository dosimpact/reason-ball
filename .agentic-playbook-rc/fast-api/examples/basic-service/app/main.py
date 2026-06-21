import asyncio
import logging
import time
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request, Response, status
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, Info, generate_latest
from pydantic import BaseModel, Field

from app.logging_config import configure_logging

configure_logging()
logger = logging.getLogger("fastapi-basic-service")

REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status_code"],
)
REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "path"],
)
IN_PROGRESS = Gauge(
    "http_requests_in_progress",
    "In-progress HTTP requests",
    ["method", "path"],
)
SERVICE_INFO = Info("service", "Service metadata")
SERVICE_INFO.info({"name": "fastapi-basic-service", "version": "0.1.0"})


class ItemCreate(BaseModel):
    name: str = Field(min_length=1, examples=["keyboard"])
    price: float = Field(gt=0, examples=[99000])


class Item(BaseModel):
    id: int
    name: str
    price: float


items: dict[int, Item] = {
    1: Item(id=1, name="keyboard", price=99000),
    2: Item(id=2, name="mouse", price=39000),
}

app = FastAPI(
    title="FastAPI Basic Service",
    version="0.1.0",
    description="REST, async, metrics, logging, and Docker example.",
)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next) -> Response:
    request_id = request.headers.get("X-Request-ID", str(uuid4()))
    path = request.scope.get("route").path if request.scope.get("route") else request.url.path
    method = request.method
    start = time.perf_counter()

    IN_PROGRESS.labels(method=method, path=path).inc()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.exception(
            "request failed",
            extra={
                "request_id": request_id,
                "method": method,
                "path": path,
                "status_code": 500,
                "duration_ms": duration_ms,
            },
        )
        REQUEST_COUNT.labels(method=method, path=path, status_code="500").inc()
        REQUEST_LATENCY.labels(method=method, path=path).observe(duration_ms / 1000)
        raise
    finally:
        IN_PROGRESS.labels(method=method, path=path).dec()

    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    REQUEST_COUNT.labels(method=method, path=path, status_code=str(response.status_code)).inc()
    REQUEST_LATENCY.labels(method=method, path=path).observe(duration_ms / 1000)
    logger.info(
        "request completed",
        extra={
            "request_id": request_id,
            "method": method,
            "path": path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        },
    )
    return response


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/items", response_model=list[Item])
async def list_items() -> list[Item]:
    return list(items.values())


@app.post("/items", response_model=Item, status_code=status.HTTP_201_CREATED)
async def create_item(payload: ItemCreate) -> Item:
    item_id = max(items) + 1 if items else 1
    item = Item(id=item_id, **payload.model_dump())
    items[item_id] = item
    return item


@app.get("/items/{item_id}", response_model=Item)
async def get_item(item_id: int) -> Item:
    item = items.get(item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="item not found")
    return item


@app.get("/async-wait")
async def async_wait(seconds: float = 1.0) -> dict[str, float | str]:
    await asyncio.sleep(seconds)
    return {"mode": "non-blocking", "waited_seconds": seconds}


@app.get("/metrics", include_in_schema=False)
async def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
