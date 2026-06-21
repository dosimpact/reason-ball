"""Example 22: custom stream events rendered as inline progress components."""

from __future__ import annotations

import time
from datetime import UTC, datetime
from operator import add
from typing import Annotated, Any, Literal, TypedDict
from uuid import uuid4

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


EventKind = Literal["phase", "progress", "status", "warning", "diagnostic"]


class RendererEvent(TypedDict, total=False):
    type: str
    schema_version: str
    kind: EventKind
    event_id: str
    replace_key: str
    sequence: int
    phase: str
    node: str
    status: str
    progress: float
    message: str
    severity: str
    timestamp: str


class PhaseRecord(TypedDict):
    phase: str
    label: str
    status: str
    progress: float
    last_message: str


class RendererMetadata(TypedDict, total=False):
    graph_id: str
    renderer_version: str
    stream_modes: list[str]
    known_event_kinds: list[str]
    task_id: str


class CustomEventRendererState(TypedDict, total=False):
    task_id: str
    task_prompt: str
    run_id: str
    final_status: str
    renderer_status: str
    render_events: Annotated[list[RendererEvent], add]
    phase_records: Annotated[list[PhaseRecord], add]
    phase_progress: Annotated[list[PhaseRecord], add]
    progress_events: Annotated[list[RendererEvent], add]
    warning_events: Annotated[list[str], add]
    unknown_events: Annotated[list[RendererEvent], add]
    unknown_diagnostics: Annotated[list[RendererEvent], add]
    warnings: Annotated[list[str], add]
    renderer_metadata: RendererMetadata
    answer: str
    final: str


DEFAULT_PROMPT = (
    "Render a chat inline progress component while a data import is downloaded, "
    "transformed, validated, and summarized."
)


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds")


def _writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _event(
    *,
    kind: EventKind,
    sequence: int,
    phase: str,
    node: str,
    status: str,
    progress: float,
    message: str,
    severity: str = "info",
) -> RendererEvent:
    return {
        "type": "custom_event_renderer",
        "schema_version": "v1",
        "kind": kind,
        "event_id": f"{phase}-{sequence}",
        "replace_key": f"{phase}:{kind}",
        "sequence": sequence,
        "phase": phase,
        "node": node,
        "status": status,
        "progress": round(progress, 2),
        "message": message,
        "severity": severity,
        "timestamp": _now(),
    }


def _emit(event: RendererEvent) -> RendererEvent:
    _writer()(event)
    return event


def _extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                text = block.get("text") or block.get("content")
                if isinstance(text, str):
                    parts.append(text)
        return "".join(parts)
    return str(content)


def prepare_task(state: CustomEventRendererState) -> dict:
    task_id = str(state.get("task_id") or f"evt-{uuid4().hex[:8]}").strip() or f"evt-{uuid4().hex[:8]}"
    prompt = str(state.get("task_prompt") or DEFAULT_PROMPT).strip() or DEFAULT_PROMPT
    event = _emit(
        _event(
            kind="phase",
            sequence=1,
            phase="prepare",
            node="prepare_task",
            status="running",
            progress=0.05,
            message="Renderer run accepted and chat placeholder created.",
        )
    )
    return {
        "task_id": task_id,
        "task_prompt": prompt,
        "run_id": f"custom-event-{uuid4().hex[:10]}",
        "final_status": "running",
        "renderer_status": "running",
        "renderer_metadata": {
            "graph_id": "custom_event_renderer",
            "renderer_version": "inline-progress-v1",
            "stream_modes": ["updates", "custom"],
            "known_event_kinds": ["phase", "progress", "status", "warning"],
            "task_id": task_id,
        },
        "phase_records": [
            {
                "phase": "prepare",
                "label": "Prepare renderer",
                "status": "running",
                "progress": 0.05,
                "last_message": event["message"],
            }
        ],
        "phase_progress": [
            {
                "phase": "prepare",
                "label": "Prepare renderer",
                "status": "running",
                "progress": 0.05,
                "last_message": event["message"],
            }
        ],
        "render_events": [event],
        "progress_events": [event],
    }


def download_payload(state: CustomEventRendererState) -> dict:
    events: list[RendererEvent] = []
    for index, progress in enumerate((0.18, 0.32, 0.46), start=2):
        events.append(
            _emit(
                _event(
                    kind="progress",
                    sequence=index,
                    phase="download",
                    node="download_payload",
                    status="running" if progress < 0.46 else "completed",
                    progress=progress,
                    message=f"Downloaded source chunk {index - 1}/3 for {state.get('task_id', 'task')}.",
                )
            )
        )
        time.sleep(0.02)
    return {
        "phase_records": [
            {
                "phase": "download",
                "label": "Download payload",
                "status": "completed",
                "progress": 0.46,
                "last_message": events[-1]["message"],
            }
        ],
        "phase_progress": [
            {
                "phase": "download",
                "label": "Download payload",
                "status": "completed",
                "progress": 0.46,
                "last_message": events[-1]["message"],
            }
        ],
        "render_events": events,
        "progress_events": events,
    }


