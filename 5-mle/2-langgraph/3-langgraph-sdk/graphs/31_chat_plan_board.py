"""Example 31: chat-driven plan board artifact workflow."""

from __future__ import annotations

from operator import add
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


FinalStatus = Literal["idle", "running", "planned", "continued", "replanned", "failed"]


class PlanStep(TypedDict):
    id: str
    title: str
    detail: str
    status: str
    owner: str


class ExecutionLog(TypedDict):
    step_id: str
    status: str
    detail: str


class PlanVersion(TypedDict, total=False):
    version: int
    summary: str
    steps: list[PlanStep]


class PlanEvent(TypedDict):
    type: str
    phase: str
    status: str
    detail: str
    progress: float


class PlanBoardState(TypedDict, total=False):
    user_goal: str
    revision_note: str
    action: str
    step_id: str
    target_status: str
    plan_title: str
    plan_summary: str
    plan_steps: list[PlanStep]
    active_step_id: str
    board_status: str
    execution_log: Annotated[list[ExecutionLog], add]
    artifact_version: int
    version_history: list[PlanVersion]
    final: str
    final_status: FinalStatus
    plan_events: Annotated[list[PlanEvent], add]


VALID_STEP_STATUSES = ("completed", "active", "pending", "blocked", "failed")


def _writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _event(phase: str, status: str, detail: str, progress: float) -> PlanEvent:
    return {
        "type": "chat_plan_board",
        "phase": phase,
        "status": status,
        "detail": detail,
        "progress": progress,
    }


def _emit(event: PlanEvent) -> PlanEvent:
    _writer()(event)
    return event


def _extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(str(block.get("text", "")) if isinstance(block, dict) else str(block) for block in content)
    return str(content)


def _goal(value: Any) -> str:
    text = str(value or "").strip()
    return text or "Launch a reliable LangGraph SDK demo workflow."


def _base_steps(goal: str) -> list[PlanStep]:
    return [
        {
            "id": "step-1",
            "title": "Clarify outcome",
            "detail": f"Restate the goal and success signal for: {goal[:110]}",
            "status": "completed",
            "owner": "planner",
        },
        {
            "id": "step-2",
            "title": "Draft execution path",
            "detail": "Break the work into visible board steps with stable ids.",
            "status": "active",
            "owner": "agent",
        },
        {
            "id": "step-3",
            "title": "Validate handoff",
            "detail": "Check risks, dependencies, and acceptance notes before continuing.",
            "status": "pending",
            "owner": "reviewer",
        },
        {
            "id": "step-4",
            "title": "Prepare final update",
            "detail": "Summarize status, completed work, and next action.",
            "status": "pending",
            "owner": "agent",
        },
    ]


def create_plan(state: PlanBoardState) -> dict:
    goal = _goal(state.get("user_goal"))
    start = _emit(_event("plan", "running", "Creating structured plan board.", 0.2))
    summary = _extract_text(
        create_llm("fast").invoke(
            [
                SystemMessage(content="Write one short sentence summarizing a project plan."),
                HumanMessage(content=goal),
            ]
        ).content
    ).strip()
    if len(summary) > 260:
        summary = f"{summary[:257].rstrip()}..."
    steps = _base_steps(goal)
    version = int(state.get("artifact_version") or 0) + 1
    history = list(state.get("version_history") or [])
    history.append({"version": version, "summary": summary or "Plan board created.", "steps": steps})
    done = _emit(_event("plan", "completed", "Plan board is ready.", 0.55))
    return {
        "user_goal": goal,
        "plan_title": "Execution Plan Board",
        "plan_summary": summary or "Plan board created.",
        "plan_steps": steps,
        "active_step_id": "step-2",
        "board_status": "planned",
        "artifact_version": version,
        "version_history": history,
        "execution_log": [{"step_id": "step-1", "status": "completed", "detail": "Goal clarified."}],
        "final": "Plan board created; continue execution from the active step.",
        "final_status": "planned",
        "plan_events": [start, done],
    }


def continue_plan(state: PlanBoardState) -> dict:
    start = _emit(_event("execute", "running", "Advancing active plan step.", 0.35))
    steps = list(state.get("plan_steps") or _base_steps(_goal(state.get("user_goal"))))
    has_manual_active = any(step["id"] != "step-2" and step["status"] == "active" for step in steps)
    advanced: list[PlanStep] = []
    for step in steps:
        next_step = dict(step)
        if step["id"] == "step-2" and step["status"] not in {"blocked", "failed"}:
            next_step["status"] = "completed"
        elif (
            step["id"] == "step-3"
            and not has_manual_active
            and step["status"] not in {"blocked", "failed", "completed"}
        ):
            next_step["status"] = "active"
        advanced.append(next_step)  # type: ignore[arg-type]
    active_step_id = next((step["id"] for step in advanced if step["status"] == "active"), "")
    version = int(state.get("artifact_version") or 0) + 1
    history = list(state.get("version_history") or [])
    history.append({"version": version, "summary": "Execution advanced to validation.", "steps": advanced})
    done = _emit(_event("execute", "completed", "Plan execution advanced.", 0.85))
    final = (
        "Execution continued; validation is now active."
        if active_step_id == "step-3"
        else "Execution continued with manual board edits preserved."
    )
    return {
        "plan_steps": advanced,
        "active_step_id": active_step_id,
        "board_status": "continued",
        "artifact_version": version,
        "version_history": history,
        "execution_log": [{"step_id": "step-2", "status": "completed", "detail": "Execution path drafted."}],
        "final": final,
        "final_status": "continued",
        "plan_events": [start, done],
    }


