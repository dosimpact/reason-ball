"""Example 10: parent graph with nested subgraph execution metadata."""

from __future__ import annotations

from typing import Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


TeamName = Literal["analytics_team", "writing_team"]


class MessageRecord(TypedDict):
    path: str
    role: str
    content: str


class StepRecord(TypedDict):
    id: str
    level: str
    path: list[str]
    node: str
    label: str
    status: str
    summary: str


class NestedExecutionState(TypedDict, total=False):
    request: str
    selected_team: TeamName
    route_reason: str
    breadcrumb: list[str]
    active_path: list[str]
    parent_messages: list[MessageRecord]
    subgraph_messages: list[MessageRecord]
    parent_steps: list[StepRecord]
    subgraph_steps: list[StepRecord]
    parent_state: dict[str, Any]
    subgraph_state: dict[str, Any]
    analysis_notes: str
    draft: str
    team_result: str
    final: str
    execution_tree: list[dict[str, Any]]
    trace: list[dict[str, Any]]


DEFAULT_REQUEST = (
    "Analyze last quarter sales data and draft an executive summary with the key "
    "growth driver and next action."
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


def _message(path: list[str], role: str, content: str) -> MessageRecord:
    return {"path": " > ".join(path), "role": role, "content": content}


def _step(level: str, path: list[str], label: str, summary: str) -> StepRecord:
    return {
        "id": "::".join(path),
        "level": level,
        "path": path,
        "node": path[-1],
        "label": label,
        "status": "done",
        "summary": summary,
    }


def _append_step(
    state: NestedExecutionState,
    key: Literal["parent_steps", "subgraph_steps"],
    level: str,
    path: list[str],
    label: str,
    summary: str,
) -> list[StepRecord]:
    return state.get(key, []) + [_step(level, path, label, summary)]


def _append_message(
    state: NestedExecutionState,
    key: Literal["parent_messages", "subgraph_messages"],
    path: list[str],
    role: str,
    content: str,
) -> list[MessageRecord]:
    return state.get(key, []) + [_message(path, role, content)]


def _classify_team(request: str) -> tuple[TeamName, str]:
    lowered = request.lower()
    if any(
        keyword in lowered
        for keyword in (
            "sales",
            "revenue",
            "quarter",
            "data",
            "chart",
            "analysis",
            "metric",
            "매출",
            "데이터",
            "분석",
        )
    ):
        return "analytics_team", "The request needs data analysis before a user-facing summary."
    return "writing_team", "The request is primarily a drafting or rewriting task."


def supervisor(state: NestedExecutionState) -> dict:
    request = state.get("request", DEFAULT_REQUEST)
    selected_team, reason = _classify_team(request)
    path = ["supervisor"]
    return {
        "request": request,
        "selected_team": selected_team,
        "route_reason": reason,
        "breadcrumb": ["supervisor", selected_team],
        "active_path": path,
        "parent_steps": _append_step(
            state,
            "parent_steps",
            "parent",
            path,
            "Top Supervisor",
            f"Routed to {selected_team}: {reason}",
        ),
        "parent_messages": _append_message(
            state,
            "parent_messages",
            path,
            "supervisor",
            f"Selected {selected_team}. {reason}",
        ),
        "parent_state": {
            "stage": "routed",
            "selected_team": selected_team,
            "route_reason": reason,
        },
        "trace": state.get("trace", [])
        + [{"path": path, "event": "route", "selected_team": selected_team}],
    }


def route_team(state: NestedExecutionState) -> str:
    return state.get("selected_team", "writing_team")


def analytics_supervisor(state: NestedExecutionState) -> dict:
    path = ["supervisor", "analytics_team", "team_supervisor"]
    return {
        "breadcrumb": path,
        "active_path": path,
        "subgraph_steps": _append_step(
            state,
            "subgraph_steps",
            "subgraph",
            path,
            "Analytics Team Supervisor",
            "Split the request into mock SQL, insight, and report workers.",
        ),
        "subgraph_messages": _append_message(
            state,
            "subgraph_messages",
            path,
            "team_supervisor",
            "Dispatch sql_worker, insight_worker, then report_worker.",
        ),
        "subgraph_state": {
            "team": "analytics_team",
            "phase": "planned",
            "workers": ["sql_worker", "insight_worker", "report_worker"],
        },
        "trace": state.get("trace", []) + [{"path": path, "event": "team_plan"}],
    }


def sql_worker(state: NestedExecutionState) -> dict:
    path = ["supervisor", "analytics_team", "sql_worker"]
    note = (
        "Mock SQL result: Q4 revenue 12.4M, Q3 revenue 10.1M, growth +22.7%; "
        "enterprise channel contributed 58% of new revenue."
    )
    return {
        "analysis_notes": note,
        "breadcrumb": path,
        "active_path": path,
        "subgraph_steps": _append_step(
            state,
            "subgraph_steps",
            "worker",
            path,
            "SQL Worker",
            "Produced a deterministic revenue table snapshot.",
        ),
        "subgraph_messages": _append_message(state, "subgraph_messages", path, "worker", note),
        "subgraph_state": {
            "team": "analytics_team",
            "phase": "sql_complete",
            "latest_worker": "sql_worker",
            "analysis_notes": note,
        },
        "trace": state.get("trace", []) + [{"path": path, "event": "worker_done"}],
    }


def insight_worker(state: NestedExecutionState) -> dict:
    path = ["supervisor", "analytics_team", "insight_worker"]
    base = state.get("analysis_notes", "")
    insight = (
        f"{base} Insight: enterprise expansion is the main growth driver, while "
        "regional SMB revenue stayed flat."
    )
    return {
        "analysis_notes": insight,
        "breadcrumb": path,
        "active_path": path,
        "subgraph_steps": _append_step(
            state,
            "subgraph_steps",
            "worker",
            path,
            "Insight Worker",
            "Converted raw metrics into a business driver.",
        ),
        "subgraph_messages": _append_message(state, "subgraph_messages", path, "worker", insight),
        "subgraph_state": {
            "team": "analytics_team",
            "phase": "insight_complete",
            "latest_worker": "insight_worker",
            "analysis_notes": insight,
        },
        "trace": state.get("trace", []) + [{"path": path, "event": "worker_done"}],
    }


def report_worker(state: NestedExecutionState) -> dict:
    path = ["supervisor", "analytics_team", "report_worker"]
    request = state.get("request", DEFAULT_REQUEST)
    notes = state.get("analysis_notes", "")
    response = create_llm().invoke(
        [
            SystemMessage(
                content=(
                    "You are the analytics report worker inside a LangGraph subgraph. "
                    "Write a concise executive summary in 2 sentences. Mention the "
                    "key metric and next action. Do not add a heading."
                )
            ),
            HumanMessage(content=f"USER REQUEST:\n{request}\n\nANALYSIS NOTES:\n{notes}"),
        ]
    )
    result = _extract_text(response.content).strip()
    return {
        "draft": result,
        "team_result": result,
        "breadcrumb": path,
        "active_path": path,
        "subgraph_steps": _append_step(
            state,
            "subgraph_steps",
            "worker",
            path,
            "Report Worker",
            "Used OpenAI to draft the team result from subgraph state.",
        ),
        "subgraph_messages": _append_message(state, "subgraph_messages", path, "worker", result),
        "subgraph_state": {
            "team": "analytics_team",
            "phase": "report_complete",
            "latest_worker": "report_worker",
            "analysis_notes": notes,
            "team_result": result,
        },
        "trace": state.get("trace", [])
        + [{"path": path, "event": "worker_done", "result_preview": result[:120]}],
    }


def writing_supervisor(state: NestedExecutionState) -> dict:
    path = ["supervisor", "writing_team", "team_supervisor"]
    return {
        "breadcrumb": path,
        "active_path": path,
        "subgraph_steps": _append_step(
            state,
            "subgraph_steps",
            "subgraph",
            path,
            "Writing Team Supervisor",
            "Split the request into outline and draft workers.",
        ),
        "subgraph_messages": _append_message(
            state,
            "subgraph_messages",
            path,
            "team_supervisor",
            "Dispatch outline_worker, then draft_worker.",
        ),
        "subgraph_state": {
            "team": "writing_team",
            "phase": "planned",
            "workers": ["outline_worker", "draft_worker"],
        },
        "trace": state.get("trace", []) + [{"path": path, "event": "team_plan"}],
    }


def outline_worker(state: NestedExecutionState) -> dict:
    path = ["supervisor", "writing_team", "outline_worker"]
    outline = (
        "Outline: clarify the audience, preserve the requested tone, then produce "
        "a concise final paragraph with a clear action."
    )
    return {
        "analysis_notes": outline,
        "breadcrumb": path,
        "active_path": path,
        "subgraph_steps": _append_step(
            state,
            "subgraph_steps",
            "worker",
            path,
            "Outline Worker",
            "Prepared the writing constraints for the draft worker.",
        ),
        "subgraph_messages": _append_message(state, "subgraph_messages", path, "worker", outline),
        "subgraph_state": {
            "team": "writing_team",
            "phase": "outline_complete",
            "latest_worker": "outline_worker",
            "analysis_notes": outline,
        },
        "trace": state.get("trace", []) + [{"path": path, "event": "worker_done"}],
    }


def draft_worker(state: NestedExecutionState) -> dict:
    path = ["supervisor", "writing_team", "draft_worker"]
    request = state.get("request", DEFAULT_REQUEST)
    outline = state.get("analysis_notes", "")
    response = create_llm().invoke(
        [
            SystemMessage(
                content=(
                    "You are the writing worker inside a LangGraph subgraph. Produce "
                    "a polished response under 70 words using the outline."
                )
            ),
            HumanMessage(content=f"USER REQUEST:\n{request}\n\nOUTLINE:\n{outline}"),
        ]
    )
    result = _extract_text(response.content).strip()
    return {
        "draft": result,
        "team_result": result,
        "breadcrumb": path,
        "active_path": path,
        "subgraph_steps": _append_step(
            state,
            "subgraph_steps",
            "worker",
            path,
            "Draft Worker",
            "Used OpenAI to produce the writing-team output.",
        ),
        "subgraph_messages": _append_message(state, "subgraph_messages", path, "worker", result),
        "subgraph_state": {
            "team": "writing_team",
            "phase": "draft_complete",
            "latest_worker": "draft_worker",
            "analysis_notes": outline,
            "team_result": result,
        },
        "trace": state.get("trace", [])
        + [{"path": path, "event": "worker_done", "result_preview": result[:120]}],
    }


def finalize(state: NestedExecutionState) -> dict:
    selected_team = state.get("selected_team", "writing_team")
    path = ["supervisor", selected_team, "finalize"]
    final = state.get("team_result") or state.get("draft") or "No team result was produced."
    parent_steps = _append_step(
        state,
        "parent_steps",
        "parent",
        ["finalize"],
        "Finalize Parent State",
        f"Merged {selected_team} result into final state.",
    )
    subgraph_steps = state.get("subgraph_steps", [])
    execution_tree = [
        {
            "label": "supervisor",
            "children": [
                {
                    "label": selected_team,
                    "children": [
                        {"label": step["node"], "status": step["status"]}
                        for step in subgraph_steps
                    ],
                },
                {"label": "finalize", "status": "done"},
            ],
        }
    ]
    return {
        "final": final,
        "breadcrumb": path,
        "active_path": path,
        "parent_steps": parent_steps,
        "parent_messages": _append_message(
            state,
            "parent_messages",
            ["finalize"],
            "parent",
            f"Merged nested result from {selected_team}.",
        ),
        "parent_state": {
            "stage": "finalized",
            "selected_team": selected_team,
            "subgraph_steps": len(subgraph_steps),
        },
        "execution_tree": execution_tree,
        "trace": state.get("trace", []) + [{"path": path, "event": "finalize"}],
    }


def build_analytics_subgraph():
    builder = StateGraph(NestedExecutionState)
    builder.add_node("team_supervisor", analytics_supervisor)
    builder.add_node("sql_worker", sql_worker)
    builder.add_node("insight_worker", insight_worker)
    builder.add_node("report_worker", report_worker)
    builder.add_edge(START, "team_supervisor")
    builder.add_edge("team_supervisor", "sql_worker")
    builder.add_edge("sql_worker", "insight_worker")
    builder.add_edge("insight_worker", "report_worker")
    builder.add_edge("report_worker", END)
    return builder.compile()


def build_writing_subgraph():
    builder = StateGraph(NestedExecutionState)
    builder.add_node("team_supervisor", writing_supervisor)
    builder.add_node("outline_worker", outline_worker)
    builder.add_node("draft_worker", draft_worker)
    builder.add_edge(START, "team_supervisor")
    builder.add_edge("team_supervisor", "outline_worker")
    builder.add_edge("outline_worker", "draft_worker")
    builder.add_edge("draft_worker", END)
    return builder.compile()


def build_graph():
    builder = StateGraph(NestedExecutionState)
    builder.add_node("supervisor", supervisor)
    builder.add_node("analytics_team", build_analytics_subgraph())
    builder.add_node("writing_team", build_writing_subgraph())
    builder.add_node("finalize", finalize)
    builder.add_edge(START, "supervisor")
    builder.add_conditional_edges(
        "supervisor",
        route_team,
        {
            "analytics_team": "analytics_team",
            "writing_team": "writing_team",
        },
    )
    builder.add_edge("analytics_team", "finalize")
    builder.add_edge("writing_team", "finalize")
    builder.add_edge("finalize", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    for request in [
        DEFAULT_REQUEST,
        "Rewrite this customer email to sound concise and professional.",
    ]:
        output = graph.invoke({"request": request}, config={"recursion_limit": 30})
        print(output["selected_team"], output["breadcrumb"], output["final"][:120])
