"""Small HTTP surface for the current report and explicitly published views."""

import asyncio
from uuid import UUID

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from agent.reports import public_report, repository, vendor_catalog


async def vendors(request: Request):
    return JSONResponse(await asyncio.to_thread(vendor_catalog))


# 작업 화면은 thread의 현재 리포트를 읽고 공개 화면은 published의 별도 조건을 적용합니다.
async def current(request: Request):
    try:
        thread_id = str(UUID(request.path_params["thread_id"]))
    except ValueError:
        return JSONResponse({"error": "잘못된 thread ID입니다."}, status_code=400)
    report = await asyncio.to_thread(repository.current, thread_id)
    return JSONResponse({"report": public_report(report) if report else None})


# ID를 아는 것만으로 조회할 수 없으며 발행 여부와 생성 완료 상태를 모두 확인합니다.
async def published(request: Request):
    report = await asyncio.to_thread(repository.get, request.path_params["report_id"])
    if not report or not report["published"] or report["status"] != "ready":
        return JSONResponse({"error": "공개된 리포트를 찾을 수 없습니다."}, status_code=404)
    return JSONResponse(public_report(report), headers={"Cache-Control": "no-store"})


async def publish(request: Request):
    try:
        report = await asyncio.to_thread(repository.publish, request.path_params["report_id"])
        return JSONResponse(report)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=409)


app = Starlette(routes=[
    Route("/canvas/vendors", vendors),
    Route("/canvas/threads/{thread_id}/report", current),
    Route("/canvas/reports/{report_id}", published),
    Route("/canvas/reports/{report_id}/publish", publish, methods=["POST"]),
])
