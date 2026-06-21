"""Example 39: CopilotKit AG-UI tool-based generative UI graph."""

from __future__ import annotations

from typing import Any

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


@tool("generate_haiku_card")
def generate_haiku_card(topic: str, mood: str = "calm") -> dict[str, Any]:
    """Generate a deterministic haiku card payload for frontend rendering."""

    clean_topic = topic.strip() or "LangGraph"
    clean_mood = mood.strip() or "calm"

    return {
        "topic": clean_topic,
        "mood": clean_mood,
        "palette": {
            "background": "#f7efe2",
            "accent": "#256f68",
            "text": "#1d2b2a",
        },
        "lines": [
            f"{clean_topic[:18]} wakes",
            "Signals flow through patient graphs",
            "Small tools shape the screen",
        ],
        "explanation": (
            "The backend tool returns the haiku, visual palette, and explanation "
            "as structured UI data."
        ),
    }


SYSTEM_PROMPT = (
    "You are the tool-based generative UI demo agent. When the user asks for a "
    "haiku, poem card, generated card, mood card, or visual poem, always call "
    "generate_haiku_card. After the tool returns, summarize the card mood in one "
    "short sentence. For unrelated questions, answer briefly."
)


def build_graph():
    return create_agent(
        model=create_llm(),
        tools=[generate_haiku_card],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


graph = build_graph()
