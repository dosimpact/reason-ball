"""FastAPI 서버 — webhook 으로 외부 결과 수신 후 그래프 재개.

엔드포인트
----------
- POST /chat                    : {thread_id, message} → 그래프 시작 (interrupt 시 status=waiting)
- POST /webhook/{thread_id}     : 외부 시스템 callback. body 가 그대로 Command(resume=...) 로 사용됨
- GET  /chat/{thread_id}        : 마지막 상태 조회

DB
--
PostgresSaver 를 사용해 thread 영속. langgraph dev 의 자동 checkpointer 와 분리.
"""
from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.types import Command
from pydantic import BaseModel

from graph import build_graph_with_checkpointer

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://langgraph:langgraph@localhost:5432/langgraph"
)


class ChatRequest(BaseModel):
    thread_id: str
    message: str


_state: dict[str, Any] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    # PostgresSaver 는 sync context manager. 직접 enter/exit 로 lifetime 관리.
    cm = PostgresSaver.from_conn_string(DATABASE_URL)
    saver = cm.__enter__()
    saver.setup()
    _state["graph"] = build_graph_with_checkpointer(saver)
    _state["cm"] = cm
    try:
        yield
    finally:
        cm.__exit__(None, None, None)


app = FastAPI(lifespan=lifespan)


def _summarize(result: dict) -> dict:
    """invoke 결과를 클라이언트가 보기 쉬운 형태로 요약."""
    if "__interrupt__" in result:
        return {"status": "waiting", "interrupt": [i.value for i in result["__interrupt__"]]}
    last = result["messages"][-1] if result.get("messages") else None
    return {"status": "done", "reply": getattr(last, "content", None)}


@app.post("/chat")
async def chat(req: ChatRequest):
    """그래프는 sync API 라 to_thread 로 워커 격리 (FastAPI 이벤트 루프 보호)."""
    graph = _state["graph"]
    cfg = {"configurable": {"thread_id": req.thread_id}}
    out = await asyncio.to_thread(
        graph.invoke,
        {"messages": [HumanMessage(content=req.message)]},
        cfg,
    )
    return {"thread_id": req.thread_id, **_summarize(out)}


@app.post("/webhook/{thread_id}")
async def webhook(thread_id: str, body: dict):
    """외부 시스템이 호출. body 는 {"result": "..."} 또는 임의 dict.

    interrupt() 가 멈춰있으면 그 곳에서 body 를 받아 그대로 반환됨.
    """
    graph = _state["graph"]
    cfg = {"configurable": {"thread_id": thread_id}}

    snap = await asyncio.to_thread(graph.get_state, cfg)
    if not snap.tasks or not any(t.interrupts for t in snap.tasks):
        raise HTTPException(409, detail="thread is not waiting on interrupt")

    out = await asyncio.to_thread(graph.invoke, Command(resume=body), cfg)
    return {"thread_id": thread_id, **_summarize(out)}


@app.get("/chat/{thread_id}")
async def get_thread(thread_id: str):
    graph = _state["graph"]
    cfg = {"configurable": {"thread_id": thread_id}}
    snap = await asyncio.to_thread(graph.get_state, cfg)
    msgs = snap.values.get("messages", []) if snap.values else []
    return {
        "thread_id": thread_id,
        "next": list(snap.next),
        "last": getattr(msgs[-1], "content", None) if msgs else None,
        "n_messages": len(msgs),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
