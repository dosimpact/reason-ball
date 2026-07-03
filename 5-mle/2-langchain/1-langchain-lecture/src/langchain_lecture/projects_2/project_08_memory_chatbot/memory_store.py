"""대화 기록을 저장하고 다시 사용하는 메모리 챗봇 예제입니다. 세션별 대화 기록을 저장하고 조회하는 간단한 저장소입니다."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field

from langchain_core.messages import BaseMessage

from langchain_lecture.shared.offline import message_text


@dataclass(frozen=True)
class ThreadSnapshot:
    """Stored state for one conversation thread."""

    thread_id: str
    checkpoint_id: int = 0
    messages: tuple[BaseMessage, ...] = ()
    summary: str = ""
    facts: dict[str, str] = field(default_factory=dict)


class MemoryStore:
    """Small checkpointer-like store keyed by thread id.

    LangGraph checkpointers persist graph state per configurable thread. This
    class mirrors that behavior for a lecture-friendly offline chatbot: each
    write creates a new checkpoint number, keeps recent messages, and summarizes
    older messages once the short-term window is too large.
    """

    def __init__(self, max_messages: int = 8) -> None:
        if max_messages < 2:
            msg = "max_messages must be at least 2."
            raise ValueError(msg)
        self.max_messages = max_messages
        self._threads: dict[str, ThreadSnapshot] = {}

    def get(self, thread_id: str) -> ThreadSnapshot:
        snapshot = self._threads.get(thread_id)
        if snapshot is None:
            return ThreadSnapshot(thread_id=thread_id)
        return ThreadSnapshot(
            thread_id=snapshot.thread_id,
            checkpoint_id=snapshot.checkpoint_id,
            messages=tuple(snapshot.messages),
            summary=snapshot.summary,
            facts=dict(snapshot.facts),
        )

    def list_thread_ids(self) -> list[str]:
        return sorted(self._threads)

    def save(
        self,
        thread_id: str,
        messages: Iterable[BaseMessage],
        *,
        summary: str = "",
        facts: dict[str, str] | None = None,
    ) -> ThreadSnapshot:
        previous = self.get(thread_id)
        snapshot = ThreadSnapshot(
            thread_id=thread_id,
            checkpoint_id=previous.checkpoint_id + 1,
            messages=tuple(messages),
            summary=summary,
            facts=dict(facts or {}),
        )
        self._threads[thread_id] = snapshot
        return self.get(thread_id)

    def append(
        self,
        thread_id: str,
        new_messages: Iterable[BaseMessage],
        *,
        facts: dict[str, str] | None = None,
    ) -> ThreadSnapshot:
        previous = self.get(thread_id)
        merged_facts = dict(previous.facts)
        merged_facts.update(facts or {})

        messages = [*previous.messages, *new_messages]
        summary = previous.summary
        if len(messages) > self.max_messages:
            older = messages[: -self.max_messages]
            messages = messages[-self.max_messages :]
            summary = summarize_messages(summary, older, merged_facts)

        return self.save(
            thread_id,
            messages,
            summary=summary,
            facts=merged_facts,
        )

    def clear(self, thread_id: str | None = None) -> None:
        if thread_id is None:
            self._threads.clear()
            return
        self._threads.pop(thread_id, None)


def summarize_messages(
    previous_summary: str,
    messages: Iterable[BaseMessage],
    facts: dict[str, str],
) -> str:
    """Compress older turns into a deterministic summary string."""

    parts: list[str] = []
    if previous_summary:
        parts.extend(piece.strip() for piece in previous_summary.split(" | ") if piece.strip())

    if facts:
        facts_text = ", ".join(f"{key}={value}" for key, value in sorted(facts.items()))
        parts.append(f"Known facts: {facts_text}")

    topic = _topic_from_messages(messages)
    if topic:
        parts.append(f"Earlier topic: {topic}")

    return " | ".join(dict.fromkeys(parts))


def _topic_from_messages(messages: Iterable[BaseMessage]) -> str:
    texts = [message_text(message).lower() for message in messages]
    joined = " ".join(texts)
    if "langchain" in joined and "memory" in joined:
        return "LangChain memory"
    if any("이름" in text or "name" in text for text in texts):
        return "user name"
    if any("살" in text or "거주" in text or "live in" in text for text in texts):
        return "user location"
    return ""
