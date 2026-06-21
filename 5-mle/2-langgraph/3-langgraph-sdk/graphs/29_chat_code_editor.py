"""Example 29: chat-driven code editor artifact workflow."""

from __future__ import annotations

import difflib
from operator import add
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


FinalStatus = Literal["idle", "running", "awaiting_approval", "applied", "rejected", "failed"]
ApprovalAction = Literal["approve", "reject", "pending", "none", ""]


class FileContent(TypedDict, total=False):
    path: str
    name: str
    before: str
    after: str
    summary: str


class TestRecord(TypedDict, total=False):
    phase: str
    status: str
    detail: str
    tool: str


class EditorEvent(TypedDict):
    type: str
    phase: str
    status: str
    detail: str
    progress: float


class CodeEditorState(TypedDict, total=False):
    user_request: str
    selected_file: str
    approval: ApprovalAction
    file_name: str
    file_before: str
    file_after: str
    proposal_summary: str
    proposal_diff: str
    diff_reason: str
    artifact_version: int
    artifact_history: list[FileContent]
    test_log: str
    test_records: Annotated[list[TestRecord], add]
    approval_log: str
    final: str
    final_status: FinalStatus
    editor_events: Annotated[list[EditorEvent], add]


SAMPLE_FILES: dict[str, str] = {
    "app.py": "from fastapi import FastAPI\n\napp = FastAPI()\n\n\ndef hello(name: str) -> str:\n    return f\"Hello, {name}!\"\n",
    "README.md": "# LangGraph examples\n\nThis repository hosts LangGraph SDK example flows.\n",
}


def _writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _event(phase: str, status: str, detail: str, progress: float) -> EditorEvent:
    return {
        "type": "chat_code_editor",
        "phase": phase,
        "status": status,
        "detail": detail,
        "progress": progress,
    }


def _emit(event: EditorEvent) -> EditorEvent:
    _writer()(event)
    return event


def _safe_path(value: Any, fallback: str) -> str:
    candidate = str(value or "").strip() if value is not None else ""
    if candidate in SAMPLE_FILES:
        return candidate
    return fallback


def _normalize_request(value: Any) -> str:
    text = str(value or "").strip()
    return text or "Improve this example safely with minimal changes."


def _build_diff(path: str, source: str, request: str) -> tuple[str, str, str, str]:
    line = request.lower()
    if "test" in line:
        addition = "    # Code Editor: added lightweight test scaffold marker\n"
    elif "log" in line or "debug" in line:
        addition = "    print(\"[code-editor] debug enabled\")\n"
    elif "greet" in line:
        addition = "    return f\"Hi, {name}!\"\n"
    else:
        addition = "    # Applied by proposal: preserve behavior while improving readability\n"

    after = source + addition
    diff = "".join(
        difflib.unified_diff(
            source.splitlines(keepends=True),
            after.splitlines(keepends=True),
            fromfile=f"a/{path}",
            tofile=f"b/{path}",
        )
    )
    summary = "Proposed a minimal patch based on user request and preserved compatibility."
    return after, addition, diff, summary


def _simulate_tests(path: str, proposal: str) -> list[TestRecord]:
    return [
        {
            "phase": "static",
            "status": "passed",
            "detail": "Checked changed file format for deterministic update.",
            "tool": "py_compile",
        },
        {
            "phase": "preview",
            "status": "passed",
            "detail": f"Validated proposed diff for {path} can be represented as artifact.",
            "tool": "artifact-validator",
        },
        {
            "phase": "policy",
            "status": "passed",
            "detail": "No filesystem writes or command execution in this example mode.",
            "tool": "sandbox-policy",
        },
    ]


