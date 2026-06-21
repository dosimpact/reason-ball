"""Example 15: reflection and evaluator loop with visible iterations."""

from __future__ import annotations

from typing import Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from common.llm import create_llm


Verdict = Literal["PASS", "FAIL"]
LoopStatus = Literal["idle", "drafting", "evaluating", "retrying", "passed", "failed"]
RetryPolicy = Literal["force_first_retry", "allow_pass"]


class EvalResult(BaseModel):
    """Structured evaluator result for one draft."""

    verdict: Verdict = Field(description="PASS when the draft satisfies every rubric item.")
    score: int = Field(description="Quality score from 1 to 5.", ge=1, le=5)
    feedback: str = Field(description="One concise note explaining what to improve or why it passed.")
    strengths: list[str] = Field(description="One or two strengths in the draft.", min_length=1, max_length=2)
    required_changes: list[str] = Field(description="Concrete changes required before passing.")


class IterationRecord(TypedDict):
    iteration: int
    draft: str
    critique: str
    verdict: Verdict
    score: int
    feedback: str
    strengths: list[str]
    required_changes: list[str]
    status: str


class LoopEvent(TypedDict):
    type: str
    iteration: int
    phase: str
    verdict: str
    score: int
    detail: str


class ReflectionState(TypedDict, total=False):
    request: str
    max_attempts: int
    retry_policy: RetryPolicy
    loop_status: LoopStatus
    current_iteration: int
    iterations: list[IterationRecord]
    draft: str
    critique: str
    verdict: Verdict
    score: int
    feedback: str
    strengths: list[str]
    required_changes: list[str]
    stop_reason: str
    final_answer: str
    final: str
    loop_events: list[LoopEvent]
    trace: list[dict[str, Any]]


DEFAULT_REQUEST = (
    "Draft a concise product update for developers explaining why LangGraph checkpointing "
    "helps with review, replay, and safer agent releases."
)
DEFAULT_MAX_ATTEMPTS = 3


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


def _event(iteration: int, phase: str, detail: str, verdict: str = "", score: int = 0) -> LoopEvent:
    return {
        "type": "reflection_iteration",
        "iteration": iteration,
        "phase": phase,
        "verdict": verdict,
        "score": score,
        "detail": detail,
    }


def _max_attempts(state: ReflectionState) -> int:
    raw = state.get("max_attempts", DEFAULT_MAX_ATTEMPTS)
    if not isinstance(raw, int):
        return DEFAULT_MAX_ATTEMPTS
    return min(max(raw, 1), 4)


def draft(state: ReflectionState) -> dict:
    request = state.get("request", DEFAULT_REQUEST)
    attempt = int(state.get("current_iteration", 0)) + 1
    writer = get_stream_writer()
    start_event = _event(attempt, "drafting", f"Writing draft attempt {attempt}.")
    writer(start_event)

    if state.get("feedback"):
        prompt = (
            "Rewrite the draft using the evaluator feedback. Keep it specific, concise, "
            "and directly useful for developers. Return only the improved draft.\n\n"
            f"REQUEST:\n{request}\n\n"
            f"PREVIOUS DRAFT:\n{state.get('draft', '')}\n\n"
            f"EVALUATOR FEEDBACK:\n{state.get('feedback', '')}\n\n"
            f"REQUIRED CHANGES:\n{state.get('required_changes', [])}"
        )
    else:
        prompt = (
            "Create a short first draft in 3-5 sentences. Make it useful but leave room "
            "for an evaluator to improve specificity and clarity.\n\n"
            f"REQUEST:\n{request}"
        )

    try:
        response = create_llm("fast").invoke(
            [
                SystemMessage(
                    content=(
                        "You are a careful technical writer creating developer-facing copy. "
                        "Use plain language and concrete LangGraph concepts."
                    )
                ),
                HumanMessage(content=prompt),
            ]
        )
        text = _extract_text(response.content).strip()
    except Exception as exc:  # pragma: no cover - provider failures are environment dependent
        text = f"Draft unavailable because the model call failed: {exc}"

    done_event = _event(attempt, "draft_ready", f"Draft {attempt} is ready for evaluation.")
    writer(done_event)
    return {
        "request": request,
        "max_attempts": _max_attempts(state),
        "retry_policy": state.get("retry_policy", "force_first_retry"),
        "loop_status": "drafting",
        "current_iteration": attempt,
        "draft": text,
        "loop_events": list(state.get("loop_events", [])) + [start_event, done_event],
        "trace": state.get("trace", [])
        + [
            {
                "node": "draft",
                "event": "draft_ready",
                "iteration": attempt,
                "characters": len(text),
            }
        ],
    }


