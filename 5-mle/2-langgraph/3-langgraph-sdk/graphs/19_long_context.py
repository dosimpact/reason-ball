"""Example 19: long-context chat with explicit summary compaction state."""

from __future__ import annotations

from datetime import datetime, UTC
from operator import add
from typing import Annotated, Any, TypedDict
from uuid import uuid4

from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, RemoveMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, MessagesState, StateGraph

from common.llm import create_llm


SUMMARIZE_AFTER = 8
KEEP_RECENT = 4


class MessageDigest(TypedDict):
    id: str
    role: str
    content: str
    index: int


class SummaryMetadata(TypedDict):
    compaction_id: str
    created_at: str
    source_message_range: str
    source_start_index: int
    source_end_index: int
    source_count: int
    retained_count: int
    retained_message_ids: list[str]
    removed_message_ids: list[str]
    summary_chars: int


class SummaryRecord(TypedDict):
    compaction_id: str
    created_at: str
    source_message_range: str
    source_count: int
    retained_count: int
    summary: str
    removed_messages: list[MessageDigest]
    retained_message_ids: list[str]


class ContextStats(TypedDict):
    summarize_after: int
    keep_recent: int
    total_messages: int
    retained_message_count: int
    summarized_message_count: int
    summary_record_count: int
    compaction_triggered: bool


class ContextEvent(TypedDict):
    type: str
    phase: str
    status: str
    detail: str
    compaction_id: str
    message_count: int
    retained_count: int
    removed_count: int


class LongContextState(MessagesState, total=False):
    summary: str
    summary_metadata: SummaryMetadata
    summary_records: Annotated[list[SummaryRecord], add]
    summarized_messages: Annotated[list[MessageDigest], add]
    context_events: Annotated[list[ContextEvent], add]
    context_stats: ContextStats
    last_compaction_run_id: str
    assistant_response: str
    final: str


