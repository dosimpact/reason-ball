"""Example 16: user-scoped long-term memory with store operations."""
# 예제 개요: 사용자별 namespace로 장기 기억을 저장·조회·수정하는 예제입니다.
# 핵심 흐름: 대화 thread의 체크포인트와 별개인 BaseStore를 사용해 기억을 관리합니다.

from __future__ import annotations

import hashlib
from typing import Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph
from langgraph.store.base import BaseStore

from common.llm import create_llm


MemoryAction = Literal["create", "update", "delete", "recall"]


# 상태 및 UI 데이터 계약: 아래 타입들은 노드 사이에 전달하거나 화면에 표시할 데이터 구조입니다.
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


# LongTermMemoryState는 입력, 중간 결과, 최종 결과를 공유하는 그래프 상태입니다.
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


# 입력에서 지정한 기억 관리 작업을 사용자 namespace의 store에 적용합니다.
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


# 사용자 namespace의 기억을 조회해 이번 응답의 참조 자료로 준비합니다.
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


# 조회한 기억을 문맥에 넣어 답변을 생성합니다.
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


# 그래프 구성: 노드를 등록한 뒤 START/END 연결과 조건부 경로를 정의하고 실행 가능한 그래프로 컴파일합니다.
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


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()


# 단독 실행 데모: 이 파일을 직접 실행할 때만 샘플 입력으로 그래프를 호출합니다.
if __name__ == "__main__":
    from langgraph.store.memory import InMemoryStore

    demo = build_graph(store=InMemoryStore())
    print(demo.invoke({"user_id": "demo", "action": "create", "content": DEFAULT_CONTENT})["final"])
