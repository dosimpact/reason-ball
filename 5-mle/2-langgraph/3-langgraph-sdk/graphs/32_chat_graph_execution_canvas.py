"""Example 32: chat plus graph execution debugger canvas."""

from __future__ import annotations

from operator import add
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


FinalStatus = Literal["idle", "inspected", "selected", "replayed", "failed"]


class GraphNode(TypedDict):
    id: str
    label: str
    kind: str
    status: str
    detail: str


class GraphEdge(TypedDict):
    id: str
    source: str
    target: str
    label: str


class ExecutionEvent(TypedDict, total=False):
    id: str
    node_id: str
    phase: str
    status: str
    title: str
    detail: str
    checkpoint_id: str
    state_keys: list[str]


class Checkpoint(TypedDict):
    id: str
    event_id: str
    label: str
    summary: str
    state_snapshot: dict[str, Any]


class StateDiff(TypedDict):
    event_id: str
    added: dict[str, Any]
    changed: dict[str, Any]
    removed: list[str]


class CanvasVersion(TypedDict, total=False):
    version: int
    action: str
    selected_event_id: str
    summary: str


class CanvasEvent(TypedDict):
    type: str
    phase: str
    status: str
    detail: str
    progress: float


class ChatGraphExecutionCanvasState(TypedDict, total=False):
    user_prompt: str
    action: str
    selected_event_id: str
    canvas_title: str
    chat_summary: str
    graph_nodes: list[GraphNode]
    graph_edges: list[GraphEdge]
    execution_events: list[ExecutionEvent]
    checkpoints: list[Checkpoint]
    state_diff: StateDiff
    selected_event: ExecutionEvent
    active_node: str
    replay_summary: str
    artifact_version: int
    version_history: list[CanvasVersion]
    final: str
    final_status: FinalStatus
    canvas_events: Annotated[list[CanvasEvent], add]


def _writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _event(phase: str, status: str, detail: str, progress: float) -> CanvasEvent:
    return {
        "type": "chat_graph_execution_canvas",
        "phase": phase,
        "status": status,
        "detail": detail,
        "progress": progress,
    }


def _emit(event: CanvasEvent) -> CanvasEvent:
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


def _truncate(text: str, limit: int = 280) -> str:
    cleaned = " ".join(text.strip().split())
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[: limit - 3].rstrip()}..."


def _prompt(value: Any) -> str:
    text = str(value or "").strip()
    return text or "Inspect a LangGraph SDK chat run with graph events, checkpoints, and replay context."


def _nodes() -> list[GraphNode]:
    return [
        {
            "id": "chat_input",
            "label": "Chat input",
            "kind": "input",
            "status": "completed",
            "detail": "User prompt normalized into graph state.",
        },
        {
            "id": "route_request",
            "label": "Route request",
            "kind": "router",
            "status": "completed",
            "detail": "Action routed to the inspection path.",
        },
        {
            "id": "retrieve_context",
            "label": "Retrieve context",
            "kind": "tool",
            "status": "completed",
            "detail": "Debugger context loaded from memory-only fixtures.",
        },
        {
            "id": "run_subgraph",
            "label": "Run subgraph",
            "kind": "subgraph",
            "status": "active",
            "detail": "Nested chat graph execution is highlighted on the canvas.",
        },
        {
            "id": "checkpoint_state",
            "label": "Checkpoint state",
            "kind": "checkpoint",
            "status": "completed",
            "detail": "State snapshot captured for replay.",
        },
        {
            "id": "summarize_result",
            "label": "Summarize result",
            "kind": "output",
            "status": "completed",
            "detail": "Run summary prepared for the chat panel.",
        },
    ]


def _edges() -> list[GraphEdge]:
    pairs = [
        ("chat_input", "route_request", "normalize"),
        ("route_request", "retrieve_context", "inspect"),
        ("retrieve_context", "run_subgraph", "context"),
        ("run_subgraph", "checkpoint_state", "snapshot"),
        ("checkpoint_state", "summarize_result", "finalize"),
    ]
    return [
        {"id": f"edge-{index}", "source": source, "target": target, "label": label}
        for index, (source, target, label) in enumerate(pairs, start=1)
    ]