def _content(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts: list[str] = []
        for block in value:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                text = block.get("text") or block.get("content")
                if isinstance(text, str):
                    parts.append(text)
        return "".join(parts)
    return str(value)


def _message_text(message: AnyMessage) -> str:
    return _content(getattr(message, "content", "")).strip()


def _role(message: AnyMessage) -> str:
    if isinstance(message, HumanMessage):
        return "human"
    if isinstance(message, AIMessage):
        return "ai"
    return getattr(message, "type", type(message).__name__).lower()


def _message_id(message: AnyMessage, index: int) -> str:
    return str(getattr(message, "id", "") or f"message-{index}")


def _digest(message: AnyMessage, index: int) -> MessageDigest:
    return {
        "id": _message_id(message, index),
        "role": _role(message),
        "content": _message_text(message),
        "index": index,
    }


def _event(
    phase: str,
    status: str,
    detail: str,
    *,
    compaction_id: str = "",
    message_count: int = 0,
    retained_count: int = 0,
    removed_count: int = 0,
) -> ContextEvent:
    return {
        "type": "context_status",
        "phase": phase,
        "status": status,
        "detail": detail,
        "compaction_id": compaction_id,
        "message_count": message_count,
        "retained_count": retained_count,
        "removed_count": removed_count,
    }


def _writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _stats(state: LongContextState, *, triggered: bool = False) -> ContextStats:
    messages = state.get("messages", [])
    return {
        "summarize_after": SUMMARIZE_AFTER,
        "keep_recent": KEEP_RECENT,
        "total_messages": len(messages),
        "retained_message_count": len(messages),
        "summarized_message_count": len(state.get("summarized_messages", [])),
        "summary_record_count": len(state.get("summary_records", [])),
        "compaction_triggered": triggered,
    }


def chat(state: LongContextState) -> dict:
    messages = state.get("messages", [])
    summary = state.get("summary", "")
    writer = _writer()
    started = _event(
        "chat",
        "running",
        f"Calling assistant with {len(messages)} retained messages.",
        message_count=len(messages),
        retained_count=len(messages),
    )
    writer(started)

    system_text = "You are a concise assistant for a LangGraph long-context demo."
    if summary:
        system_text += (
            "\n\nSummary of earlier conversation. Use it as context, but do not repeat it verbatim:\n"
            f"{summary}"
        )

    response = create_llm("fast").invoke([SystemMessage(content=system_text), *messages])
    answer = _content(response.content).strip()
    completed = _event(
        "chat",
        "succeeded",
        "Assistant response produced.",
        message_count=len(messages) + 1,
        retained_count=len(messages) + 1,
    )
    writer(completed)
    return {
        "messages": [response],
        "assistant_response": answer,
        "final": answer,
        "context_stats": {
            "summarize_after": SUMMARIZE_AFTER,
            "keep_recent": KEEP_RECENT,
            "total_messages": len(messages) + 1,
            "retained_message_count": len(messages) + 1,
            "summarized_message_count": len(state.get("summarized_messages", [])),
            "summary_record_count": len(state.get("summary_records", [])),
            "compaction_triggered": len(messages) + 1 > SUMMARIZE_AFTER,
        },
        "context_events": [started, completed],
    }


def route_after_chat(state: LongContextState) -> str:
    return "summarize" if len(state.get("messages", [])) > SUMMARIZE_AFTER else "finalize"


def summarize(state: LongContextState) -> dict:
    messages = state.get("messages", [])
    to_summarize = messages[:-KEEP_RECENT] if KEEP_RECENT > 0 else messages
    retained = messages[-KEEP_RECENT:] if KEEP_RECENT > 0 else []
    if not to_summarize:
        return {}

    compaction_id = f"ctx-{uuid4().hex[:10]}"
    created_at = datetime.now(UTC).isoformat(timespec="seconds")
    removed_digests = [_digest(message, index) for index, message in enumerate(to_summarize, start=1)]
    retained_ids = [_message_id(message, index) for index, message in enumerate(retained, start=len(to_summarize) + 1)]
    removed_ids = [item["id"] for item in removed_digests]
    source_range = f"1-{len(to_summarize)}"

    writer = _writer()
    started = _event(
        "summarize",
        "running",
        f"Compacting messages {source_range}; retaining {len(retained)} recent messages.",
        compaction_id=compaction_id,
        message_count=len(messages),
        retained_count=len(retained),
        removed_count=len(to_summarize),
    )
    writer(started)

    transcript_lines = [f"{item['index']}. {item['role']}: {item['content']}" for item in removed_digests]
    instruction = (
        "Summarize the conversation into 3-6 compact bullets. Preserve names, preferences, "
        "decisions, projects, and other facts needed for future turns."
    )
    previous_summary = state.get("summary", "")
    if previous_summary:
        instruction += f"\n\nExtend this previous summary instead of discarding it:\n{previous_summary}"

    response = create_llm("fast").invoke(
        [
            SystemMessage(content=instruction),
            HumanMessage(content="\n".join(transcript_lines)),
        ]
    )
    summary = _content(response.content).strip()
    removals = [RemoveMessage(id=message_id) for message_id in removed_ids if message_id]

    metadata: SummaryMetadata = {
        "compaction_id": compaction_id,
        "created_at": created_at,
        "source_message_range": source_range,
        "source_start_index": 1,
        "source_end_index": len(to_summarize),
        "source_count": len(to_summarize),
        "retained_count": len(retained),
        "retained_message_ids": retained_ids,
        "removed_message_ids": removed_ids,
        "summary_chars": len(summary),
    }
    record: SummaryRecord = {
        "compaction_id": compaction_id,
        "created_at": created_at,
        "source_message_range": source_range,
        "source_count": len(to_summarize),
        "retained_count": len(retained),
        "summary": summary,
        "removed_messages": removed_digests,
        "retained_message_ids": retained_ids,
    }
    completed = _event(
        "summarize",
        "compacted",
        f"Created summary from {len(to_summarize)} messages and removed them from active context.",
        compaction_id=compaction_id,
        message_count=len(messages),
        retained_count=len(retained),
        removed_count=len(to_summarize),
    )
    writer(completed)
    return {
        "summary": summary,
        "summary_metadata": metadata,
        "summary_records": [record],
        "summarized_messages": removed_digests,
        "messages": removals,
        "last_compaction_run_id": compaction_id,
        "context_events": [started, completed],
    }


def finalize(state: LongContextState) -> dict:
    messages = state.get("messages", [])
    metadata = state.get("summary_metadata")
    finalized = _event(
        "finalize",
        "succeeded",
        "Context state finalized.",
        compaction_id=metadata["compaction_id"] if metadata else "",
        message_count=len(messages),
        retained_count=len(messages),
        removed_count=metadata["source_count"] if metadata else 0,
    )
    _writer()(finalized)
    return {
        "context_stats": _stats(state, triggered=bool(metadata)),
        "context_events": [finalized],
        "final": state.get("assistant_response", ""),
    }


def build_graph():
    builder = StateGraph(LongContextState)
    builder.add_node("chat", chat)
    builder.add_node("summarize", summarize)
    builder.add_node("finalize", finalize)
    builder.add_edge(START, "chat")
    builder.add_conditional_edges(
        "chat",
        route_after_chat,
        {"summarize": "summarize", "finalize": "finalize"},
    )
    builder.add_edge("summarize", "finalize")
    builder.add_edge("finalize", END)
    return builder.compile()


graph = build_graph()

