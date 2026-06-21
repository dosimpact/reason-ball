"""Example 14: plan-and-execute workflow with observable step state."""

from __future__ import annotations

from typing import Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from common.llm import create_llm


StepStatus = Literal["pending", "active", "completed", "failed", "skipped", "replanned"]
ControlMode = Literal["normal", "replan_after_first", "stop_after_first"]
ExecutionStatus = Literal["idle", "planned", "executing", "replanned", "stopped", "completed"]


class StepDraft(BaseModel):
    """One short executable plan step."""

    title: str = Field(description="Short imperative step title, under 12 words.")


class PlanDraft(BaseModel):
    """A compact execution plan."""

    steps: list[StepDraft] = Field(description="Two or three executable steps.", min_length=2, max_length=3)


class PlanStep(TypedDict):
    id: str
    index: int
    title: str
    status: StepStatus
    result: str
    error: str
    source: str


class StepEvent(TypedDict):
    type: str
    step_id: str
    status: StepStatus
    title: str
    detail: str


class ReplanRecord(TypedDict):
    from_version: int
    to_version: int
    reason: str
    replaced_step_ids: list[str]
    new_step_ids: list[str]


class PlanExecuteState(TypedDict, total=False):
    task: str
    control_mode: ControlMode
    execution_status: ExecutionStatus
    plan_steps: list[PlanStep]
    remaining_steps: list[str]
    completed_steps: list[PlanStep]
    active_step_id: str
    step_events: list[StepEvent]
    plan_version: int
    replanned: bool
    replan_history: list[ReplanRecord]
    stopped: bool
    stop_reason: str
    final_answer: str
    final: str
    trace: list[dict[str, Any]]


DEFAULT_TASK = "Build a LangGraph SDK learning demo: plan the work, implement the UI, and verify it."


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


def _fallback_steps(task: str) -> list[str]:
    lowered = task.lower()
    if "trip" in lowered or "travel" in lowered:
        return ["Clarify the travel goal", "Draft the itinerary", "Check timing and logistics"]
    if "blog" in lowered or "post" in lowered:
        return ["Create the outline", "Draft the main sections", "Edit and publish checklist"]
    return ["Clarify the target outcome", "Implement the core workflow", "Verify and summarize results"]


def _step(step_id: str, index: int, title: str, source: str, status: StepStatus = "pending") -> PlanStep:
    return {
        "id": step_id,
        "index": index,
        "title": title,
        "status": status,
        "result": "",
        "error": "",
        "source": source,
    }


def _update_step(
    steps: list[PlanStep],
    step_id: str,
    status: StepStatus,
    result: str = "",
    error: str = "",
) -> list[PlanStep]:
    updated: list[PlanStep] = []
    for step in steps:
        if step["id"] == step_id:
            updated.append({**step, "status": status, "result": result or step["result"], "error": error})
        else:
            updated.append(step)
    return updated


def _event(step: PlanStep, status: StepStatus, detail: str) -> StepEvent:
    return {
        "type": "plan_step",
        "step_id": step["id"],
        "status": status,
        "title": step["title"],
        "detail": detail,
    }


def _steps_from_titles(titles: list[str], version: int, source: str) -> list[PlanStep]:
    return [_step(f"v{version}-step-{index}", index, title.strip(), source) for index, title in enumerate(titles, start=1)]


def planner(state: PlanExecuteState) -> dict:
    task = state.get("task", DEFAULT_TASK)
    control_mode = state.get("control_mode", "normal")
    try:
        plan: PlanDraft = create_llm("fast").with_structured_output(PlanDraft).invoke(
            [
                SystemMessage(
                    content=(
                        "Break the user's task into exactly 3 short executable steps. "
                        "Each step should be concrete and observable in a UI."
                    )
                ),
                HumanMessage(content=task),
            ]
        )
        titles = [step.title for step in plan.steps]
    except Exception:  # pragma: no cover - provider failures are environment dependent
        titles = _fallback_steps(task)

    steps = _steps_from_titles(titles[:3], 1, "planner")
    return {
        "task": task,
        "control_mode": control_mode,
        "execution_status": "planned",
        "plan_steps": steps,
        "remaining_steps": [step["id"] for step in steps],
        "completed_steps": [],
        "active_step_id": "",
        "step_events": [],
        "plan_version": 1,
        "replanned": False,
        "replan_history": [],
        "stopped": False,
        "stop_reason": "",
        "trace": [
            {
                "node": "planner",
                "event": "planned",
                "step_ids": [step["id"] for step in steps],
                "control_mode": control_mode,
            }
        ],
    }


def executor(state: PlanExecuteState) -> dict:
    remaining = list(state.get("remaining_steps", []))
    steps = list(state.get("plan_steps", []))
    if not remaining:
        return {}

    step_id = remaining.pop(0)
    current = next(step for step in steps if step["id"] == step_id)
    writer = get_stream_writer()
    start_event = _event(current, "active", f"Executing {current['title']}")
    writer(start_event)

    active_steps = _update_step(steps, step_id, "active")
    try:
        response = create_llm("fast").invoke(
            [
                SystemMessage(
                    content=(
                        "You execute one step from a larger plan. Return one concise "
                        "result sentence under 90 characters. Do not invent hidden work.\n"
                        f"Original task: {state.get('task', DEFAULT_TASK)}\n"
                        f"Completed so far: {[step['title'] for step in state.get('completed_steps', [])]}"
                    )
                ),
                HumanMessage(content=f"Execute this step: {current['title']}"),
            ]
        )
        result = _extract_text(response.content).strip()
        status: StepStatus = "completed"
        error = ""
    except Exception as exc:  # pragma: no cover - provider failures are environment dependent
        result = ""
        status = "failed"
        error = str(exc)

    completed_plan = _update_step(active_steps, step_id, status, result=result, error=error)
    completed_step = next(step for step in completed_plan if step["id"] == step_id)
    done_event = _event(completed_step, status, result or error or "Step finished.")
    writer(done_event)
    return {
        "execution_status": "executing",
        "plan_steps": completed_plan,
        "remaining_steps": remaining,
        "completed_steps": list(state.get("completed_steps", [])) + [completed_step],
        "active_step_id": "",
        "step_events": list(state.get("step_events", [])) + [start_event, done_event],
        "trace": state.get("trace", [])
        + [
            {
                "node": "executor",
                "event": status,
                "step_id": step_id,
                "remaining": remaining,
            }
        ],
    }


