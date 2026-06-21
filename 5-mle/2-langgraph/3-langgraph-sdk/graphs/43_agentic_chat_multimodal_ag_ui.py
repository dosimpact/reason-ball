"""Example 43: multimodal AG-UI chat graph."""

from __future__ import annotations

from typing import Any

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


@tool("record_image_observations")
def record_image_observations(subject: str, visible_text: str = "", colors: str = "") -> dict[str, Any]:
    """Record structured observations after inspecting an attached image."""
    clean_subject = subject.strip() or "attached image"
    return {
        "subject": clean_subject,
        "visible_text": visible_text.strip() or "No readable text reported.",
        "colors": colors.strip() or "No dominant colors reported.",
        "checks": [
            "main subject",
            "visible text",
            "layout or composition",
            "uncertainties",
        ],
    }


@tool("describe_text_only_request")
def describe_text_only_request(prompt: str) -> dict[str, Any]:
    """Handle text-only fallback requests in the same multimodal chat."""
    return {
        "prompt": prompt.strip() or "empty prompt",
        "mode": "text-only",
        "message": "No attachment is required for this response.",
    }


SYSTEM_PROMPT = (
    "You are a multimodal AG-UI chat assistant. If the user attaches an image, inspect it "
    "and summarize visible subject, text, colors, layout, and uncertainty. Then call "
    "record_image_observations with concise structured notes. If the message is text-only, "
    "call describe_text_only_request when useful and answer normally. Do not claim details "
    "that are not visible."
)


def build_graph():
    return create_agent(
        model=create_llm("fast"),
        tools=[record_image_observations, describe_text_only_request],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


graph = build_graph()