def _execution_events(prompt: str) -> list[ExecutionEvent]:
    return [
        {
            "id": "evt-1",
            "node_id": "chat_input",
            "phase": "input",
            "status": "completed",
            "title": "Prompt received",
            "detail": f"Captured prompt: {prompt[:120]}",
            "checkpoint_id": "cp-1",
            "state_keys": ["user_prompt", "action"],
        },
        {
            "id": "evt-2",
            "node_id": "route_request",
            "phase": "route",
            "status": "completed",
            "title": "Inspection route selected",
            "detail": "Default inspect action selected the graph debugger artifact path.",
            "state_keys": ["action", "canvas_title"],
        },
        {
            "id": "evt-3",
            "node_id": "retrieve_context",
            "phase": "context",
            "status": "completed",
            "title": "Debugger context retrieved",
            "detail": "Loaded graph topology, checkpoint metadata, and replayable event records.",
            "checkpoint_id": "cp-2",
            "state_keys": ["graph_nodes", "graph_edges", "execution_events"],
        },
        {
            "id": "evt-4",
            "node_id": "run_subgraph",
            "phase": "subgraph",
            "status": "running",
            "title": "Nested graph execution",
            "detail": "Subgraph span expands chat response generation into inspectable child steps.",
            "state_keys": ["active_node", "state_diff"],
        },
        {
            "id": "evt-5",
            "node_id": "checkpoint_state",
            "phase": "checkpoint",
            "status": "completed",
            "title": "Checkpoint captured",
            "detail": "Checkpoint cp-3 stores active node and selected event context.",
            "checkpoint_id": "cp-3",
            "state_keys": ["checkpoints", "selected_event_id"],
        },
        {
            "id": "evt-6",
            "node_id": "summarize_result",
            "phase": "summary",
            "status": "completed",
            "title": "Canvas summary ready",
            "detail": "Chat summary and final debugger status are ready for the UI.",
            "state_keys": ["chat_summary", "final", "final_status"],
        },
    ]


def _checkpoints(prompt: str) -> list[Checkpoint]:
    return [
        {
            "id": "cp-1",
            "event_id": "evt-1",
            "label": "Input accepted",
            "summary": "Prompt and action are available before routing.",
            "state_snapshot": {"user_prompt": prompt, "action": "inspect"},
        },
        {
            "id": "cp-2",
            "event_id": "evt-3",
            "label": "Context loaded",
            "summary": "Topology and execution events are ready for inspection.",
            "state_snapshot": {"active_node": "retrieve_context", "event_count": 3},
        },
        {
            "id": "cp-3",
            "event_id": "evt-5",
            "label": "Replay anchor",
            "summary": "Checkpoint includes the selected event and active subgraph node.",
            "state_snapshot": {"active_node": "run_subgraph", "selected_event_id": "evt-3"},
        },
    ]


def _find_event(events: list[ExecutionEvent], event_id: str) -> ExecutionEvent:
    for event in events:
        if event.get("id") == event_id:
            return event
    return events[2] if len(events) >= 3 else {}


def _diff_for_event(event: ExecutionEvent) -> StateDiff:
    event_id = str(event.get("id") or "evt-3")
    node_id = str(event.get("node_id") or "run_subgraph")
    return {
        "event_id": event_id,
        "added": {
            "selected_event": event_id,
            "active_node": node_id,
        },
        "changed": {
            "detail_panel": str(event.get("title") or "Event selected"),
            "node_status": str(event.get("status") or "completed"),
        },
        "removed": [],
    }


def _append_history(state: ChatGraphExecutionCanvasState, action: str, selected_event_id: str, summary: str) -> tuple[int, list[CanvasVersion]]:
    version = int(state.get("artifact_version") or 0) + 1
    history = list(state.get("version_history") or [])
    history.append(
        {
            "version": version,
            "action": action,
            "selected_event_id": selected_event_id,
            "summary": summary,
        }
    )
    return version, history


def inspect_canvas(state: ChatGraphExecutionCanvasState) -> dict:
    prompt = _prompt(state.get("user_prompt"))
    start = _emit(_event("inspect", "running", "Building graph debugger canvas artifact.", 0.18))
    summary = _truncate(
        _extract_text(
            create_llm("fast")
            .invoke(
                [
                    SystemMessage(content="Write one concise sentence for a graph debugger canvas summary."),
                    HumanMessage(content=prompt),
                ]
            )
            .content
        ),
        280,
    )
    nodes = _nodes()
    edges = _edges()
    events = _execution_events(prompt)
    checkpoints = _checkpoints(prompt)
    selected = _find_event(events, "evt-3")
    diff = _diff_for_event(selected)
    version, history = _append_history(state, "inspect", "evt-3", summary or "Graph debugger canvas inspected.")
    done = _emit(_event("inspect", "completed", "Canvas artifact is ready with events and checkpoints.", 0.72))
    return {
        "user_prompt": prompt,
        "action": "inspect",
        "selected_event_id": "evt-3",
        "canvas_title": "Chat Graph Execution Canvas",
        "chat_summary": summary or "Graph debugger canvas inspected.",
        "graph_nodes": nodes,
        "graph_edges": edges,
        "execution_events": events,
        "checkpoints": checkpoints,
        "state_diff": diff,
        "selected_event": selected,
        "active_node": "run_subgraph",
        "replay_summary": "",
        "artifact_version": version,
        "version_history": history,
        "final": "Graph debugger canvas created with selected event evt-3.",
        "final_status": "inspected",
        "canvas_events": [start, done],
    }


