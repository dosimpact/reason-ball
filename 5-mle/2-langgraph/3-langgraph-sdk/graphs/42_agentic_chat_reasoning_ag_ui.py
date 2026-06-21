"""Example 42: AG-UI chat with public reasoning summaries."""

from __future__ import annotations

from typing import Any

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


@tool("publish_reasoning_summary")
def publish_reasoning_summary(task: str) -> dict[str, Any]:
    """Return a safe, public reasoning summary for the requested task."""
    topic = task.strip() or "the user request"
    return {
        "title": f"Public reasoning summary for {topic[:48]}",
        "steps": [
            "Identify the user-visible goal.",
            "Check whether a tool or direct answer is needed.",
            "Return a concise answer and separate any tool result from the final response.",
        ],
        "safety_note": "This is a public summary, not hidden chain-of-thought.",
    }


@tool("lookup_policy_fact")
def lookup_policy_fact(topic: str) -> dict[str, Any]:
    """Return a deterministic fact card used by the reasoning UI demo."""
    normalized = topic.strip() or "AG-UI reasoning"
    return {
        "topic": normalized,
        "fact": "Reasoning UI should expose concise public status summaries, not hidden chain-of-thought.",
        "confidence": 0.99,
    }


SYSTEM_PROMPT = (
    "You are an AG-UI reasoning demo assistant. When the user asks how you will solve "
    "something, call publish_reasoning_summary and show only a concise public summary. "
    "Never reveal hidden chain-of-thought. If the user asks for policy or implementation "
    "details, call lookup_policy_fact. Keep final answers separate from tool activity."
)


def build_graph():
    return create_agent(
        model=create_llm("fast"),
        tools=[publish_reasoning_summary, lookup_policy_fact],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


graph = build_graph()