def propose_change(state: CodeEditorState) -> dict:
    user_request = _normalize_request(state.get("user_request"))
    selected_file = _safe_path(state.get("selected_file"), "app.py")
    source = SAMPLE_FILES.get(selected_file, SAMPLE_FILES["app.py"])
    start = _emit(_event("propose", "running", "Generating deterministic change proposal.", 0.2))
    analysis_prompt = f"Create a short proposal summary for this edit request:\n\nfile: {selected_file}\nrequest: {user_request}\n"
    llm = create_llm("fast")
    proposal_summary = str(
        llm.invoke(
            [SystemMessage(content="Write a short engineering summary for a coding proposal."), HumanMessage(content=analysis_prompt)],
        ).content
    ).strip()
    file_after, addition, diff, fallback_summary = _build_diff(selected_file, source, user_request)
    summary = proposal_summary if proposal_summary else fallback_summary
    if len(summary) > 420:
        summary = f"{summary[:417].rstrip()}..."
    test_log = (
        f"Dry-run tests for {selected_file}: inserted {len(addition)} chars, deterministic simulation."
    )

    return {
        "user_request": user_request,
        "selected_file": selected_file,
        "file_name": selected_file,
        "file_before": source,
        "file_after": file_after,
        "proposal_summary": summary,
        "proposal_diff": diff,
        "diff_reason": addition.strip(),
        "artifact_version": int(state.get("artifact_version") or 0),
        "artifact_history": list(state.get("artifact_history") or []),
        "test_log": test_log,
        "approval": "pending",
        "approval_log": "",
        "final_status": "awaiting_approval",
        "final": "Proposal ready; awaiting explicit approval before apply.",
        "editor_events": [start, _emit(_event("propose", "completed", "Diff proposal prepared.", 0.45))],
    }


def run_proposed_tests(state: CodeEditorState) -> dict:
    start = _emit(_event("test", "running", "Running deterministic test simulation.", 0.62))
    records = _simulate_tests(str(state.get("file_name") or "app.py"), str(state.get("diff_reason") or ""))
    run_complete = _emit(_event("test", "completed", "Deterministic test plan complete.", 0.95))
    return {
        "test_records": records,
        "final_status": "awaiting_approval",
        "editor_events": [start, run_complete],
    }


def apply_change(state: CodeEditorState) -> dict:
    start = _emit(_event("apply", "running", "Applying approved patch into artifact state.", 0.3))
    version = int(state.get("artifact_version") or 0) + 1
    history = list(state.get("artifact_history") or [])
    history.append(
        {
            "path": str(state.get("file_name") or "app.py"),
            "name": str(state.get("file_name") or "app.py"),
            "before": str(state.get("file_before") or ""),
            "after": str(state.get("file_after") or ""),
            "summary": str(state.get("proposal_summary") or "approved"),
        }
    )
    done = _emit(_event("apply", "completed", "Approved artifact update persisted in memory-only state.", 1.0))
    return {
        "artifact_version": version,
        "artifact_history": history,
        "approval": "",
        "final": f"Applied proposal v{version} for {state.get('file_name')}.",
        "final_status": "applied",
        "approval_log": "approved",
        "editor_events": [start, done],
    }


def reject_change(state: CodeEditorState) -> dict:
    start = _emit(_event("approve", "running", "User rejected artifact change; preserving pending proposal.", 0.5))
    done = _emit(_event("approve", "completed", "Change rejected and state preserved.", 1.0))
    return {
        "approval": "",
        "final": "User rejected the proposal. No artifact version created.",
        "approval_log": "rejected",
        "final_status": "rejected",
        "editor_events": [start, done],
    }


def finalize(state: CodeEditorState) -> dict:
    status = str(state.get("final_status") or "idle")
    final_text = str(state.get("final") or "No-op completed.")
    done = _emit(_event("final", "completed", f"Run completed with status={status}.", 1.0))
    return {
        "final": final_text,
        "final_status": status,
        "editor_events": [done],
    }


def route_action(state: CodeEditorState) -> str:
    approval = str(state.get("approval") or "").strip().lower()
    if approval == "approve":
        if not state.get("proposal_diff"):
            return "reject_change"
        return "apply_change"
    if approval == "reject":
        return "reject_change"
    return "propose_change"


builder = StateGraph(CodeEditorState)
builder.add_node("propose_change", propose_change)
builder.add_node("run_proposed_tests", run_proposed_tests)
builder.add_node("apply_change", apply_change)
builder.add_node("reject_change", reject_change)
builder.add_node("finalize", finalize)
builder.add_conditional_edges(
    START,
    route_action,
    {
        "propose_change": "propose_change",
        "apply_change": "apply_change",
        "reject_change": "reject_change",
    },
)
builder.add_edge("propose_change", "run_proposed_tests")
builder.add_edge("run_proposed_tests", "finalize")
builder.add_edge("apply_change", "finalize")
builder.add_edge("reject_change", "finalize")
builder.add_edge("finalize", END)

graph = builder.compile()
