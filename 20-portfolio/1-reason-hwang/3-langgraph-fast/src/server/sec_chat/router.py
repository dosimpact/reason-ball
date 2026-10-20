"""서버 소유 공시/대화 세션과 AG-UI SSE. 실패 시 RUN_FINISHED를 보내지 않는다."""
from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass, field
from uuid import uuid4

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from domains.sec_chat.source import FilingSourceClient
from domains.tenk.sec_client import SecReadError
from graph.primary_graphs.sec_intelligent_ui.workflow import build_graph

router = APIRouter(prefix="/api/sec-chat", tags=["SEC Intelligent UI"])


@dataclass
class Session:
    source: dict
    history: list = field(default_factory=list)
    touched: float = field(default_factory=time.monotonic)
    busy: bool = False


sessions: dict[str, Session] = {}


class PrepareRequest(BaseModel):
    cik: str = Field(pattern=r"^\d{10}$")
    refresh: bool = True


class ChatRequest(BaseModel):
    threadId: str = Field(pattern=r"^[a-f0-9]{32}$")
    message: str = Field(min_length=1, max_length=4000)


@router.get("/companies")
async def companies(q: str = ""):
    try:
        return await FilingSourceClient().companies(q)
    except SecReadError as error:
        raise HTTPException(502, str(error)) from error


@router.post("/prepare")
async def prepare(body: PrepareRequest):
    for key, session in list(sessions.items()):
        if not session.busy and time.monotonic() - session.touched > 7200:
            del sessions[key]
    if len(sessions) >= 30:
        raise HTTPException(429, "열린 공시 세션이 많습니다. 기존 세션을 닫아 주세요.")
    try:
        source = await FilingSourceClient().prepare(body.cik, refresh=body.refresh)
    except (SecReadError, httpx.HTTPError, ValueError) as error:
        raise HTTPException(502, str(error) if isinstance(error, SecReadError) else "SEC 공시 준비에 실패했습니다.") from error
    thread_id = uuid4().hex
    sessions[thread_id] = Session(source)
    return {"threadId": thread_id, **{key: value for key, value in source.items() if key != "sections"}, "items": list(source["sections"])}


@router.delete("/threads/{thread_id}")
async def close_thread(thread_id: str):
    session = sessions.get(thread_id)
    if session and session.busy:
        raise HTTPException(409, "답변 생성 중입니다.")
    sessions.pop(thread_id, None)
    return {"deleted": True}


def event(kind: str, **payload) -> str:
    return "data: " + json.dumps({"type": kind, **payload}, ensure_ascii=False) + "\n\n"


@router.post("/chat")
async def chat(body: ChatRequest):
    session = sessions.get(body.threadId)
    if session is None:
        raise HTTPException(404, "공시 세션이 만료되었습니다. 기업 공시를 다시 준비해 주세요.")
    if session.busy:
        raise HTTPException(409, "이 대화의 답변을 생성 중입니다.")
    if not body.message.strip():
        raise HTTPException(422, "질문을 입력해 주세요.")
    session.busy = True
    session.touched = time.monotonic()

    async def stream():
        task = None
        run_id, message_id = uuid4().hex, uuid4().hex
        try:
            yield event("RUN_STARTED", threadId=body.threadId, runId=run_id)
            task = asyncio.create_task(build_graph().ainvoke({"source": session.source, "question": body.message, "history": session.history, "intent": {}, "evidence": {}, "answer": {}, "program": ""}))
            while not task.done():
                await asyncio.wait({task}, timeout=10)
                if not task.done():
                    yield ": heartbeat\n\n"
            result = await task
            yield event("TEXT_MESSAGE_START", messageId=message_id, role="assistant")
            yield event("TEXT_MESSAGE_CONTENT", messageId=message_id, delta=result["program"])
            yield event("TEXT_MESSAGE_END", messageId=message_id)
            session.history.extend([{"role": "user", "content": body.message}, {"role": "assistant", "content": result["answer"]}])
            session.history = session.history[-12:]
            yield event("RUN_FINISHED", threadId=body.threadId, runId=run_id)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - sanitize provider errors at the SSE transport boundary
            yield event("RUN_ERROR", message="근거가 검증된 답변을 생성하지 못했습니다. 모델 연결 또는 원문을 확인하고 다시 시도해 주세요.", code="SEC_CHAT_FAILED")
        finally:
            if task and not task.done():
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
            session.busy = False
            session.touched = time.monotonic()

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
