"""Example 09: conditional routing with explicit branch metadata."""

from __future__ import annotations

from typing import Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


BranchName = Literal["translation", "summary", "support"]


class BranchStatus(TypedDict):
    name: BranchName
    label: str
    status: str
    reason: str


class ConditionalRoutingState(TypedDict, total=False):
    request: str
    selected_branch: BranchName
    route_reason: str
    skipped_branches: list[BranchName]
    branch_statuses: list[BranchStatus]
    branch_result: str
    final: str
    route_trace: list[dict[str, Any]]


BRANCH_LABELS: dict[BranchName, str] = {
    "translation": "Translation Branch",
    "summary": "Summary Branch",
    "support": "Support Branch",
}


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


def _classify_request(text: str) -> tuple[BranchName, str]:
    lowered = text.lower()
    if any(
        term in lowered
        for term in (
            "translate",
            "translation",
            "korean",
            "english",
            "spanish",
            "japanese",
            "번역",
            "영어",
            "한국어",
        )
    ):
        return "translation", "The request asks to move text between languages."
    if any(
        term in lowered
        for term in (
            "summarize",
            "summary",
            "condense",
            "tl;dr",
            "요약",
            "핵심",
            "정리",
        )
    ):
        return "summary", "The request asks for a condensed version of longer text."
    return "support", "No translation or summary signal was found, so route to support triage."


def _statuses(selected: BranchName, *, done: bool = False) -> list[BranchStatus]:
    rows: list[BranchStatus] = []
    for name, label in BRANCH_LABELS.items():
        if name == selected:
            status = "done" if done else "selected"
            reason = "Executed branch" if done else "Selected by route_request"
        else:
            status = "skipped"
            reason = f"Skipped because {selected} was selected"
        rows.append({"name": name, "label": label, "status": status, "reason": reason})
    return rows


def route_request(state: ConditionalRoutingState) -> dict:
    request = state.get(
        "request",
        (
            "Summarize this release note in one sentence: LangGraph adds "
            "checkpoint replay and clearer SDK stream events for debugging."
        ),
    )
    selected, reason = _classify_request(request)
    skipped = [name for name in BRANCH_LABELS if name != selected]
    return {
        "request": request,
        "selected_branch": selected,
        "route_reason": reason,
        "skipped_branches": skipped,
        "branch_statuses": _statuses(selected),
        "route_trace": [
            {
                "node": "route_request",
                "selected_branch": selected,
                "reason": reason,
                "skipped_branches": skipped,
            }
        ],
    }


def route_after_decision(state: ConditionalRoutingState) -> str:
    return state.get("selected_branch", "support")


def translation_branch(state: ConditionalRoutingState) -> dict:
    request = state.get("request", "")
    response = create_llm().invoke(
        [
            SystemMessage(
                content=(
                    "You are the translation branch. Translate the user's text into English "
                    "if it is not already English; otherwise translate it into Korean. "
                    "Return a concise translated result with no extra explanation."
                )
            ),
            HumanMessage(content=request),
        ]
    )
    result = _extract_text(response.content)
    selected = "translation"
    return {
        "branch_result": result,
        "branch_statuses": _statuses(selected, done=True),
        "route_trace": state.get("route_trace", [])
        + [{"node": "translation_branch", "result_preview": result[:120]}],
    }


def summary_branch(state: ConditionalRoutingState) -> dict:
    request = state.get("request", "")
    response = create_llm().invoke(
        [
            SystemMessage(
                content=(
                    "You are the summary branch. Summarize the user's request or supplied "
                    "text in one clear sentence. Keep it practical for a developer."
                )
            ),
            HumanMessage(content=request),
        ]
    )
    result = _extract_text(response.content)
    selected = "summary"
    return {
        "branch_result": result,
        "branch_statuses": _statuses(selected, done=True),
        "route_trace": state.get("route_trace", [])
        + [{"node": "summary_branch", "result_preview": result[:120]}],
    }


def support_branch(state: ConditionalRoutingState) -> dict:
    request = state.get("request", "")
    response = create_llm().invoke(
        [
            SystemMessage(
                content=(
                    "You are the support triage branch. Classify the user's issue, "
                    "recommend the next action, and keep the answer under 45 words."
                )
            ),
            HumanMessage(content=request),
        ]
    )
    result = _extract_text(response.content)
    selected = "support"
    return {
        "branch_result": result,
        "branch_statuses": _statuses(selected, done=True),
        "route_trace": state.get("route_trace", [])
        + [{"node": "support_branch", "result_preview": result[:120]}],
    }


def finalize(state: ConditionalRoutingState) -> dict:
    selected = state.get("selected_branch", "support")
    label = BRANCH_LABELS[selected]
    result = state.get("branch_result", "")
    return {
        "final": f"{label} handled the request: {result}",
        "route_trace": state.get("route_trace", [])
        + [{"node": "finalize", "selected_branch": selected}],
    }


def build_graph():
    builder = StateGraph(ConditionalRoutingState)
    builder.add_node("route_request", route_request)
    builder.add_node("translation_branch", translation_branch)
    builder.add_node("summary_branch", summary_branch)
    builder.add_node("support_branch", support_branch)
    builder.add_node("finalize", finalize)
    builder.add_edge(START, "route_request")
    builder.add_conditional_edges(
        "route_request",
        route_after_decision,
        {
            "translation": "translation_branch",
            "summary": "summary_branch",
            "support": "support_branch",
        },
    )
    builder.add_edge("translation_branch", "finalize")
    builder.add_edge("summary_branch", "finalize")
    builder.add_edge("support_branch", "finalize")
    builder.add_edge("finalize", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    for request in [
        "Translate this to Korean: The deployment finished successfully.",
        "Summarize this note: LangGraph supports branches and checkpoints.",
        "Customer reports a timeout after clicking deploy.",
    ]:
        out = graph.invoke({"request": request})
        print(out["selected_branch"], out["final"])
