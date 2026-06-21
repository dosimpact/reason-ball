"""Example 46: CopilotKit AG-UI dynamic-schema A2UI graph."""

from __future__ import annotations

from typing import Any, Literal

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


SchemaKind = Literal["form", "list", "comparison", "summary"]


def _choose_kind(request: str) -> SchemaKind:
    lowered = request.lower()
    if any(word in lowered for word in ("compare", "versus", "vs", "option")):
        return "comparison"
    if any(word in lowered for word in ("form", "intake", "collect", "fields")):
        return "form"
    if any(word in lowered for word in ("list", "todo", "tasks", "steps")):
        return "list"
    return "summary"


@tool("generate_dynamic_schema")
def generate_dynamic_schema(request: str) -> dict[str, Any]:
    """Generate a deterministic dynamic UI schema from an approved component set."""
    kind = _choose_kind(request or "")
    base = {
        "schema_version": "dynamic-a2ui-v1",
        "request": request or "Create a launch summary.",
        "selected_kind": kind,
        "stream_notes": [
            {"phase": "schema", "status": "completed", "detail": "Selected an approved renderer type."},
            {"phase": "data", "status": "completed", "detail": "Filled deterministic fixture data."},
        ],
    }

    if kind == "comparison":
        component = {
            "type": "comparison",
            "title": "Deployment options",
            "options": [
                {"id": "managed", "label": "Managed Cloud", "price": "$240/mo", "fit": "Fastest setup", "score": 91},
                {"id": "self-hosted", "label": "Self hosted", "price": "$120/mo", "fit": "More control", "score": 84},
                {"id": "hybrid", "label": "Hybrid", "price": "$180/mo", "fit": "Balanced rollout", "score": 88},
            ],
        }
    elif kind == "form":
        component = {
            "type": "form",
            "title": "Launch intake",
            "fields": [
                {"id": "owner", "label": "Owner", "value": "Platform team"},
                {"id": "deadline", "label": "Deadline", "value": "2026-07-01"},
                {"id": "risk", "label": "Highest risk", "value": "Unverified runtime wiring"},
            ],
        }
    elif kind == "list":
        component = {
            "type": "list",
            "title": "Implementation checklist",
            "items": [
                {"id": "schema", "label": "Validate schema", "status": "done"},
                {"id": "renderer", "label": "Render approved component", "status": "done"},
                {"id": "fallback", "label": "Show unsupported fallback", "status": "done"},
            ],
        }
    else:
        component = {
            "type": "summary",
            "title": "Generated summary panel",
            "stats": [
                {"label": "Components", "value": "1"},
                {"label": "Allowed types", "value": "4"},
                {"label": "Fallbacks", "value": "0"},
            ],
            "body": "The backend selected one whitelisted renderer and supplied sanitized props.",
        }

    return {
        **base,
        "components": [component],
        "unsupported": {
            "type": "timeline",
            "title": "Unsupported node",
            "reason": "The frontend intentionally renders this through a fallback.",
        },
        "final_summary": f"Generated a {kind} UI from an allowlisted schema.",
    }


SYSTEM_PROMPT = (
    "You are the A2UI dynamic schema demo agent. Always call generate_dynamic_schema "
    "before answering. Describe which whitelisted component type was selected and "
    "mention that unsupported nodes use a fallback renderer."
)


def build_graph():
    return create_agent(
        model=create_llm(),
        tools=[generate_dynamic_schema],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


graph = build_graph()
