"""Example 33: chat-driven UI preview artifact workflow."""

from __future__ import annotations

import difflib
from operator import add
from textwrap import dedent
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


PreviewStatus = Literal["idle", "generating", "ready", "reverted", "failed"]
FinalStatus = Literal["idle", "awaiting_approval", "applied", "reverted", "failed"]
ApprovalAction = Literal["approve", "revert", "pending", "none", ""]


class ComponentTreeItem(TypedDict):
    id: str
    label: str
    kind: str
    parent_id: str
    props: dict[str, Any]


class StyleControl(TypedDict):
    id: str
    label: str
    kind: str
    value: str
    options: list[str]


class VersionRecord(TypedDict, total=False):
    version: int
    component_name: str
    summary: str
    code: str


class PreviewEvent(TypedDict):
    type: str
    phase: str
    status: str
    detail: str
    progress: float


class ChatUiPreviewState(TypedDict, total=False):
    user_request: str
    action: str
    approval: ApprovalAction
    component_name: str
    design_summary: str
    component_code: str
    proposed_code: str
    preview_markup: str
    component_tree: list[ComponentTreeItem]
    style_controls: list[StyleControl]
    diff_lines: list[str]
    preview_status: PreviewStatus
    preview_errors: list[str]
    sandbox_logs: list[str]
    approval_log: list[str]
    artifact_version: int
    version_history: list[VersionRecord]
    final: str
    final_status: FinalStatus
    preview_events: Annotated[list[PreviewEvent], add]


COMPONENT_NAME = "LaunchPreviewCard"

BASE_COMPONENT_CODE = dedent(
    """
    export function LaunchPreviewCard() {
      return (
        <section className="preview-card preview-card--neutral">
          <p className="preview-card__eyebrow">Preview draft</p>
          <h2>Launch workspace</h2>
          <p>Describe a UI change in chat to generate a reviewable component proposal.</p>
        </section>
      );
    }
    """
).strip()


def _writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _event(phase: str, status: str, detail: str, progress: float) -> PreviewEvent:
    return {
        "type": "chat_ui_preview",
        "phase": phase,
        "status": status,
        "detail": detail,
        "progress": progress,
    }


def _emit(event: PreviewEvent) -> PreviewEvent:
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


def _truncate(text: str, limit: int = 300) -> str:
    cleaned = " ".join(text.strip().split())
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[: limit - 3].rstrip()}..."


def _normalize_request(value: Any) -> str:
    text = str(value or "").strip()
    return text or "Create a polished launch preview card with a clear call to action."


def _proposed_component_code(request: str, summary: str) -> str:
    request_hint = request[:120].replace("{", "").replace("}", "").strip()
    summary_hint = summary[:160].replace("{", "").replace("}", "").strip()
    return dedent(
        f"""
        export function {COMPONENT_NAME}() {{
          const metrics = [
            {{ label: "Readiness", value: "92%" }},
            {{ label: "Owners", value: "4" }},
            {{ label: "Tasks", value: "12" }},
          ];

          return (
            <section className="preview-card preview-card--launch">
              <header className="preview-card__header">
                <p className="preview-card__eyebrow">Generated preview</p>
                <h2>Launch command center</h2>
                <p>{summary_hint or "A focused component proposal is ready for review."}</p>
              </header>
              <div className="preview-card__metrics">
                {{metrics.map((item) => (
                  <div className="preview-card__metric" key={{item.label}}>
                    <span>{{item.value}}</span>
                    <small>{{item.label}}</small>
                  </div>
                ))}}
              </div>
              <footer className="preview-card__footer">
                <span>{request_hint}</span>
                <button type="button">Approve preview</button>
              </footer>
            </section>
          );
        }}
        """
    ).strip()


