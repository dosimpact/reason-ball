"""LangGraph 서버에 함께 탑재되는 Canvas 스트림 및 데이터 API."""

import asyncio
import json
from uuid import uuid4

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, StreamingResponse
from starlette.routing import Route

from agent import analysis
from agent.canvas_graph import METRICS, Operation, canvas_graph


async def query(request: Request):
    try:
        raw = await request.body()
        if len(raw) > 32000:
            return JSONResponse({"error": "요청이 너무 큽니다."}, status_code=413)
        body = json.loads(raw)
        if not isinstance(body, dict) or not isinstance(
            body.get("parameters", {}), dict
        ):
            raise TypeError()
        METRICS["queryRuns"] += 1
        result = await asyncio.to_thread(
            analysis.run_saved_query,
            body["queryId"],
            body["queryVersion"],
            body.get("parameters", {}),
        )
        return JSONResponse(
            {
                **result,
                "requestId": body.get("requestId"),
                "definitionRevision": body.get("definitionRevision"),
            }
        )
    except (ValueError, KeyError, TypeError):
        return JSONResponse(
            {"error": "조회할 수 없습니다. 쿼리 버전과 조회 조건을 확인하세요."},
            status_code=400,
        )


async def chat(request: Request):
    try:
        raw = await request.body()
        if len(raw) > 1_000_000:
            return JSONResponse({"error": "요청이 너무 큽니다."}, status_code=413)
        body = json.loads(raw)
        if not isinstance(body, dict):
            raise TypeError()
        if (
            not isinstance(body.get("message"), str)
            or not body["message"].strip()
            or len(body["message"]) > 12000
        ):
            raise ValueError()
        for key, limit in (
            ("widgets", 100),
            ("canvases", 30),
            ("history", 24),
            ("chatArtifacts", 8),
        ):
            items = body.get(key, [])
            if (
                not isinstance(items, list)
                or len(items) > limit
                or any(not isinstance(item, dict) for item in items)
            ):
                raise ValueError()
            if key != "history" and any(
                not isinstance(item.get("id"), str) for item in items
            ):
                raise ValueError()
        retries = body.get("retryOperations", [])
        if not isinstance(retries, list) or len(retries) > 8:
            raise ValueError()
        body["retryOperations"] = [
            Operation.model_validate(op).model_dump(exclude_none=True) for op in retries
        ]
        if (
            not isinstance(body.get("widgets", []), list)
            or len(body.get("widgets", [])) > 100
        ):
            raise ValueError()
    except (ValueError, TypeError):
        return JSONResponse(
            {"error": "메시지와 Canvas 상태를 확인하세요."}, status_code=400
        )
    run_id = str(uuid4())

    async def events():
        sequence = 0
        try:
            async for event in canvas_graph.astream(
                {"request": body}, stream_mode="custom"
            ):
                sequence += 1
                frame = {
                    **event,
                    "runId": run_id,
                    "requestId": body.get("requestId"),
                    "sequence": sequence,
                }
                yield "data: " + json.dumps(frame, ensure_ascii=False) + "\n\n"
            sequence += 1
            yield (
                "data: "
                + json.dumps({"type": "done", "runId": run_id, "sequence": sequence})
                + "\n\n"
            )
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 — API 경계에서 provider 비밀정보가 포함될 수 있는 원문 오류를 숨긴다.
            yield (
                "data: "
                + json.dumps(
                    {
                        "type": "error",
                        "runId": run_id,
                        "sequence": sequence + 1,
                        "message": "분석 요청을 완료하지 못했습니다. 기존 결과는 유지됩니다. 다시 시도해 주세요.",
                    },
                    ensure_ascii=False,
                )
                + "\n\n"
            )

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def health(request):
    return JSONResponse({"ok": True, "synthetic": True, **METRICS})


app = Starlette(
    routes=[
        Route("/canvas/chat", chat, methods=["POST"]),
        Route("/canvas/query", query, methods=["POST"]),
        Route("/canvas/health", health),
    ]
)
