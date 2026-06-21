"""Example 16: user-scoped long-term memory with store operations."""

from __future__ import annotations

import hashlib
from typing import Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph
from langgraph.store.base import BaseStore

from common.llm import create_llm


MemoryAction = Literal["create", "update", "delete", "recall"]


class MemoryRecord(TypedDict):
    id: str
    content: str
    namespace: str
    user_id: str
    source: str


class MemoryOperation(TypedDict):
    action: MemoryAction
    memory_id: str
    content: str
    status: str
    detail: str


class MemoryEvent(TypedDict):
    type: str
    action: str
    user_id: str
    memory_id: str
    detail: str


class LongTermMemoryState(TypedDict, total=False):
    user_id: str
    action: MemoryAction
    memory_id: str
    content: str
    thread_label: str
    thread_notes: list[str]
    memories: list[MemoryRecord]
    memory_operations: list[MemoryOperation]
    memory_events: list[MemoryEvent]
    namespace: list[str]
    assistant_response: str
    final: str
    trace: list[dict[str, Any]]


DEFAULT_USER_ID = "learner-001"
DEFAULT_CONTENT = "The learner prefers concise examples with visible graph state."


def _namespace(user_id: str) -> tuple[str, str, str]:
    return ("memories", "long-term-memory-ui", user_id)


def _memory_id(user_id: str, content: str) -> str:
    digest = hashlib.sha1(f"{user_id}:{content}".encode("utf-8")).hexdigest()[:12]
    return f"mem-{digest}"


def _item_content(value: Any) -> str:
    if isinstance(value, dict):
        data = value.get("content") or value.get("data")
        if isinstance(data, str):
            return data
    return str(value)


def _memory_record(item: Any, user_id: str) -> MemoryRecord:
    key = str(getattr(item, "key", "memory"))
    value = getattr(item, "value", {})
    return {
        "id": key,
        "content": _item_content(value),
        "namespace": "/".join(_namespace(user_id)),
        "user_id": user_id,
        "source": "BaseStore",
    }


def _snapshot(store: BaseStore, user_id: str) -> list[MemoryRecord]:
    items = store.search(_namespace(user_id), limit=25)
    records = [_memory_record(item, user_id) for item in items]
    return sorted(records, key=lambda item: item["id"])


def _event(action: str, user_id: str, memory_id: str, detail: str) -> MemoryEvent:
    return {
        "type": "memory_operation",
        "action": action,
        "user_id": user_id,
        "memory_id": memory_id,
        "detail": detail,
    }


def prepare(state: LongTermMemoryState) -> dict:
    user_id = (state.get("user_id") or DEFAULT_USER_ID).strip() or DEFAULT_USER_ID
    action = state.get("action", "recall")
    if action not in ("create", "update", "delete", "recall"):
        action = "recall"
    content = state.get("content", "").strip()
    memory_id = state.get("memory_id", "").strip()
    if action == "create" and not content:
        content = DEFAULT_CONTENT
    if action in ("create", "update") and not memory_id and content:
        memory_id = _memory_id(user_id, content)
    thread_label = state.get("thread_label", "Primary thread")
    note = f"{thread_label}: {action} requested for {user_id}."
    return {
        "user_id": user_id,
        "action": action,
        "content": content,
        "memory_id": memory_id,
        "thread_label": thread_label,
        "thread_notes": list(state.get("thread_notes", [])) + [note],
        "namespace": list(_namespace(user_id)),
        "trace": state.get("trace", [])
        + [
            {
                "node": "prepare",
                "event": "normalized",
                "action": action,
                "user_id": user_id,
            }
        ],
    }