def _preview_markup(summary: str) -> str:
    return dedent(
        f"""
        <section class="preview-card preview-card--launch" data-component="{COMPONENT_NAME}">
          <header class="preview-card__header">
            <p class="preview-card__eyebrow">Generated preview</p>
            <h2>Launch command center</h2>
            <p>{summary or "A focused component proposal is ready for review."}</p>
          </header>
          <div class="preview-card__metrics" aria-label="Launch metrics">
            <div class="preview-card__metric"><span>92%</span><small>Readiness</small></div>
            <div class="preview-card__metric"><span>4</span><small>Owners</small></div>
            <div class="preview-card__metric"><span>12</span><small>Tasks</small></div>
          </div>
          <footer class="preview-card__footer">
            <span>Memory-only sandbox preview</span>
            <button type="button">Approve preview</button>
          </footer>
        </section>
        """
    ).strip()


def _component_tree() -> list[ComponentTreeItem]:
    return [
        {
            "id": "root",
            "label": COMPONENT_NAME,
            "kind": "component",
            "parent_id": "",
            "props": {"className": "preview-card preview-card--launch"},
        },
        {
            "id": "header",
            "label": "Header",
            "kind": "layout",
            "parent_id": "root",
            "props": {"role": "banner"},
        },
        {
            "id": "metrics",
            "label": "Metrics",
            "kind": "collection",
            "parent_id": "root",
            "props": {"items": 3},
        },
        {
            "id": "footer",
            "label": "Approval footer",
            "kind": "action",
            "parent_id": "root",
            "props": {"button": "Approve preview"},
        },
    ]


def _style_controls() -> list[StyleControl]:
    return [
        {
            "id": "theme",
            "label": "Theme",
            "kind": "select",
            "value": "light",
            "options": ["light", "dark"],
        },
        {
            "id": "accent",
            "label": "Accent",
            "kind": "select",
            "value": "emerald",
            "options": ["emerald", "indigo", "rose"],
        },
        {
            "id": "density",
            "label": "Density",
            "kind": "segmented",
            "value": "comfortable",
            "options": ["compact", "comfortable", "spacious"],
        },
    ]


def _diff_lines(before: str, after: str) -> list[str]:
    return list(
        difflib.unified_diff(
            before.splitlines(),
            after.splitlines(),
            fromfile=f"a/{COMPONENT_NAME}.tsx",
            tofile=f"b/{COMPONENT_NAME}.tsx",
            lineterm="",
        )
    )


def generate_preview(state: ChatUiPreviewState) -> dict:
    request = _normalize_request(state.get("user_request"))
    start = _emit(_event("generate", "running", "Creating UI preview proposal.", 0.18))
    response = create_llm("fast").invoke(
        [
            SystemMessage(content="Write one short product design summary for a generated React UI preview."),
            HumanMessage(content=f"User request: {request}\nComponent: {COMPONENT_NAME}"),
        ]
    )
    summary = _truncate(_extract_text(response.content), 300)
    if not summary:
        summary = "A launch preview card with clear status metrics and an approval call to action."

    current_code = str(state.get("component_code") or BASE_COMPONENT_CODE)
    proposed_code = _proposed_component_code(request, summary)
    diff_lines = _diff_lines(current_code, proposed_code)
    done = _emit(_event("generate", "completed", "Preview artifact is ready for approval.", 0.72))
    return {
        "user_request": request,
        "action": "generate",
        "approval": "pending",
        "component_name": COMPONENT_NAME,
        "design_summary": summary,
        "component_code": current_code,
        "proposed_code": proposed_code,
        "preview_markup": _preview_markup(summary),
        "component_tree": _component_tree(),
        "style_controls": _style_controls(),
        "diff_lines": diff_lines,
        "preview_status": "ready",
        "preview_errors": [],
        "sandbox_logs": [
            "Sandbox initialized in memory-only mode.",
            "Static preview markup generated without executing arbitrary code.",
            f"Prepared {len(diff_lines)} diff lines for review.",
        ],
        "approval_log": list(state.get("approval_log") or []),
        "artifact_version": int(state.get("artifact_version") or 0),
        "version_history": list(state.get("version_history") or []),
        "final": "UI preview proposal is ready. Approval is required before applying it to the artifact.",
        "final_status": "awaiting_approval",
        "preview_events": [start, done],
    }