def evaluate(state: ReflectionState) -> dict:
    request = state.get("request", DEFAULT_REQUEST)
    attempt = int(state.get("current_iteration", 1))
    writer = get_stream_writer()
    start_event = _event(attempt, "evaluating", f"Evaluating draft attempt {attempt}.")
    writer(start_event)

    try:
        result: EvalResult = create_llm("fast").with_structured_output(EvalResult).invoke(
            [
                SystemMessage(
                    content=(
                        "You evaluate developer-facing technical writing. PASS only if the draft "
                        "is accurate, concrete, concise, names relevant LangGraph concepts, and "
                        "gives the reader a clear takeaway. FAIL vague or generic copy."
                    )
                ),
                HumanMessage(content=f"REQUEST:\n{request}\n\nDRAFT:\n{state.get('draft', '')}"),
            ]
        )
        verdict: Verdict = result.verdict
        score = result.score
        feedback = result.feedback
        strengths = result.strengths
        required_changes = result.required_changes
    except Exception as exc:  # pragma: no cover - provider failures are environment dependent
        verdict = "FAIL"
        score = 1
        feedback = f"Evaluator model call failed: {exc}"
        strengths = ["The loop captured the failed evaluator state."]
        required_changes = ["Retry after model connectivity is restored."]

    if state.get("retry_policy", "force_first_retry") == "force_first_retry" and attempt == 1:
        verdict = "FAIL"
        score = min(score, 3)
        policy_note = "Demo policy requires one rewrite so the feedback loop is visible."
        feedback = f"{policy_note} {feedback}".strip()
        required_changes = list(required_changes) or ["Add sharper concrete detail before final approval."]

    status = "accepted" if verdict == "PASS" else "needs_revision"
    critique = "; ".join(required_changes) if required_changes else feedback
    record: IterationRecord = {
        "iteration": attempt,
        "draft": state.get("draft", ""),
        "critique": critique,
        "verdict": verdict,
        "score": score,
        "feedback": feedback,
        "strengths": list(strengths),
        "required_changes": list(required_changes),
        "status": status,
    }
    done_event = _event(attempt, "evaluated", feedback, verdict=verdict, score=score)
    writer(done_event)
    loop_status: LoopStatus = "passed" if verdict == "PASS" else "retrying"
    if verdict == "FAIL" and attempt >= _max_attempts(state):
        loop_status = "failed"

    return {
        "loop_status": loop_status,
        "iterations": list(state.get("iterations", [])) + [record],
        "critique": critique,
        "verdict": verdict,
        "score": score,
        "feedback": feedback,
        "strengths": list(strengths),
        "required_changes": list(required_changes),
        "loop_events": list(state.get("loop_events", [])) + [start_event, done_event],
        "trace": state.get("trace", [])
        + [
            {
                "node": "evaluate",
                "event": verdict.lower(),
                "iteration": attempt,
                "score": score,
            }
        ],
    }


def should_continue(state: ReflectionState) -> str:
    if state.get("verdict") == "PASS":
        return "finalize"
    if int(state.get("current_iteration", 0)) >= _max_attempts(state):
        return "finalize"
    return "draft"


def finalize(state: ReflectionState) -> dict:
    passed = state.get("verdict") == "PASS"
    attempts = int(state.get("current_iteration", 0))
    max_attempts = _max_attempts(state)
    stop_reason = (
        f"PASS after {attempts} attempt{'s' if attempts != 1 else ''}."
        if passed
        else f"Stopped after max attempts ({max_attempts}) with final verdict FAIL."
    )
    final_answer = (
        f"{stop_reason}\n\nFinal draft:\n{state.get('draft', '')}\n\n"
        f"Latest evaluator feedback: {state.get('feedback', '')}"
    )
    return {
        "loop_status": "passed" if passed else "failed",
        "stop_reason": stop_reason,
        "final_answer": final_answer,
        "final": final_answer,
        "trace": state.get("trace", [])
        + [
            {
                "node": "finalize",
                "event": "complete",
                "passed": passed,
                "attempts": attempts,
            }
        ],
    }


def build_graph():
    builder = StateGraph(ReflectionState)
    builder.add_node("draft", draft)
    builder.add_node("evaluate", evaluate)
    builder.add_node("finalize", finalize)

    builder.add_edge(START, "draft")
    builder.add_edge("draft", "evaluate")
    builder.add_conditional_edges(
        "evaluate",
        should_continue,
        {"draft": "draft", "finalize": "finalize"},
    )
    builder.add_edge("finalize", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    output = graph.invoke({"request": DEFAULT_REQUEST, "retry_policy": "force_first_retry"})
    print(output["stop_reason"])
