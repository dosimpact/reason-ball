# LangGraph 서버에 함께 탑재되는 비교 서비스 HTTP 진입점입니다.
# 문서 목록·대화 CRUD·채팅 스트림을 제공하며, 모델 실행과 영구 저장은 Python 안에서 처리합니다.
"""HTTP facade for document metadata, durable threads and Python LangGraph runs."""

import asyncio
import json
import logging
import sqlite3
from uuid import uuid4

import anyio
from langchain_core.messages import convert_to_openai_messages
from starlette.applications import Starlette
from starlette.responses import JSONResponse, StreamingResponse
from starlette.routing import Route

from agent import history
from agent.dashboard.api import active as dashboard_active
from agent.dashboard.api import routes as dashboard_routes
from agent.documents import list_documents
from agent.graph import build_graph
from agent.streaming import OpenUIStreamTransformer

logger = logging.getLogger(__name__)
active = set()


# 문서 목록을 비동기 HTTP 응답으로 제공하고 준비되지 않은 상태는 503으로 구분합니다.
async def documents(request):
    try:
        return JSONResponse({"documents": await asyncio.to_thread(list_documents)})
    except (FileNotFoundError, ValueError, sqlite3.Error):
        return JSONResponse(
            {"error": "Run uv run prepare-documents in backend-langgraph."},
            status_code=503,
        )


# OpenUI 저장 어댑터의 CRUD 경로를 처리합니다. 실행 중인 대화의 변경·삭제는 거절합니다.
async def threads(request):
    action = request.path_params["action"]
    thread_id = request.path_params.get("thread_id")
    try:
        if request.method == "GET" and action == "get":
            if thread_id:
                return JSONResponse(
                    await asyncio.to_thread(history.get_messages, thread_id)
                )
            return JSONResponse(
                {"threads": await asyncio.to_thread(history.list_threads)}
            )
        if thread_id in active or thread_id in dashboard_active:
            return JSONResponse({"error": "Thread is running"}, status_code=409)
        if request.method == "POST" and action == "create":
            body = await request.json()
            question = body["messages"][0]
            if (
                not isinstance(question, dict)
                or question.get("role") != "user"
                or not isinstance(question.get("content"), str)
            ):
                raise ValueError("Expected a user text message")
            return JSONResponse(
                await asyncio.to_thread(history.create_thread, question["content"])
            )
        if request.method == "PATCH" and action == "update" and thread_id:
            body = await request.json()
            if not isinstance(body.get("title"), str):
                raise ValueError("Expected title")
            return JSONResponse(
                await asyncio.to_thread(history.update_thread, thread_id, body["title"])
            )
        if request.method == "DELETE" and action == "delete" and thread_id:
            await asyncio.to_thread(history.delete_thread, thread_id)
            return JSONResponse(None, status_code=200)
        return JSONResponse({"error": "Not found"}, status_code=404)
    except history.ThreadNotFound:
        return JSONResponse({"error": "Thread not found"}, status_code=404)
    except (ValueError, KeyError, TypeError, IndexError):
        return JSONResponse({"error": "Invalid thread request"}, status_code=400)


def sse(event):
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


# 최종 사용자 질문만 받아 서버 이력과 결합합니다. 동일 대화의 실행 중복을 막은 뒤 스트림을 시작합니다.
async def chat(request):
    try:
        body = await request.json()
        thread_id = history.checked_id(body["threadId"])
        question = body["messages"][-1]
        if (
            not isinstance(question, dict)
            or question.get("role") != "user"
            or not isinstance(question.get("content"), str)
            or not question["content"].strip()
        ):
            raise ValueError("Expected user text")
        question = {"role": "user", "content": question["content"]}
    except (ValueError, KeyError, IndexError, TypeError):
        return JSONResponse(
            {"error": "Expected threadId and a final user text message"},
            status_code=400,
        )
    if thread_id in active or thread_id in dashboard_active:
        return JSONResponse({"error": "Thread is running"}, status_code=409)
    active.add(thread_id)
    try:
        saved = await asyncio.to_thread(history.get_messages, thread_id)
        catalog = await asyncio.to_thread(list_documents)
    except asyncio.CancelledError:
        active.discard(thread_id)
        raise
    except history.ThreadNotFound:
        active.discard(thread_id)
        return JSONResponse({"error": "Thread not found"}, status_code=404)
    except Exception:
        logger.exception("Document catalog unavailable")
        active.discard(thread_id)
        return JSONResponse(
            {"error": "Documents unavailable; run uv run prepare-documents"},
            status_code=503,
        )

    # LangGraph 실행 → AG-UI 전송 → 대화 저장 순서입니다. 저장이 끝난 후에만 완료 이벤트를 내보냅니다.
    async def stream():
        recorder = history.TurnRecorder(question)
        run_id = str(uuid4())
        final_messages = None
        failed = False
        try:
            yield sse({"type": "RUN_STARTED", "threadId": thread_id, "runId": run_id})
            graph = await asyncio.to_thread(build_graph, catalog)
            async with await graph.astream_events(
                {"messages": history.trusted_history(saved) + [question]},
                config={"recursion_limit": 24},
                version="v3",
                transformers=[OpenUIStreamTransformer],
            ) as run:
                async for event in run.extensions["openui"]:
                    recorder.observe(event)
                    if event["type"] == "RUN_ERROR":
                        failed = True
                    yield sse(event)
                final_messages = convert_to_openai_messages(
                    (await run.output())["messages"]
                )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Document comparison run failed")
            failed = True
            yield sse(
                {
                    "type": "RUN_ERROR",
                    "message": "Document comparison failed. Retry the request.",
                }
            )
        finally:
            # Persist before RUN_FINISHED; shield cancellation so reopening retains completed work.
            try:
                with anyio.CancelScope(shield=True):
                    await asyncio.to_thread(
                        history.save_messages,
                        thread_id,
                        final_messages or saved + recorder.messages,
                    )
            finally:
                active.discard(thread_id)
        if not failed:
            yield sse({"type": "RUN_FINISHED", "threadId": thread_id, "runId": run_id})

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform"},
    )


app = Starlette(
    routes=dashboard_routes + [
        Route("/comparison/documents", documents),
        Route("/comparison/chat", chat, methods=["POST"]),
        Route(
            "/comparison/threads/{action}",
            threads,
            methods=["GET", "POST", "PATCH", "DELETE"],
        ),
        Route(
            "/comparison/threads/{action}/{thread_id}",
            threads,
            methods=["GET", "POST", "PATCH", "DELETE"],
        ),
    ]
)