def revise_plan(state: PlanBoardState) -> dict:
    note = str(state.get("revision_note") or "Add a reviewer checkpoint.").strip()
    start = _emit(_event("replan", "running", "Applying user revision to plan board.", 0.35))
    steps = list(state.get("plan_steps") or _base_steps(_goal(state.get("user_goal"))))
    revised = [dict(step) for step in steps]
    revised.append(
        {
            "id": "step-5",
            "title": "Reviewer checkpoint",
            "detail": note,
            "status": "pending",
            "owner": "reviewer",
        }
    )
    version = int(state.get("artifact_version") or 0) + 1
    history = list(state.get("version_history") or [])
    history.append({"version": version, "summary": f"Replanned: {note}", "steps": revised})  # type: ignore[arg-type]
    done = _emit(_event("replan", "completed", "Plan revision stored.", 0.85))
    return {
        "revision_note": note,
        "plan_steps": revised,
        "board_status": "replanned",
        "artifact_version": version,
        "version_history": history,
        "execution_log": [{"step_id": "step-5", "status": "pending", "detail": "Reviewer checkpoint added."}],
        "final": "Plan board revised with a reviewer checkpoint.",
        "final_status": "replanned",
        "plan_events": [start, done],
    }


def move_step(state: PlanBoardState) -> dict:
    step_id = str(state.get("step_id") or "").strip()
    target_status = str(state.get("target_status") or "").strip().lower()
    start = _emit(_event("board_edit", "running", "Saving manual board move.", 0.35))

    if target_status not in VALID_STEP_STATUSES:
        target_status = "pending"

    steps = list(state.get("plan_steps") or _base_steps(_goal(state.get("user_goal"))))
    moved_title = step_id or "selected step"
    found = False
    moved_step: PlanStep | None = None
    remaining: list[PlanStep] = []

    for step in steps:
        next_step = dict(step)
        if step["id"] == step_id:
            found = True
            moved_title = step["title"]
            next_step["status"] = target_status
            moved_step = next_step  # type: ignore[assignment]
            continue
        if target_status == "active" and next_step["status"] == "active":
            next_step["status"] = "pending"
        remaining.append(next_step)  # type: ignore[arg-type]

    if not found or moved_step is None:
        failed = _emit(_event("board_edit", "failed", f"Step {step_id or 'unknown'} was not found.", 1.0))
        return {
            "board_status": "edit-failed",
            "final": f"Could not move step {step_id or 'unknown'} because it was not found.",
            "final_status": "failed",
            "plan_events": [start, failed],
        }

    insert_after = -1
    for index, step in enumerate(remaining):
        if step["status"] == target_status:
            insert_after = index
    revised = remaining[: insert_after + 1] + [moved_step] + remaining[insert_after + 1 :]
    active_step_id = next((step["id"] for step in revised if step["status"] == "active"), "")
    detail = f"User moved {moved_title} to {target_status}."
    version = int(state.get("artifact_version") or 0) + 1
    history = list(state.get("version_history") or [])
    history.append({"version": version, "summary": detail, "steps": revised})
    done = _emit(_event("board_edit", "completed", detail, 0.9))
    return {
        "plan_steps": revised,
        "active_step_id": active_step_id,
        "board_status": "user-edited",
        "artifact_version": version,
        "version_history": history,
        "execution_log": [{"step_id": step_id, "status": target_status, "detail": detail}],
        "final": detail,
        "final_status": str(state.get("final_status") or "planned"),
        "plan_events": [start, done],
    }


def finalize(state: PlanBoardState) -> dict:
    status = str(state.get("final_status") or "idle")
    done = _emit(_event("final", "completed", f"Plan board run completed with status={status}.", 1.0))
    return {"final_status": status, "final": str(state.get("final") or "Plan board run complete."), "plan_events": [done]}


def route_action(state: PlanBoardState) -> str:
    action = str(state.get("action") or "").strip().lower()
    if action == "continue":
        return "continue_plan"
    if action == "revise":
        return "revise_plan"
    if action in {"move", "move_step", "drag"}:
        return "move_step"
    return "create_plan"


builder = StateGraph(PlanBoardState)
builder.add_node("create_plan", create_plan)
builder.add_node("continue_plan", continue_plan)
builder.add_node("revise_plan", revise_plan)
builder.add_node("move_step", move_step)
builder.add_node("finalize", finalize)
builder.add_conditional_edges(
    START,
    route_action,
    {
        "create_plan": "create_plan",
        "continue_plan": "continue_plan",
        "revise_plan": "revise_plan",
        "move_step": "move_step",
    },
)
builder.add_edge("create_plan", "finalize")
builder.add_edge("continue_plan", "finalize")
builder.add_edge("revise_plan", "finalize")
builder.add_edge("move_step", "finalize")
builder.add_edge("finalize", END)

graph = builder.compile()
