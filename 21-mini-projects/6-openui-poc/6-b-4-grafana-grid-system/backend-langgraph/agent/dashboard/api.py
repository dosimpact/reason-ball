"""대시보드 REST 명령과 AG-UI 스트리밍. 완료 전에 서버 상태와 이력을 저장합니다."""

import asyncio
import json
import logging
from uuid import uuid4

import anyio
import httpx
from langchain_core.messages import convert_to_messages, convert_to_openai_messages
from starlette.responses import JSONResponse, StreamingResponse
from starlette.routing import Route

from agent import history
from agent.dashboard import diagnostics, store
from agent.dashboard.execution import final_answer, plan_request
from agent.dashboard.graph import build_dashboard_graph, model
from agent.dashboard.grounding import retrieved_evidence
from agent.dashboard.refresh import refresh_panel
from agent.dashboard.research_guard import original_scope
from agent.dashboard.validation import validate_program
from agent.documents import list_documents
from agent.streaming import OpenUIStreamTransformer

logger = logging.getLogger(__name__)
active = set()


def sse(event):
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


async def state(request):
    thread_id = request.path_params["thread_id"]
    try:
        if request.method == "GET":
            result = await asyncio.to_thread(store.read, thread_id)
        else:
            raw = await request.json()
            if raw.get("action") == "refresh_result":
                raise ValueError("Refresh result is server-owned")
            if raw.get("action") == "refresh":
                return JSONResponse(await refresh_panel(thread_id, raw))
            if raw.get("payload", {}).get("program"):
                await validate_program(raw["payload"]["program"])
            if raw.get("action") == "import":
                for panel in raw.get("payload", {}).get("panels", []):
                    if panel.get("kind") == "openui":
                        await validate_program(panel["program"])
            result = await asyncio.to_thread(store.execute, thread_id, raw)
        return JSONResponse(result)
    except history.ThreadNotFound:
        return JSONResponse({"error": "Thread not found"}, status_code=404)
    except httpx.HTTPError:
        return JSONResponse(
            {"error": "UI validation service unavailable; previous state retained"},
            status_code=503,
        )
    except store.Conflict as exc:
        return JSONResponse({"error": str(exc)}, status_code=409)
    except (ValueError, TypeError, KeyError):
        return JSONResponse({"error": "Invalid dashboard command"}, status_code=400)


