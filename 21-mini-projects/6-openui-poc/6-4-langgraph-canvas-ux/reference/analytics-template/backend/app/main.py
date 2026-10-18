import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.config import get_settings
from app.graph import run_graph
from app.schemas import ChatStreamRequest


settings = get_settings()

app = FastAPI(title="Analytics Template LangGraph Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _jsonable(payload: Any) -> Any:
    if hasattr(payload, "model_dump"):
        return payload.model_dump(mode="json")
    return payload


def _sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(_jsonable(data), ensure_ascii=False)}\n\n"


def _chunk_text(text: str, chunk_size: int = 36) -> list[str]:
    if not text:
        return []
    words = text.split(" ")
    chunks: list[str] = []
    current = ""
    for word in words:
        next_value = f"{current} {word}".strip()
        if len(next_value) >= chunk_size and current:
            chunks.append(current + " ")
            current = word
        else:
            current = next_value
    if current:
        chunks.append(current)
    return chunks


@app.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/api/chat/stream")
async def chat_stream(request: ChatStreamRequest) -> StreamingResponse:
    async def stream() -> AsyncIterator[str]:
        try:
            result = await run_graph(request)

            for tool_call in result.tool_calls:
                yield _sse("tool_call", tool_call)

            for delta in _chunk_text(result.message):
                yield _sse("message_delta", {"delta": delta})

            for artifact in result.artifacts:
                yield _sse("artifact", artifact)

            if result.canvas_patch and result.canvas_patch.components:
                yield _sse("canvas_patch", result.canvas_patch)

            yield _sse("done", {"threadId": request.threadId})
        except Exception:
            yield _sse(
                "error",
                {"message": "The LangGraph backend could not generate a response."},
            )

    return StreamingResponse(stream(), media_type="text/event-stream")