def apply_memory_operation(state: LongTermMemoryState, *, store: BaseStore) -> dict:
    user_id = state.get("user_id", DEFAULT_USER_ID)
    action: MemoryAction = state.get("action", "recall")
    content = state.get("content", "")
    memory_id = state.get("memory_id", "")
    namespace = _namespace(user_id)
    writer = get_stream_writer()

    status = "skipped"
    detail = "Recall only; no store mutation requested."
    if action == "create":
        store.put(namespace, memory_id, {"content": content, "source": "ui"}, index=False)
        status = "stored"
        detail = "Created a user-scoped durable memory."
    elif action == "update":
        if memory_id and content:
            store.put(namespace, memory_id, {"content": content, "source": "ui"}, index=False)
            status = "updated"
            detail = "Updated an existing durable memory key."
        else:
            status = "error"
            detail = "Update requires both memory_id and content."
    elif action == "delete":
        if memory_id:
            store.delete(namespace, memory_id)
            status = "deleted"
            detail = "Deleted the selected durable memory key."
        else:
            status = "error"
            detail = "Delete requires memory_id."

    event = _event(action, user_id, memory_id, detail)
    writer(event)
    operation: MemoryOperation = {
        "action": action,
        "memory_id": memory_id,
        "content": content,
        "status": status,
        "detail": detail,
    }
    return {
        "memory_operations": list(state.get("memory_operations", [])) + [operation],
        "memory_events": list(state.get("memory_events", [])) + [event],
        "trace": state.get("trace", [])
        + [
            {
                "node": "apply_memory_operation",
                "event": status,
                "action": action,
                "memory_id": memory_id,
            }
        ],
    }


def recall_memories(state: LongTermMemoryState, *, store: BaseStore) -> dict:
    user_id = state.get("user_id", DEFAULT_USER_ID)
    memories = _snapshot(store, user_id)
    event = _event("recall", user_id, "", f"Loaded {len(memories)} memories for {user_id}.")
    get_stream_writer()(event)
    return {
        "memories": memories,
        "memory_events": list(state.get("memory_events", [])) + [event],
        "trace": state.get("trace", [])
        + [
            {
                "node": "recall_memories",
                "event": "recalled",
                "count": len(memories),
            }
        ],
    }


def respond_with_memory(state: LongTermMemoryState) -> dict:
    memories = state.get("memories", [])
    memory_lines = "\n".join(f"- {item['content']}" for item in memories) or "- No durable memories found."
    try:
        response = create_llm("fast").invoke(
            [
                SystemMessage(
                    content=(
                        "You explain what a LangGraph long-term memory store currently knows. "
                        "Keep the response under 80 words and mention whether the information "
                        "is thread-local or cross-thread durable memory."
                    )
                ),
                HumanMessage(
                    content=(
                        f"User id: {state.get('user_id', DEFAULT_USER_ID)}\n"
                        f"Thread notes: {state.get('thread_notes', [])}\n"
                        f"Durable memories:\n{memory_lines}"
                    )
                ),
            ]
        )
        assistant_response = response.content if isinstance(response.content, str) else str(response.content)
    except Exception as exc:  # pragma: no cover - provider failures are environment dependent
        assistant_response = f"Memory snapshot available, but the model response failed: {exc}"

    final = (
        f"{len(memories)} durable memories loaded for {state.get('user_id', DEFAULT_USER_ID)}. "
        f"{assistant_response}"
    )
    return {
        "assistant_response": assistant_response,
        "final": final,
        "trace": state.get("trace", [])
        + [
            {
                "node": "respond_with_memory",
                "event": "complete",
                "memory_count": len(memories),
            }
        ],
    }


def build_graph(store: BaseStore | None = None):
    builder = StateGraph(LongTermMemoryState)
    builder.add_node("prepare", prepare)
    builder.add_node("apply_memory_operation", apply_memory_operation)
    builder.add_node("recall_memories", recall_memories)
    builder.add_node("respond_with_memory", respond_with_memory)

    builder.add_edge(START, "prepare")
    builder.add_edge("prepare", "apply_memory_operation")
    builder.add_edge("apply_memory_operation", "recall_memories")
    builder.add_edge("recall_memories", "respond_with_memory")
    builder.add_edge("respond_with_memory", END)
    return builder.compile(store=store)


graph = build_graph()


if __name__ == "__main__":
    from langgraph.store.memory import InMemoryStore

    demo = build_graph(store=InMemoryStore())
    print(demo.invoke({"user_id": "demo", "action": "create", "content": DEFAULT_CONTENT})["final"])
