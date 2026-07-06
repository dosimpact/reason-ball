"""Example 49: loop engineering harness with agent, verifier, event, and improvement loops."""

from __future__ import annotations

from operator import add
from typing import Annotated, Any, Literal, TypedDict

from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph


TriggerType = Literal["manual", "webhook", "cron"]
Verdict = Literal["PASS", "FAIL"]


class TriggerRecord(TypedDict):
    type: TriggerType
    source: str
    payload_id: str
    summary: str


class ToolCallRecord(TypedDict):
    id: str
    attempt: int
    name: str
    args: dict[str, Any]
    result: str


class AttemptRecord(TypedDict):
    attempt: int
    draft: str
    status: str
    tool_call_ids: list[str]
    changes_from_feedback: list[str]


class VerificationRecord(TypedDict):
    attempt: int
    verdict: Verdict
    score: int
    threshold: int
    feedback: str
    retry_reason: str


class TraceEvent(TypedDict):
    loop: str
    phase: str
    status: str
    detail: str
    attempt: int


class ImprovementSuggestion(TypedDict):
    area: str
    suggestion: str
    evidence: str


class HarnessState(TypedDict, total=False):
    task: str
    trigger_type: TriggerType
    max_attempts: int
    quality_threshold: int
    trigger: TriggerRecord
    current_attempt: int
    attempts: Annotated[list[AttemptRecord], add]
    tool_calls: Annotated[list[ToolCallRecord], add]
    verification_results: Annotated[list[VerificationRecord], add]
    trace_events: Annotated[list[TraceEvent], add]
    improvement_suggestions: list[ImprovementSuggestion]
    final_answer: str
    stop_reason: str
    final: str


DEFAULT_TASK = (
    "Improve a release note for developers explaining how loop engineering makes "
    "LangGraph agents easier to verify, operate, and improve."
)


def _writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _event(loop: str, phase: str, status: str, detail: str, attempt: int = 0) -> TraceEvent:
    event: TraceEvent = {
        "loop": loop,
        "phase": phase,
        "status": status,
        "detail": detail,
        "attempt": attempt,
    }
    _writer()({"type": "loop_engineering_event", **event})
    return event


def _max_attempts(state: HarnessState) -> int:
    raw = state.get("max_attempts", 3)
    return min(max(raw if isinstance(raw, int) else 3, 1), 4)


def _quality_threshold(state: HarnessState) -> int:
    raw = state.get("quality_threshold", 4)
    return min(max(raw if isinstance(raw, int) else 4, 1), 5)


def receive_event(state: HarnessState) -> dict:
    trigger_type = state.get("trigger_type", "manual")
    if trigger_type not in {"manual", "webhook", "cron"}:
        trigger_type = "manual"
    task = state.get("task", DEFAULT_TASK).strip() or DEFAULT_TASK
    trigger: TriggerRecord = {
        "type": trigger_type,
        "source": {
            "manual": "user-run-button",
            "webhook": "release-notes.webhook",
            "cron": "nightly-quality-cron",
        }[trigger_type],
        "payload_id": f"{trigger_type}-loop-demo",
        "summary": f"{trigger_type} trigger accepted for loop harness.",
    }
    trace = _event(
        "event-driven",
        "trigger_received",
        "succeeded",
        f"Standardized {trigger_type} event into graph input.",
    )
    return {
        "task": task,
        "trigger_type": trigger_type,
        "max_attempts": _max_attempts(state),
        "quality_threshold": _quality_threshold(state),
        "trigger": trigger,
        "trace_events": [trace],
    }


def agent_work(state: HarnessState) -> dict:
    attempt = int(state.get("current_attempt", 0)) + 1
    previous_results = state.get("verification_results", [])
    changes = previous_results[-1]["feedback"].split("; ") if previous_results else []
    if attempt == 1:
        draft = (
            "Loop engineering helps agents run tasks with tools and checks. "
            "It can make the workflow easier to improve later."
        )
    else:
        draft = (
            "Loop engineering treats an agent system as a stack of loops: an agent loop uses "
            "tools, a verification loop scores each attempt, an event-driven loop starts work "
            "from product signals, and a hill-climbing loop studies traces to improve prompts, "
            "rubrics, and tools."
        )
    tool_call: ToolCallRecord = {
        "id": f"research-context-{attempt}",
        "attempt": attempt,
        "name": "collect_loop_context",
        "args": {"task": state.get("task", DEFAULT_TASK), "attempt": attempt},
        "result": "Collected loop stack notes and prior verifier feedback.",
    }
    trace = _event(
        "agent",
        "tool_and_draft",
        "succeeded",
        f"Attempt {attempt} produced a draft with local tool context.",
        attempt,
    )
    attempt_record: AttemptRecord = {
        "attempt": attempt,
        "draft": draft,
        "status": "ready_for_verification",
        "tool_call_ids": [tool_call["id"]],
        "changes_from_feedback": changes,
    }
    return {
        "current_attempt": attempt,
        "attempts": [attempt_record],
        "tool_calls": [tool_call],
        "trace_events": [trace],
    }


