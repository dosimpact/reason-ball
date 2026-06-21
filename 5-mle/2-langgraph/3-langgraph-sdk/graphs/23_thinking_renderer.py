"""Example 23: public thinking/status renderer without exposing non-public reasoning."""

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


ThinkingStatus = Literal["queued", "running", "completed"]


class ThinkingStep(TypedDict):
    type: str
    schema_version: str
    step_id: str
    sequence: int
    label: str
    status: ThinkingStatus
    public_summary: str
    detail: str
    timestamp: str
    public_only: bool


class SafetyGuardrails(TypedDict):
    public_only: bool
    hidden_reasoning_exposed: bool
    policy: str
    allowed_content: list[str]
    blocked_content: list[str]


class ThinkingRendererState(TypedDict, total=False):
    question: str
    run_id: str
    final_status: str
    thinking_steps: Annotated[list[ThinkingStep], add]
    reasoning_summary: str
    safety_guardrails: SafetyGuardrails
    answer: str
    final: str


DEFAULT_QUESTION = (
    "Explain how a LangGraph UI can show useful thinking status without exposing non-public model notes."
)


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds")


def _writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _step(
    *,
    step_id: str,
    sequence: int,
    label: str,
    status: ThinkingStatus,
    public_summary: str,
    detail: str,
) -> ThinkingStep:
    return {
        "type": "thinking_renderer",
        "schema_version": "v1",
        "step_id": step_id,
        "sequence": sequence,
        "label": label,
        "status": status,
        "public_summary": public_summary,
        "detail": detail,
        "timestamp": _now(),
        "public_only": True,
    }


def _emit(step: ThinkingStep) -> ThinkingStep:
    _writer()(step)
    return step


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


def prepare_question(state: ThinkingRendererState) -> dict:
    question = str(state.get("question") or DEFAULT_QUESTION).strip() or DEFAULT_QUESTION
    step = _emit(
        _step(
            step_id="prepare",
            sequence=1,
            label="Prepare request",
            status="running",
            public_summary="Accepted the prompt and created a public thinking timeline.",
            detail="This step stores the user question and run metadata only.",
        )
    )
    return {
        "question": question,
        "run_id": f"thinking-{uuid4().hex[:10]}",
        "final_status": "running",
        "safety_guardrails": {
            "public_only": True,
            "hidden_reasoning_exposed": False,
            "policy": "Only graph-authored public status summaries are rendered; non-public model notes are not exposed.",
            "allowed_content": ["status labels", "public summaries", "timestamps", "final answer"],
            "blocked_content": ["non-public model notes", "internal working notes", "unverified reasoning transcripts"],
        },
        "thinking_steps": [step],
    }


def inspect_prompt(state: ThinkingRendererState) -> dict:
    question = state.get("question", DEFAULT_QUESTION)
    topic = "support triage" if any(term in question.lower() for term in ("ticket", "support", "customer")) else "reasoning UI"
    step = _emit(
        _step(
            step_id="inspect",
            sequence=2,
            label="Inspect prompt",
            status="completed",
            public_summary=f"Identified the visible task as {topic} and noted safety constraints.",
            detail="The renderer records classification and constraints, not model working notes.",
        )
    )
    time.sleep(0.02)
    return {"thinking_steps": [step]}


def build_public_summary(state: ThinkingRendererState) -> dict:
    steps = [
        _emit(
            _step(
                step_id="context",
                sequence=3,
                label="Gather visible context",
                status="completed",
                public_summary="Collected only the user prompt, graph status, and guardrail metadata.",
                detail="No provider working notes are requested or stored.",
            )
        ),
        _emit(
            _step(
                step_id="compose",
                sequence=4,
                label="Compose answer plan",
                status="running",
                public_summary="Prepared a short answer plan from public notes.",
                detail="The plan is a high-level public summary, not an internal transcript.",
            )
        ),
    ]
    summary = (
        "Public reasoning summary: classify the visible request, apply the public-only guardrail, "
        "then answer from the prompt and displayed status notes."
    )
    return {"thinking_steps": steps, "reasoning_summary": summary}


def call_model(state: ThinkingRendererState) -> dict:
    start = _emit(
        _step(
            step_id="llm",
            sequence=5,
            label="Generate final answer",
            status="running",
            public_summary="OpenAI is generating the final response from public notes only.",
            detail="The prompt instructs the model not to reveal or invent non-public notes.",
        )
    )
    response = create_llm("fast").invoke(
        [
            SystemMessage(
                content=(
                    "You are a LangGraph UI tutor. Answer the user's question using only the "
                    "provided public reasoning summary and guardrails. Do not reveal, request, "
                    "or simulate non-public model notes. Keep the response concise."
                )
            ),
            HumanMessage(
                content=(
                    f"USER QUESTION:\n{state.get('question', DEFAULT_QUESTION)}\n\n"
                    f"PUBLIC SUMMARY:\n{state.get('reasoning_summary', '')}\n\n"
                    f"GUARDRAILS:\n{state.get('safety_guardrails', {})}"
                )
            ),
        ]
    )
    answer = _extract_text(response.content).strip()
    done = _emit(
        _step(
            step_id="llm",
            sequence=6,
            label="Generate final answer",
            status="completed",
            public_summary="Final answer generated and kept separate from thinking blocks.",
            detail="The UI should render this as the assistant answer, not as a thinking detail.",
        )
    )
    return {
        "answer": answer,
        "final": answer,
        "thinking_steps": [start, done],
    }


def finalize(state: ThinkingRendererState) -> dict:
    step = _emit(
        _step(
            step_id="finalize",
            sequence=7,
            label="Finalize renderer",
            status="completed",
            public_summary="Thinking renderer completed with public-only summaries.",
            detail="Final state includes guardrails so tests can verify no non-public notes were exposed.",
        )
    )
    return {"final_status": "completed", "thinking_steps": [step]}


def build_graph():
    builder = StateGraph(ThinkingRendererState)
    builder.add_node("prepare_question", prepare_question)
    builder.add_node("inspect_prompt", inspect_prompt)
    builder.add_node("build_public_summary", build_public_summary)
    builder.add_node("call_model", call_model)
    builder.add_node("finalize", finalize)
    builder.add_edge(START, "prepare_question")
    builder.add_edge("prepare_question", "inspect_prompt")
    builder.add_edge("inspect_prompt", "build_public_summary")
    builder.add_edge("build_public_summary", "call_model")
    builder.add_edge("call_model", "finalize")
    builder.add_edge("finalize", END)
    return builder.compile()


graph = build_graph()
