"""Example 25: push UI-only messages into a chat stream."""

from __future__ import annotations

from operator import add
from typing import Annotated, Any, Literal, TypedDict
from uuid import uuid4

from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.graph.ui import AnyUIMessage, push_ui_message, ui_message_reducer

from common.llm import create_llm


FinalStatus = Literal["running", "completed"]


class PushUIEvent(TypedDict):
    type: str
    phase: str
    status: str
    detail: str
    ui_message_id: str
    component: str


class PushUIState(TypedDict, total=False):
    prompt: str
    workflow_id: str
    messages: Annotated[list[AnyMessage], add_messages]
    ui: Annotated[list[AnyUIMessage], ui_message_reducer]
    ui_message_ids: list[str]
    ui_components: list[str]
    ui_render_status: str
    selected_action: str
    render_events: Annotated[list[PushUIEvent], add]
    answer: str
    final: str
    final_status: FinalStatus


DEFAULT_PROMPT = (
    "Create an inline launch-readiness UI message with a status card, action buttons, "
    "and a fallback payload for an unsupported renderer."
)


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


def _event(phase: str, status: str, detail: str, ui_message_id: str = "", component: str = "") -> PushUIEvent:
    return {
        "type": "push_ui_message_example",
        "phase": phase,
        "status": status,
        "detail": detail,
        "ui_message_id": ui_message_id,
        "component": component,
    }


def _workflow_id() -> str:
    return f"push-ui-{uuid4().hex[:8]}"


def prepare_prompt(state: PushUIState) -> dict:
    prompt = str(state.get("prompt") or DEFAULT_PROMPT).strip() or DEFAULT_PROMPT
    workflow_id = str(state.get("workflow_id") or _workflow_id())
    return {
        "prompt": prompt,
        "workflow_id": workflow_id,
        "messages": [HumanMessage(content=prompt)],
        "final_status": "running",
        "ui_render_status": "preparing",
        "render_events": [_event("prepare", "completed", "Accepted prompt and created a workflow id.")],
    }


def push_inline_ui(state: PushUIState) -> dict:
    prompt = state.get("prompt", DEFAULT_PROMPT)
    workflow_id = state.get("workflow_id", _workflow_id())
    message = AIMessage(
        id=f"assistant-ui-{workflow_id}",
        content="I pushed UI-only messages that the frontend can render inline with this chat turn.",
    )

    status_id = f"{workflow_id}-status"
    status_message = push_ui_message(
        "task_status_card",
        {
            "title": "Launch readiness",
            "status": "checking",
            "progress": 0.35,
            "description": "Collecting the required checks from the graph state.",
            "items": [
                {"label": "Prompt captured", "status": "complete"},
                {"label": "Renderer selected", "status": "running"},
                {"label": "Action payload prepared", "status": "queued"},
            ],
        },
        id=status_id,
        metadata={"schema_version": "v1", "component": "task_status_card", "ordinal": 1},
        message=message,
    )
    push_ui_message(
        "task_status_card",
        {
            "status": "ready",
            "progress": 0.82,
            "description": "UI payloads are pushed through the custom stream and persisted in state.",
            "items": [
                {"label": "Prompt captured", "status": "complete"},
                {"label": "Renderer selected", "status": "complete"},
                {"label": "Action payload prepared", "status": "complete"},
            ],
        },
        id=status_id,
        metadata={"schema_version": "v1", "component": "task_status_card", "ordinal": 1},
        message=message,
        merge=True,
    )

    summary_message = push_ui_message(
        "summary_card",
        {
            "title": "Renderer payload",
            "summary": "The graph sent data fields for a card instead of asking the client to parse text.",
            "facts": [
                {"label": "Workflow", "value": workflow_id},
                {"label": "Prompt words", "value": str(len(prompt.split()))},
                {"label": "Stream mode", "value": "updates + custom"},
            ],
        },
        id=f"{workflow_id}-summary",
        metadata={"schema_version": "v1", "component": "summary_card", "ordinal": 2},
        message=message,
    )

    action_message = push_ui_message(
        "action_button_group",
        {
            "title": "Next action",
            "description": "Choose how the UI should treat this generated component.",
            "actions": [
                {"id": "approve-ui", "label": "Approve UI", "variant": "primary"},
                {"id": "revise-copy", "label": "Revise copy", "variant": "secondary"},
                {"id": "open-json", "label": "Inspect JSON", "variant": "secondary"},
            ],
        },
        id=f"{workflow_id}-actions",
        metadata={"schema_version": "v1", "component": "action_button_group", "ordinal": 3},
        message=message,
    )

    fallback_message = push_ui_message(
        "legacy_payload",
        {
            "payload_kind": "unsupported_widget",
            "reason": "The client intentionally has no renderer for this component name.",
            "raw": {"prompt_preview": prompt[:96], "workflow_id": workflow_id},
        },
        id=f"{workflow_id}-legacy",
        metadata={"schema_version": "v1", "component": "legacy_payload", "ordinal": 4, "unsupported": True},
        message=message,
    )

    pushed = [status_message, summary_message, action_message, fallback_message]
    return {
        "messages": [message],
        "ui_message_ids": [message["id"] for message in pushed],
        "ui_components": [message["name"] for message in pushed],
        "ui_render_status": "pushed",
        "render_events": [
            _event("push_ui_message", "completed", "Pushed status card payload.", status_id, "task_status_card"),
            _event(
                "push_ui_message",
                "completed",
                "Pushed summary card payload.",
                summary_message["id"],
                "summary_card",
            ),
            _event(
                "push_ui_message",
                "completed",
                "Pushed action button payload.",
                action_message["id"],
                "action_button_group",
            ),
            _event(
                "push_ui_message",
                "fallback",
                "Pushed unsupported payload for fallback rendering.",
                fallback_message["id"],
                "legacy_payload",
            ),
        ],
    }


def generate_final_answer(state: PushUIState) -> dict:
    response = create_llm("fast").invoke(
        [
            SystemMessage(
                content=(
                    "You explain LangGraph generative UI behavior concisely. Mention that UI messages "
                    "are structured payloads rendered by a client-side allowlist."
                )
            ),
            HumanMessage(
                content=(
                    f"USER PROMPT:\n{state.get('prompt', DEFAULT_PROMPT)}\n\n"
                    f"UI COMPONENTS PUSHED:\n{state.get('ui_components', [])}\n"
                    "Summarize what the user should notice in the rendered chat flow."
                )
            ),
        ]
    )
    answer = _extract_text(response.content).strip()
    return {
        "messages": [AIMessage(content=answer)],
        "answer": answer,
        "final": answer,
        "ui_render_status": "answered",
        "render_events": [_event("generate_answer", "completed", "Generated final explanation with OpenAI.")],
    }


def finalize(state: PushUIState) -> dict:
    return {
        "final_status": "completed",
        "ui_render_status": "completed",
        "render_events": [_event("finalize", "completed", "Final state includes pushed UI messages.")],
    }


def build_graph():
    builder = StateGraph(PushUIState)
    builder.add_node("prepare_prompt", prepare_prompt)
    builder.add_node("push_inline_ui", push_inline_ui)
    builder.add_node("generate_final_answer", generate_final_answer)
    builder.add_node("finalize", finalize)
    builder.add_edge(START, "prepare_prompt")
    builder.add_edge("prepare_prompt", "push_inline_ui")
    builder.add_edge("push_inline_ui", "generate_final_answer")
    builder.add_edge("generate_final_answer", "finalize")
    builder.add_edge("finalize", END)
    return builder.compile()


graph = build_graph()