def verify_output(state: HarnessState) -> dict:
    attempt = int(state.get("current_attempt", 1))
    threshold = _quality_threshold(state)
    if attempt == 1 and _max_attempts(state) > 1:
        score = min(threshold - 1, 3)
        verdict: Verdict = "FAIL"
        feedback = "Name the four loop layers; include how traces drive future improvements"
        retry_reason = "First draft is too generic for the loop engineering harness."
    else:
        score = max(threshold, 4)
        verdict = "PASS"
        feedback = "The draft names the loop stack and connects verification with trace-driven improvement."
        retry_reason = ""
    result: VerificationRecord = {
        "attempt": attempt,
        "verdict": verdict,
        "score": score,
        "threshold": threshold,
        "feedback": feedback,
        "retry_reason": retry_reason,
    }
    trace = _event(
        "verification",
        "rubric_evaluated",
        "passed" if verdict == "PASS" else "retry",
        f"Attempt {attempt} scored {score}/{threshold}.",
        attempt,
    )
    return {"verification_results": [result], "trace_events": [trace]}


def route_after_verification(state: HarnessState) -> str:
    results = state.get("verification_results", [])
    if results and results[-1]["verdict"] == "PASS":
        return "analyze_traces"
    if int(state.get("current_attempt", 0)) >= _max_attempts(state):
        return "analyze_traces"
    return "agent_work"


def analyze_traces(state: HarnessState) -> dict:
    results = state.get("verification_results", [])
    last = results[-1] if results else None
    suggestions: list[ImprovementSuggestion] = [
        {
            "area": "prompt",
            "suggestion": "Ask the agent to name agent, verification, event-driven, and hill-climbing loops explicitly.",
            "evidence": "The first attempt failed when it described loop engineering too generically.",
        },
        {
            "area": "rubric",
            "suggestion": "Keep a minimum score threshold and require trace-backed improvement language.",
            "evidence": "Verifier feedback drove the second draft toward concrete loop-stack coverage.",
        },
        {
            "area": "tool",
            "suggestion": "Add a trace summarizer tool before future prompt changes are accepted.",
            "evidence": f"{len(state.get('trace_events', []))} trace events were available for analysis.",
        },
    ]
    trace = _event(
        "hill-climbing",
        "trace_analysis",
        "succeeded",
        "Converted verifier and trace signals into harness improvement suggestions.",
        int(state.get("current_attempt", 0)),
    )
    stop_reason = "quality_threshold_met" if last and last["verdict"] == "PASS" else "max_attempts_reached"
    final_answer = state.get("attempts", [])[-1]["draft"] if state.get("attempts") else ""
    final = (
        f"Loop harness finished with {stop_reason}. "
        f"Attempts: {len(state.get('attempts', []))}. Final score: {last['score'] if last else 'n/a'}."
    )
    return {
        "improvement_suggestions": suggestions,
        "trace_events": [trace],
        "stop_reason": stop_reason,
        "final_answer": final_answer,
        "final": final,
    }


def build_graph():
    builder = StateGraph(HarnessState)
    builder.add_node("receive_event", receive_event)
    builder.add_node("agent_work", agent_work)
    builder.add_node("verify_output", verify_output)
    builder.add_node("analyze_traces", analyze_traces)
    builder.add_edge(START, "receive_event")
    builder.add_edge("receive_event", "agent_work")
    builder.add_edge("agent_work", "verify_output")
    builder.add_conditional_edges(
        "verify_output",
        route_after_verification,
        {"agent_work": "agent_work", "analyze_traces": "analyze_traces"},
    )
    builder.add_edge("analyze_traces", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    print(graph.invoke({"trigger_type": "webhook"}))
