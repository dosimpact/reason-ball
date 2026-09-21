from __future__ import annotations

import logging
from functools import lru_cache

from ag_ui.core import EventType, RunAgentInput, RunErrorEvent
from ag_ui.encoder import EventEncoder
from ag_ui_langgraph import LangGraphAgent
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from graph.primary_graphs.a2ui_demo.contract import (
    MANIFEST,
    ContractError,
    Mode,
    load_catalog,
    verify_client_contract,
    verify_versions,
)
from graph.primary_graphs.a2ui_demo.model import ModelSettings
from graph.primary_graphs.a2ui_demo.surfaces import apply_action
from graph.primary_graphs.a2ui_demo.workflow import build_graph
from graph.primary_graphs.sec_a2ui.surface import validate_action as validate_sec_action
from graph.primary_graphs.sec_a2ui.workflow import build_sec_graph

from .gate import StreamGate
from .preview import PreviewStream

router = APIRouter(prefix="/ag-ui/a2ui", tags=["A2UI demo"])
gate = StreamGate()
logger = logging.getLogger(__name__)


@lru_cache(maxsize=3)
def get_agent(mode: Mode) -> LangGraphAgent:
    verify_versions()
    load_catalog(mode)
    return LangGraphAgent(
        name=f"a2ui-{mode}", graph=build_sec_graph() if mode == "sec" else build_graph(mode, ModelSettings.from_env().build()),
        config={"recursion_limit": 12},
    )


@router.get("/manifest")
async def manifest():
    verify_versions()
    return MANIFEST


async def prepare_input(mode: Mode, value: RunAgentInput, agent: LangGraphAgent) -> RunAgentInput:
    props = value.forwarded_props or {}
    if not isinstance(props, dict):
        raise ContractError("forwardedProps must be an object")
    verify_client_contract(mode, props.get("a2uiContract"))
    snapshot = await agent.graph.aget_state({"configurable": {"thread_id": value.thread_id}})
    surfaces = snapshot.values.get("surfaces", {})
    envelope = props.get("a2uiAction")
    action = None
    if envelope is not None:
        if not isinstance(envelope, dict):
            raise ContractError("Invalid a2uiAction envelope")
        # CopilotKit internally forwards userAction; official v0.9 calls it action.
        action = envelope.get("action", envelope.get("userAction"))
        if not isinstance(action, dict):
            raise ContractError("Missing action")
        if mode == "sec":
            validate_sec_action(action, surfaces)
        else:
            apply_action(mode, action, surfaces)
    trusted_props = {"a2ui_action": action}
    # Client state cannot replace authoritative surfaces or install frontend tools.
    return value.model_copy(update={
        "state": {"surfaces": surfaces, "a2ui_action": action},
        "forwarded_props": trusted_props,
        "tools": [],
        # Actions operate on checkpoint state, not client model-stream fragments.
        # A cancelled structured-output call can leave incomplete JSON arguments.
        "messages": [] if action is not None else value.messages,
    })


@router.post("/{mode}")
async def run_demo(mode: Mode, value: RunAgentInput, request: Request):
    try:
        props = value.forwarded_props or {}
        if not isinstance(props, dict):
            raise ContractError("forwardedProps must be an object")
        verify_client_contract(mode, props.get("a2uiContract"))
        render_mode = props.get("a2uiRenderMode", "batch")
        if render_mode not in ("batch", "progressive") or (mode != "dynamic" and render_mode != "batch"):
            raise ContractError("a2uiRenderMode must be batch, or progressive for Dynamic")
        agent = get_agent(mode).clone()
    except (ContractError, ValueError) as error:
        raise HTTPException(422, str(error)) from error
    lease = gate.reserve(f"{mode}:{value.thread_id}")
    await lease.__aenter__()
    try:
        prepared = await prepare_input(mode, value, agent)
    except BaseException as error:
        await lease.__aexit__(type(error), error, error.__traceback__)
        if isinstance(error, (ContractError, ValueError)):
            raise HTTPException(422, str(error)) from error
        raise
    encoder = EventEncoder(accept=request.headers.get("accept", "text/event-stream"))

    async def events():
        preview = PreviewStream(value.run_id) if render_mode == "progressive" else None
        try:
            async for event in agent.run(prepared):
                if preview is not None:
                    update = preview.observe(event)
                    if update is not None:
                        yield encoder.encode(update)
                yield encoder.encode(event)
        except Exception as error:  # noqa: BLE001 - sanitize arbitrary provider errors at the SSE boundary
            # Provider exceptions can contain request details. Keep credentials off the wire.
            logger.error("A2UI %s run failed (%s)", mode, type(error).__name__)
            yield encoder.encode(RunErrorEvent(type=EventType.RUN_ERROR, message="A2UI 실행 실패. 모델 설정과 서버 로그를 확인해 주세요."))
        finally:
            await lease.__aexit__(None, None, None)

    return StreamingResponse(events(), media_type=encoder.get_content_type(), headers={"Cache-Control": "no-store"})