def should_continue(state: PlanExecuteState) -> str:
    completed_count = len(state.get("completed_steps", []))
    if state.get("control_mode") == "stop_after_first" and completed_count >= 1 and not state.get("stopped"):
        return "stop"
    if (
        state.get("control_mode") == "replan_after_first"
        and completed_count >= 1
        and not state.get("replanned")
        and state.get("remaining_steps")
    ):
        return "replan"
    return "executor" if state.get("remaining_steps") else "finalize"


def replan(state: PlanExecuteState) -> dict:
    task = state.get("task", DEFAULT_TASK)
    remaining_ids = list(state.get("remaining_steps", []))
    steps = list(state.get("plan_steps", []))
    remaining_titles = [step["title"] for step in steps if step["id"] in remaining_ids]
    completed_titles = [step["title"] for step in state.get("completed_steps", [])]
    next_version = int(state.get("plan_version", 1)) + 1
    reason = "Replan requested after the first completed step."
    try:
        plan: PlanDraft = create_llm("fast").with_structured_output(PlanDraft).invoke(
            [
                SystemMessage(
                    content=(
                        "Revise the remaining plan after one step has completed. "
                        "Return two short steps that finish the task without repeating completed work."
                    )
                ),
                HumanMessage(
                    content=(
                        f"Task: {task}\nCompleted: {completed_titles}\n"
                        f"Original remaining steps: {remaining_titles}"
                    )
                ),
            ]
        )
        titles = [step.title for step in plan.steps[:2]]
    except Exception:  # pragma: no cover - provider failures are environment dependent
        titles = [f"Revised: {title}" for title in remaining_titles[:2]] or ["Verify revised result"]

    skipped_steps = [
        {**step, "status": "replanned", "error": reason}
        if step["id"] in remaining_ids
        else step
        for step in steps
    ]
    new_steps = _steps_from_titles(titles, next_version, "replan")
    history = {
        "from_version": int(state.get("plan_version", 1)),
        "to_version": next_version,
        "reason": reason,
        "replaced_step_ids": remaining_ids,
        "new_step_ids": [step["id"] for step in new_steps],
    }
    return {
        "execution_status": "replanned",
        "plan_steps": skipped_steps + new_steps,
        "remaining_steps": [step["id"] for step in new_steps],
        "plan_version": next_version,
        "replanned": True,
        "replan_history": list(state.get("replan_history", [])) + [history],
        "trace": state.get("trace", [])
        + [
            {
                "node": "replan",
                "event": "replanned",
                "replaced_step_ids": remaining_ids,
                "new_step_ids": [step["id"] for step in new_steps],
            }
        ],
    }


def stop_execution(state: PlanExecuteState) -> dict:
    remaining = set(state.get("remaining_steps", []))
    reason = "Stop requested after the first completed step."
    stopped_steps = [
        {**step, "status": "skipped", "error": reason}
        if step["id"] in remaining
        else step
        for step in state.get("plan_steps", [])
    ]
    return {
        "execution_status": "stopped",
        "plan_steps": stopped_steps,
        "remaining_steps": [],
        "stopped": True,
        "stop_reason": reason,
        "trace": state.get("trace", [])
        + [
            {
                "node": "stop_execution",
                "event": "stopped",
                "skipped_step_ids": sorted(remaining),
            }
        ],
    }


def finalize(state: PlanExecuteState) -> dict:
    completed = state.get("completed_steps", [])
    lines = [
        f"{index}. {step['title']}: {step['result'] or step['error']}"
        for index, step in enumerate(completed, start=1)
    ]
    if state.get("stopped"):
        header = f"Plan stopped after {len(completed)} completed step."
    elif state.get("replanned"):
        header = f"Replanned plan executed with {len(completed)} completed steps."
    else:
        header = f"Plan executed with {len(completed)} completed steps."
    final_answer = header + ("\n" + "\n".join(lines) if lines else "")
    return {
        "execution_status": "completed" if not state.get("stopped") else "stopped",
        "final_answer": final_answer,
        "final": final_answer,
        "trace": state.get("trace", [])
        + [
            {
                "node": "finalize",
                "event": "complete",
                "completed_count": len(completed),
                "stopped": bool(state.get("stopped")),
                "replanned": bool(state.get("replanned")),
            }
        ],
    }


def build_graph():
    builder = StateGraph(PlanExecuteState)
    builder.add_node("planner", planner)
    builder.add_node("executor", executor)
    builder.add_node("replan", replan)
    builder.add_node("stop_execution", stop_execution)
    builder.add_node("finalize", finalize)

    builder.add_edge(START, "planner")
    builder.add_edge("planner", "executor")
    builder.add_conditional_edges(
        "executor",
        should_continue,
        {"executor": "executor", "replan": "replan", "stop": "stop_execution", "finalize": "finalize"},
    )
    builder.add_edge("replan", "executor")
    builder.add_edge("stop_execution", "finalize")
    builder.add_edge("finalize", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    output = graph.invoke({"task": DEFAULT_TASK, "control_mode": "normal"}, config={"recursion_limit": 20})
    print(output["final"])