def apply_preview(state: ChatUiPreviewState) -> dict:
    start = _emit(_event("apply", "running", "Applying approved UI preview proposal.", 0.35))
    version = int(state.get("artifact_version") or 0) + 1
    proposed_code = str(state.get("proposed_code") or state.get("component_code") or BASE_COMPONENT_CODE)
    summary = str(state.get("design_summary") or "Approved UI preview proposal.")
    history = list(state.get("version_history") or [])
    history.append(
        {
            "version": version,
            "component_name": str(state.get("component_name") or COMPONENT_NAME),
            "summary": summary,
            "code": proposed_code,
        }
    )
    approval_log = list(state.get("approval_log") or [])
    approval_log.append(f"approved v{version}")
    done = _emit(_event("apply", "completed", f"Applied UI preview artifact v{version}.", 1.0))
    return {
        "approval": "",
        "component_name": str(state.get("component_name") or COMPONENT_NAME),
        "component_code": proposed_code,
        "proposed_code": proposed_code,
        "preview_markup": str(state.get("preview_markup") or _preview_markup(summary)),
        "component_tree": list(state.get("component_tree") or _component_tree()),
        "style_controls": list(state.get("style_controls") or _style_controls()),
        "diff_lines": [],
        "preview_status": "ready",
        "preview_errors": [],
        "sandbox_logs": list(state.get("sandbox_logs") or []) + ["Approved proposal stored in memory-only artifact state."],
        "approval_log": approval_log,
        "artifact_version": version,
        "version_history": history,
        "final": f"Applied {COMPONENT_NAME} preview artifact v{version}.",
        "final_status": "applied",
        "preview_events": [start, done],
    }


def revert_preview(state: ChatUiPreviewState) -> dict:
    start = _emit(_event("revert", "running", "Discarding pending UI preview proposal.", 0.45))
    approval_log = list(state.get("approval_log") or [])
    approval_log.append("reverted proposal")
    current_code = str(state.get("component_code") or BASE_COMPONENT_CODE)
    done = _emit(_event("revert", "completed", "Proposal discarded; current artifact preserved.", 1.0))
    return {
        "approval": "",
        "component_name": str(state.get("component_name") or COMPONENT_NAME),
        "component_code": current_code,
        "proposed_code": "",
        "preview_markup": str(state.get("preview_markup") or _preview_markup(str(state.get("design_summary") or ""))),
        "component_tree": list(state.get("component_tree") or _component_tree()),
        "style_controls": list(state.get("style_controls") or _style_controls()),
        "diff_lines": [],
        "preview_status": "reverted",
        "preview_errors": [],
        "sandbox_logs": list(state.get("sandbox_logs") or []) + ["Pending proposal reverted without changing current code."],
        "approval_log": approval_log,
        "artifact_version": int(state.get("artifact_version") or 0),
        "version_history": list(state.get("version_history") or []),
        "final": "UI preview proposal reverted. Current component code was preserved.",
        "final_status": "reverted",
        "preview_events": [start, done],
    }


def finalize(state: ChatUiPreviewState) -> dict:
    status = str(state.get("final_status") or "idle")
    done = _emit(_event("final", "completed", f"UI preview run completed with status={status}.", 1.0))
    return {
        "final": str(state.get("final") or "UI preview workflow completed."),
        "final_status": status,
        "preview_events": [done],
    }


def route_action(state: ChatUiPreviewState) -> str:
    action = str(state.get("action") or "generate").strip().lower()
    approval = str(state.get("approval") or "").strip().lower()
    if action == "apply" or approval == "approve":
        return "apply_preview"
    if action == "revert" or approval == "revert":
        return "revert_preview"
    return "generate_preview"


builder = StateGraph(ChatUiPreviewState)
builder.add_node("generate_preview", generate_preview)
builder.add_node("apply_preview", apply_preview)
builder.add_node("revert_preview", revert_preview)
builder.add_node("finalize", finalize)
builder.add_conditional_edges(
    START,
    route_action,
    {
        "generate_preview": "generate_preview",
        "apply_preview": "apply_preview",
        "revert_preview": "revert_preview",
    },
)
builder.add_edge("generate_preview", "finalize")
builder.add_edge("apply_preview", "finalize")
builder.add_edge("revert_preview", "finalize")
builder.add_edge("finalize", END)

graph = builder.compile()
