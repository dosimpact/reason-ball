from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from parser.api.langgraph_models import CreateThreadRequest, StreamRunRequest
from parser.retrieval.service import RetrievalService
from parser.runtime.store import RuntimeStore

router = APIRouter(prefix="/api/langgraph", tags=["langgraph"])

runtime_store = RuntimeStore()


def _extract_user_text(payload: StreamRunRequest) -> str:
    if payload.message:
        return payload.message
    for message in reversed(payload.messages or []):
        if message.get("role") != "user":
            continue
        parts = message.get("parts") or []
        for part in parts:
            if part.get("type") == "text" and part.get("text"):
                return str(part["text"])
    return ""


def _assistant_message_payload(text: str) -> list[dict[str, Any]]:
    text_id = "lg-text-1"
    chunks = [
        {"type": "text-start", "id": text_id},
    ]
    for token in text.split():
        chunks.append({"type": "text-delta", "id": text_id, "delta": f"{token} "})
    chunks.extend(
        [
            {"type": "text-end", "id": text_id},
            {
                "type": "finish",
                "finishReason": {"unified": "stop", "raw": "stop"},
                "usage": {
                    "inputTokens": {"total": 0, "noCache": 0, "cacheRead": 0, "cacheWrite": 0},
                    "outputTokens": {"total": max(1, len(text.split())), "text": max(1, len(text.split())), "reasoning": 0},
                },
            },
        ]
    )
    return chunks


@router.post("/threads")
def create_thread(req: CreateThreadRequest) -> dict[str, Any]:
    existing = runtime_store.get_thread(req.thread_id) if req.thread_id else None
    thread = existing or runtime_store.create_thread(assistant_id=req.assistant_id, thread_id=req.thread_id)
    return {
        "threadId": thread.thread_id,
        "assistantId": thread.assistant_id,
        "createdAt": thread.created_at,
    }


@router.get("/threads/{thread_id}/snapshot")
def get_snapshot(thread_id: str) -> dict[str, Any]:
    thread = runtime_store.get_thread(thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail=f"thread not found: {thread_id}")
    return {
        "threadId": thread.thread_id,
        "assistantId": thread.assistant_id,
        "state": thread.state,
        "updatedAt": thread.updated_at,
    }


@router.post("/threads/{thread_id}/runs/stream")
def stream_run(thread_id: str, req: StreamRunRequest):
    thread = runtime_store.get_thread(thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail=f"thread not found: {thread_id}")

    query = _extract_user_text(req)
    if not query:
        raise HTTPException(status_code=400, detail="No user message found")

    retrieval = RetrievalService()
    run = runtime_store.create_run(
        thread_id=thread_id,
        request={"chatId": req.chat_id, "userId": req.user_id, "query": query},
    )
    selected_filing = req.selected_filing or thread.state.get("selected_filing")
    answer_text, retrieval_result = retrieval.answer(
        query=query,
        selected_filing=selected_filing,
        company_query=req.company_query,
        ticker=req.ticker,
        cik=req.cik,
        accession_no=req.accession_no,
        filing_id=req.filing_id,
    )
    retrieval.close()

    new_state = dict(thread.state)
    messages = list(new_state.get("messages") or [])
    messages.append({"role": "user", "text": query})
    messages.append({"role": "assistant", "text": answer_text})
    new_state["messages"] = messages
    new_state["selected_filing"] = retrieval_result.selected_filing
    new_state["evidence_bundle"] = [e.__dict__ for e in retrieval_result.evidence_bundle]
    runtime_store.update_thread_state(thread_id, new_state)
    runtime_store.finish_run(run.run_id, status="completed", response_text=answer_text)

    retrieval_debug = {
        "intent": retrieval_result.intent,
        "selected_filing": retrieval_result.selected_filing,
        "citations": [e.__dict__ for e in retrieval_result.evidence_bundle],
    }

    def event_stream():
        for chunk in _assistant_message_payload(answer_text):
            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'type': 'data-retrieval-debug', 'data': json.dumps(retrieval_debug, ensure_ascii=False)}, ensure_ascii=False)}\n\n"
        if retrieval_result.selected_filing:
            yield f"data: {json.dumps({'type': 'data-selected-filing', 'data': json.dumps(retrieval_result.selected_filing, ensure_ascii=False)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/threads/{thread_id}/runs/{run_id}/stream")
def join_run_stream(thread_id: str, run_id: str):
    thread = runtime_store.get_thread(thread_id)
    run = runtime_store.get_run(run_id)
    if thread is None or run is None or run.thread_id != thread_id:
        raise HTTPException(status_code=404, detail="run not found")

    def event_stream():
        for chunk in _assistant_message_payload(run.response_text):
            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/threads/{thread_id}/stream")
def join_latest_thread_stream(thread_id: str):
    thread = runtime_store.get_thread(thread_id)
    run = runtime_store.get_latest_run_for_thread(thread_id)
    if thread is None or run is None:
        raise HTTPException(status_code=404, detail="thread or latest run not found")

    def event_stream():
        for chunk in _assistant_message_payload(run.response_text):
            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
