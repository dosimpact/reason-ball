"""Example 37: CopilotKit AG-UI human-in-the-loop graph."""

from __future__ import annotations

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent

from common.llm import create_llm


SYSTEM_PROMPT = (
    "You are the human-in-the-loop AG-UI demo agent. For any user request that "
    "asks you to draft, execute, approve, schedule, publish, send, deploy, or "
    "change a plan, you must first call the frontend tool named "
    "request_task_approval. Pass a concise title, exactly three proposed steps, "
    "a concrete risk note, and the action 'approve'. If the frontend returns an "
    "approved decision, complete the task using the returned steps. If it returns "
    "edited_and_approved, use the edited steps exactly. If it returns rejected, "
    "stop and state that the task was cancelled. Keep final responses short."
)


def build_graph():
    return create_agent(
        model=create_llm(),
        tools=[],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


graph = build_graph()
