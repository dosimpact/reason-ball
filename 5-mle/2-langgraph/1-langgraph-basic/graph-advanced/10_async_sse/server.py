"""FastAPI + SSE 토큰 스트리밍 서버."""
from __future__ import annotations

import json
import os
from typing import AsyncIterator

from fastapi import FastAPI, Query
from fastapi.responses import FileResponse
from langchain_core.messages import HumanMessage
from sse_starlette.sse import EventSourceResponse

from graph import graph

app = FastAPI()

_STATIC_INDEX = os.path.join(os.path.dirname(__file__), "static", "index.html")


@app.get("/")
def index():
    if os.path.exists(_STATIC_INDEX):
        return FileResponse(_STATIC_INDEX)
    return {"hint": "GET /stream?q=..."}


async def _token_iter(q: str) -> AsyncIterator[dict]:
    """astream(stream_mode='messages') 결과를 SSE 이벤트 dict 로 변환."""
    inputs = {"messages": [HumanMessage(content=q)]}
    try:
        async for chunk, meta in graph.astream(inputs, stream_mode="messages"):
            content = getattr(chunk, "content", None)
            # content 는 str 또는 list[dict] (Bedrock content blocks)
            text = ""
            if isinstance(content, str):
                text = content
            elif isinstance(content, list):
                for blk in content:
                    if isinstance(blk, dict) and blk.get("type") == "text":
                        text += blk.get("text", "")
            if not text:
                continue
            node = (meta or {}).get("langgraph_node", "?")
            yield {
                "event": "token",
                "data": json.dumps({"node": node, "text": text}, ensure_ascii=False),
            }
    except Exception as e:  # noqa: BLE001
        yield {"event": "error", "data": json.dumps({"message": str(e)})}
    yield {"event": "done", "data": "[DONE]"}


@app.get("/stream")
async def stream(q: str = Query(..., description="user message")):
    return EventSourceResponse(_token_iter(q))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