def select_event(state: ChatGraphExecutionCanvasState) -> dict:
    start = _emit(_event("select_event", "running", "Selecting execution event for inspection.", 0.35))
    prompt = _prompt(state.get("user_prompt"))
    events = list(state.get("execution_events") or _execution_events(prompt))
    selected_event_id = str(state.get("selected_event_id") or "evt-3").strip() or "evt-3"
    selected = _find_event(events, selected_event_id)
    normalized_id = str(selected.get("id") or "evt-3")
    active_node = str(selected.get("node_id") or "run_subgraph")
    diff = _diff_for_event(selected)
    version, history = _append_history(
        state,
        "select_event",
        normalized_id,
        f"Selected {normalized_id} on node {active_node}.",
    )
    done = _emit(_event("select_event", "completed", f"Selected {normalized_id}.", 0.86))
    return {
        "user_prompt": prompt,
        "selected_event_id": normalized_id,
        "canvas_title": str(state.get("canvas_title") or "Chat Graph Execution Canvas"),
        "graph_nodes": list(state.get("graph_nodes") or _nodes()),
        "graph_edges": list(state.get("graph_edges") or _edges()),
        "execution_events": events,
        "checkpoints": list(state.get("checkpoints") or _checkpoints(prompt)),
        "state_diff": diff,
        "selected_event": selected,
        "active_node": active_node,
        "artifact_version": version,
        "version_history": history,
        "final": f"Selected event {normalized_id}: {selected.get('title', 'event detail ready')}.",
        "final_status": "selected",
        "canvas_events": [start, done],
    }


def time_travel(state: ChatGraphExecutionCanvasState) -> dict:
    start = _emit(_event("time_travel", "running", "Replaying from selected checkpoint context.", 0.4))
    prompt = _prompt(state.get("user_prompt"))
    events = list(state.get("execution_events") or _execution_events(prompt))
    checkpoints = list(state.get("checkpoints") or _checkpoints(prompt))
    requested_id = str(state.get("selected_event_id") or "evt-5").strip() or "evt-5"
    selected = _find_event(events, requested_id)
    normalized_id = str(selected.get("id") or "evt-3")
    active_node = str(selected.get("node_id") or "run_subgraph")
    checkpoint = next(
        (item for item in checkpoints if item.get("event_id") == normalized_id or item.get("id") == selected.get("checkpoint_id")),
        checkpoints[-1],
    )
    replay_summary = (
        f"Replayed from {checkpoint['id']} at {normalized_id}; "
        f"restored active node {active_node} with {len(events)} execution events available."
    )
    version, history = _append_history(state, "time_travel", normalized_id, replay_summary)
    done = _emit(_event("time_travel", "completed", f"Replay completed from {checkpoint['id']}.", 0.92))
    return {
        "user_prompt": prompt,
        "selected_event_id": normalized_id,
        "canvas_title": str(state.get("canvas_title") or "Chat Graph Execution Canvas"),
        "graph_nodes": list(state.get("graph_nodes") or _nodes()),
        "graph_edges": list(state.get("graph_edges") or _edges()),
        "execution_events": events,
        "checkpoints": checkpoints,
        "state_diff": _diff_for_event(selected),
        "selected_event": selected,
        "active_node": active_node,
        "replay_summary": replay_summary,
        "artifact_version": version,
        "version_history": history,
        "final": replay_summary,
        "final_status": "replayed",
        "canvas_events": [start, done],
    }


def finalize(state: ChatGraphExecutionCanvasState) -> dict:
    status = str(state.get("final_status") or "idle")
    done = _emit(_event("final", "completed", f"Canvas run completed with status={status}.", 1.0))
    return {
        "final": str(state.get("final") or "Graph execution canvas run complete."),
        "final_status": status,
        "canvas_events": [done],
    }


def route_action(state: ChatGraphExecutionCanvasState) -> str:
    action = str(state.get("action") or "inspect").strip().lower()
    if action == "select_event":
        return "select_event"
    if action == "time_travel":
        return "time_travel"
    return "inspect_canvas"


builder = StateGraph(ChatGraphExecutionCanvasState)
builder.add_node("inspect_canvas", inspect_canvas)
builder.add_node("select_event", select_event)
builder.add_node("time_travel", time_travel)
builder.add_node("finalize", finalize)
builder.add_conditional_edges(
    START,
    route_action,
    {
        "inspect_canvas": "inspect_canvas",
        "select_event": "select_event",
        "time_travel": "time_travel",
    },
)
builder.add_edge("inspect_canvas", "finalize")
builder.add_edge("select_event", "finalize")
builder.add_edge("time_travel", "finalize")
builder.add_edge("finalize", END)

graph = builder.compile()
