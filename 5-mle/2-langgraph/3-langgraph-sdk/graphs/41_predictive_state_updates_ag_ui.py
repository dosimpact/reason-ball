"""Example 41: predictive document state updates with AG-UI."""

from __future__ import annotations

from typing import Any, Literal

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


Operation = Literal["rewrite_title", "improve_paragraph", "shorten", "append_summary"]


def _shorten(text: str) -> str:
    sentences = [part.strip() for part in text.replace("\n", " ").split(".") if part.strip()]
    if len(sentences) <= 2:
        return text.strip()
    return ". ".join(sentences[:2]) + "."


@tool("edit_document")
def edit_document(title: str, body: str, operation: Operation) -> dict[str, Any]:
    """Return a deterministic document patch for predictive state reconciliation."""
    clean_title = title.strip() or "Untitled launch note"
    clean_body = body.strip() or "Draft body."

    if operation == "rewrite_title":
        patch = {"title": f"{clean_title}: reviewed draft"}
        summary = "Rewrote the title while preserving the body."
    elif operation == "shorten":
        patch = {"body": _shorten(clean_body)}
        summary = "Shortened the body to the first two complete sentences."
    elif operation == "append_summary":
        patch = {"body": f"{clean_body}\n\nSummary: Keep the launch note focused, testable, and ready for review."}
        summary = "Appended a concise summary paragraph."
    else:
        patch = {
            "body": (
                clean_body
                + "\n\nRevision note: Clarified the outcome, owner, and next decision point."
            )
        }
        summary = "Improved the paragraph with a deterministic revision note."

    return {
        "operation": operation,
        "patch": patch,
        "summary": summary,
        "confirmation": "Use the frontend apply_document_update tool to reconcile this patch into visible state.",
    }


@tool("explain_revision")
def explain_revision(revision: int, last_operation: str) -> dict[str, Any]:
    """Explain the current document revision status."""
    return {
        "revision": revision,
        "last_operation": last_operation or "none",
        "status": "confirmed",
    }


SYSTEM_PROMPT = (
    "You are a document editing copilot for an AG-UI predictive state demo. "
    "React provides current document state in context. Use edit_document for deterministic "
    "patches. After choosing a patch, call the frontend apply_document_update tool so the "
    "browser can reconcile pending optimistic state with backend-confirmed state. Do not "
    "invent hidden edits; describe the visible revision number and operation."
)


def build_graph():
    return create_agent(
        model=create_llm("fast"),
        tools=[edit_document, explain_revision],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


graph = build_graph()
