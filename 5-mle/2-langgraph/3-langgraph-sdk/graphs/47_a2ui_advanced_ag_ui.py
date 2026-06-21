"""Example 47: CopilotKit AG-UI advanced A2UI graph."""

from __future__ import annotations

from typing import Any

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


@tool("build_advanced_a2ui")
def build_advanced_a2ui(request: str) -> dict[str, Any]:
    """Return dynamic A2UI, explicit progress, and action metadata."""
    return {
        "schema_version": "advanced-a2ui-v1",
        "request": request or "Plan an incident response review.",
        "progress": [
            {"id": "planning", "label": "Planning", "status": "completed", "detail": "Selected the workflow shape."},
            {"id": "fetching", "label": "Fetching", "status": "completed", "detail": "Loaded deterministic fixture data."},
            {"id": "composing", "label": "Composing", "status": "completed", "detail": "Built the generated UI payload."},
            {"id": "waiting", "label": "Waiting for action", "status": "active", "detail": "Frontend can confirm one option."},
        ],
        "panel": {
            "type": "decision_panel",
            "title": "Release decision",
            "summary": "The graph recommends a staged launch with explicit confirmation.",
            "options": [
                {"id": "approve-staged", "label": "Approve staged launch", "impact": "Low risk", "selected": True},
                {"id": "request-review", "label": "Request security review", "impact": "Adds one day", "selected": False},
                {"id": "hold-release", "label": "Hold release", "impact": "Blocks rollout", "selected": False},
            ],
        },
        "actions": [
            {
                "id": "confirm_advanced_selection",
                "label": "Confirm selection",
                "tool_name": "confirm_advanced_selection",
                "payload": {"selection_id": "approve-staged", "selection_label": "Approve staged launch"},
            }
        ],
        "final_summary": "Advanced A2UI payload includes progress, a generated decision panel, and a frontend action.",
    }


SYSTEM_PROMPT = (
    "You are the A2UI advanced demo agent. Always call build_advanced_a2ui before "
    "answering. After the tool returns, briefly explain the progress phases, the "
    "recommended generated UI, and the frontend confirmation action."
)


def build_graph():
    return create_agent(
        model=create_llm(),
        tools=[build_advanced_a2ui],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


graph = build_graph()