async def chat(request):
    try:
        body = await request.json()
        thread_id = history.checked_id(body["threadId"])
        last = body["messages"][-1]
        if (
            last.get("role") != "user"
            or not isinstance(last.get("content"), str)
            or not last["content"].strip()
        ):
            raise ValueError("Expected user text")
        question = {"role": "user", "content": last["content"][:16000]}
        saved = await asyncio.to_thread(history.get_messages, thread_id)
    except history.ThreadNotFound:
        return JSONResponse({"error": "Thread not found"}, status_code=404)
    except (ValueError, KeyError, TypeError, IndexError):
        return JSONResponse(
            {"error": "Expected threadId and final user message"}, status_code=400
        )
    if thread_id in active:
        return JSONResponse({"error": "Thread is running"}, status_code=409)
    active.add(thread_id)

    async def stream():
        run_id = str(uuid4())
        recorder = history.TurnRecorder(question)
        final_messages = None
        plan = None
        grounding_audit = []
        failed = False
        cancelled = False
        try:
            snapshot = await asyncio.to_thread(store.read, thread_id)
            yield sse({"type": "RUN_STARTED", "threadId": thread_id, "runId": run_id})
            yield sse({"type": "STATE_SNAPSHOT", "snapshot": {"dashboard": snapshot}})
            try:
                catalog = await asyncio.to_thread(list_documents)
            except FileNotFoundError:
                catalog = []
            plan = await plan_request(model, saved + [question], snapshot)
            buffered_answer = (
                bool(plan.operations or plan.clarification)
                or plan.source_read != "none"
                or bool(
                    retrieved_evidence(
                        convert_to_messages(history.trusted_history(saved)),
                        include_history=True,
                    )
                )
            )
            if plan.clarification:
                answer = (
                    'root = Card([Callout("info", "확인이 필요합니다", '
                    + json.dumps(plan.clarification, ensure_ascii=False)
                    + ")])"
                )
                final_messages = [
                    *saved,
                    question,
                    {"role": "assistant", "content": answer},
                ]
            else:
                graph = await asyncio.to_thread(
                    build_dashboard_graph, thread_id, catalog, plan, grounding_audit
                )
                async with await graph.astream_events(
                    {"messages": history.trusted_history(saved) + [question]},
                    config={"recursion_limit": 80},
                    version="v3",
                    transformers=[OpenUIStreamTransformer],
                ) as run:
                    async for event in run.extensions["openui"]:
                        if not (
                            buffered_answer
                            and event["type"].startswith("TEXT_MESSAGE_")
                        ):
                            recorder.observe(event)
                        failed = failed or event["type"] == "RUN_ERROR"
                        if not (
                            buffered_answer
                            and event["type"].startswith("TEXT_MESSAGE_")
                        ):
                            yield sse(event)
                        if event["type"] == "TOOL_CALL_RESULT":
                            updated = await asyncio.to_thread(store.read, thread_id)
                            if updated["revision"] != snapshot["revision"]:
                                yield sse(
                                    {
                                        "type": "STATE_DELTA",
                                        "delta": [
                                            {
                                                "op": "replace",
                                                "path": "/dashboard",
                                                "value": updated,
                                            }
                                        ],
                                    }
                                )
                                snapshot = updated
                    final_messages = [
                        message
                        for message in convert_to_openai_messages(
                            (await run.output())["messages"]
                        )
                        if message["role"] != "system"
                    ]
            if buffered_answer and not failed:
                answer = final_answer(final_messages)
                if answer:
                    message_id = str(uuid4())
                    yield sse(
                        {
                            "type": "TEXT_MESSAGE_START",
                            "messageId": message_id,
                            "role": "assistant",
                        }
                    )
                    yield sse(
                        {
                            "type": "TEXT_MESSAGE_CONTENT",
                            "messageId": message_id,
                            "delta": answer,
                        }
                    )
                    yield sse({"type": "TEXT_MESSAGE_END", "messageId": message_id})
            if not failed and not plan.clarification and plan.source_read != "none":
                scope = original_scope(final_messages)
                if scope:
                    final_messages.append({"role": "assistant", "content": scope})
                    scope_id = str(uuid4())
                    yield sse(
                        {
                            "type": "TEXT_MESSAGE_START",
                            "messageId": scope_id,
                            "role": "assistant",
                        }
                    )
                    yield sse(
                        {
                            "type": "TEXT_MESSAGE_CONTENT",
                            "messageId": scope_id,
                            "delta": scope,
                        }
                    )
                    yield sse({"type": "TEXT_MESSAGE_END", "messageId": scope_id})
        except asyncio.CancelledError:
            cancelled = True
            raise
        except (
            Exception
        ):  # stream boundary; log server-side and preserve partial history
            logger.exception("Dashboard run failed")
            failed = True
            yield sse(
                {
                    "type": "RUN_ERROR",
                    "message": "분석을 완료하지 못했습니다. 저장된 결과를 유지했으며 다시 요청할 수 있습니다.",
                }
            )
        finally:
            try:
                with anyio.CancelScope(shield=True):
                    messages_to_save = final_messages or saved + recorder.messages
                    if cancelled or failed:
                        title = "분석 중단" if cancelled else "분석 실패"
                        detail = (
                            "요청이 중단되어 위 답변은 완성되지 않았을 수 있습니다. 이미 저장된 결과는 유지됩니다. 질문을 다시 보내 분석을 이어갈 수 있습니다."
                            if cancelled
                            else "요청을 완료하지 못했습니다. 위 답변은 일부만 생성됐을 수 있습니다. 저장된 결과를 확인하고 다시 요청해 주세요."
                        )
                        messages_to_save = [
                            *messages_to_save,
                            {
                                "role": "assistant",
                                "content": f'root = Card([Callout("warning", {json.dumps(title, ensure_ascii=False)}, {json.dumps(detail, ensure_ascii=False)})])',
                            },
                        ]
                    await asyncio.to_thread(
                        history.save_messages,
                        thread_id,
                        messages_to_save,
                    )
                    if plan is not None:
                        try:
                            await asyncio.to_thread(
                                diagnostics.record,
                                thread_id,
                                run_id,
                                plan,
                                messages_to_save,
                                "cancelled"
                                if cancelled
                                else "failed"
                                if failed
                                else "finished",
                                grounding_audit,
                            )
                        except Exception:
                            logger.exception("Could not save dashboard run diagnostics")
            finally:
                active.discard(thread_id)
        if not failed:
            yield sse(
                {
                    "type": "STATE_SNAPSHOT",
                    "snapshot": {
                        "dashboard": await asyncio.to_thread(store.read, thread_id)
                    },
                }
            )
            yield sse({"type": "RUN_FINISHED", "threadId": thread_id, "runId": run_id})

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform"},
    )


routes = [
    Route("/dashboard/chat", chat, methods=["POST"]),
    Route("/dashboard/state/{thread_id}", state, methods=["GET", "POST"]),
]