def transform_payload(state: CustomEventRendererState) -> dict:
    prompt = state.get("task_prompt", "")
    events = [
        _emit(
            _event(
                kind="phase",
                sequence=5,
                phase="transform",
                node="transform_payload",
                status="running",
                progress=0.58,
                message="Normalizing event payloads for the inline renderer.",
            )
        ),
        _emit(
            _event(
                kind="warning",
                sequence=6,
                phase="transform",
                node="transform_payload",
                status="warning",
                progress=0.68,
                message="One payload used a legacy field name; renderer mapped it safely.",
                severity="warning",
            )
        ),
        _emit(
            _event(
                kind="progress",
                sequence=7,
                phase="transform",
                node="transform_payload",
                status="completed",
                progress=0.78,
                message="Known event kinds coalesced into stable chat components.",
            )
        ),
    ]
    diagnostic = _emit(
        _event(
            kind="diagnostic",
            sequence=8,
            phase="transform",
            node="transform_payload",
            status="inspected",
            progress=0.78,
            message="Unknown diagnostic event preserved for the raw inspector.",
            severity="debug",
        )
    )
    warning_text = (
        "Legacy event field mapped during transform."
        if "warning" in prompt.lower() or "legacy" in prompt.lower()
        else "Demo warning emitted to exercise the warning renderer."
    )
    return {
        "phase_records": [
            {
                "phase": "transform",
                "label": "Transform events",
                "status": "completed",
                "progress": 0.78,
                "last_message": events[-1]["message"],
            }
        ],
        "phase_progress": [
            {
                "phase": "transform",
                "label": "Transform events",
                "status": "completed",
                "progress": 0.78,
                "last_message": events[-1]["message"],
            }
        ],
        "render_events": [*events, diagnostic],
        "progress_events": events,
        "unknown_events": [diagnostic],
        "unknown_diagnostics": [diagnostic],
        "warnings": [warning_text],
        "warning_events": [warning_text],
    }


def summarize_with_model(state: CustomEventRendererState) -> dict:
    start = _emit(
        _event(
            kind="status",
            sequence=9,
            phase="summarize",
            node="summarize_with_model",
            status="running",
            progress=0.88,
            message="OpenAI summary generation started.",
        )
    )
    response = create_llm("fast").invoke(
        [
            SystemMessage(
                content=(
                    "You explain custom LangGraph stream events for a UI learner. "
                    "Mention that progress, warning, and status events are rendered separately "
                    "from assistant text. Keep the answer concise."
                )
            ),
            HumanMessage(
                content=(
                    f"TASK ID: {state.get('task_id', '')}\n"
                    f"TASK PROMPT: {state.get('task_prompt', DEFAULT_PROMPT)}\n"
                    f"VISIBLE EVENTS: {state.get('progress_events', [])}\n"
                    f"UNKNOWN EVENTS: {state.get('unknown_events', [])}"
                )
            ),
        ]
    )
    answer = _extract_text(response.content).strip()
    done = _emit(
        _event(
            kind="status",
            sequence=10,
            phase="summarize",
            node="summarize_with_model",
            status="completed",
            progress=0.96,
            message="OpenAI summary generated for the assistant message.",
        )
    )
    return {
        "answer": answer,
        "final": answer,
        "phase_records": [
            {
                "phase": "summarize",
                "label": "Summarize result",
                "status": "completed",
                "progress": 0.96,
                "last_message": done["message"],
            }
        ],
        "phase_progress": [
            {
                "phase": "summarize",
                "label": "Summarize result",
                "status": "completed",
                "progress": 0.96,
                "last_message": done["message"],
            }
        ],
        "render_events": [start, done],
        "progress_events": [start, done],
    }


def finalize_renderer(state: CustomEventRendererState) -> dict:
    event = _emit(
        _event(
            kind="status",
            sequence=11,
            phase="complete",
            node="finalize_renderer",
            status="completed",
            progress=1.0,
            message="Inline custom event rendering completed.",
        )
    )
    return {
        "final_status": "completed",
        "renderer_status": "completed",
        "phase_records": [
            {
                "phase": "complete",
                "label": "Complete",
                "status": "completed",
                "progress": 1.0,
                "last_message": event["message"],
            }
        ],
        "phase_progress": [
            {
                "phase": "complete",
                "label": "Complete",
                "status": "completed",
                "progress": 1.0,
                "last_message": event["message"],
            }
        ],
        "render_events": [event],
        "progress_events": [event],
    }


def build_graph():
    builder = StateGraph(CustomEventRendererState)
    builder.add_node("prepare_task", prepare_task)
    builder.add_node("download_payload", download_payload)
    builder.add_node("transform_payload", transform_payload)
    builder.add_node("summarize_with_model", summarize_with_model)
    builder.add_node("finalize_renderer", finalize_renderer)
    builder.add_edge(START, "prepare_task")
    builder.add_edge("prepare_task", "download_payload")
    builder.add_edge("download_payload", "transform_payload")
    builder.add_edge("transform_payload", "summarize_with_model")
    builder.add_edge("summarize_with_model", "finalize_renderer")
    builder.add_edge("finalize_renderer", END)
    return builder.compile()


graph = build_graph()
