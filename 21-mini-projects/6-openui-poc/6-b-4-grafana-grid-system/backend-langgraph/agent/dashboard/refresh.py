"""Refresh stored financial queries without an LLM; stale or frozen results never overwrite."""

import asyncio

import httpx

from agent.dashboard import store
from agent.dashboard.models import DashboardCommand, RefreshPolicy
from agent.sec.client import SecCooldownError
from agent.sec.service import financials
from agent.sec.storage import now

_active = set()


def operation_applied(thread_id, operation_id):
    with store.history.connect() as db:
        store.prepare(db)
        return (
            db.execute(
                "SELECT 1 FROM dashboard_operations WHERE thread_id=? AND operation_id=?",
                (thread_id, operation_id),
            ).fetchone()
            is not None
        )


async def refresh_panel(thread_id, raw):
    command = DashboardCommand.model_validate(raw)
    if command.action != "refresh" or command.payload:
        raise ValueError("Refresh uses the stored query, not caller supplied data")
    state = await asyncio.to_thread(store.read, thread_id)
    if await asyncio.to_thread(operation_applied, thread_id, command.operation_id):
        return state
    if state["revision"] != command.base_revision:
        raise store.Conflict("Dashboard changed before refresh")
    panel = store.panel_by_id(state, command.panel_id)
    if (
        panel["kind"] != "financial"
        or RefreshPolicy.model_validate(panel.get("refresh", {})).mode == "snapshot"
    ):
        raise ValueError("Only live financial panels can refresh")
    key = (thread_id, command.panel_id)
    if key in _active:
        raise store.Conflict("Panel refresh is already running")
    _active.add(key)
    try:
        query = panel["query"]
        try:
            data = await financials(
                query["cik"],
                query.get("metric", "revenue"),
                query.get("years", 3),
                query.get("exclude_years", []),
                refresh=True,
            )
            if not data.get("rows"):
                raise ValueError("No comparable observations returned")
            payload = {"data": data, "attempted_at": now()}
        except SecCooldownError as exc:
            payload = {
                "error": f"SEC 요청 대기 중입니다. 약 {exc.retry_after}초 후 다시 시도하세요. 마지막 정상 데이터를 유지합니다.",
                "attempted_at": now(),
            }
        except (ValueError, KeyError, TypeError, httpx.HTTPError) as exc:
            # Only a safe category reaches the UI; existing observations are retained.
            payload = {
                "error": "SEC 조회에 실패했습니다. 마지막 정상 데이터를 유지합니다. ("
                + type(exc).__name__
                + ")",
                "attempted_at": now(),
            }
        return await asyncio.to_thread(
            store.execute,
            thread_id,
            {**command.model_dump(), "action": "refresh_result", "payload": payload},
        )
    finally:
        _active.discard(key)
