"""대화 기록을 저장하고 다시 사용하는 메모리 챗봇 예제입니다. 대화 메모리를 반영해 답변을 생성하는 챗봇 핵심 로직입니다."""

from __future__ import annotations

import re
from dataclasses import dataclass

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from langchain_lecture.projects_2.project_08_memory_chatbot.memory_store import (
    MemoryStore,
    ThreadSnapshot,
)
from langchain_lecture.shared.offline import message_text
from langchain_lecture.shared.safety import mask_pii


DEFAULT_THREAD_ID = "default"


@dataclass(frozen=True)
class ChatTurn:
    thread_id: str
    input: str
    answer: str
    checkpoint_id: int
    message_count: int
    summary: str
    facts: dict[str, str]


class StatelessChatbot:
    """Offline chatbot that answers only from the current prompt."""

    def ask(self, text: str) -> str:
        clean_text = mask_pii(text)
        facts = extract_facts(clean_text)
        return respond_to(clean_text, facts=facts, history=(), summary="")


class MemoryChatbot:
    """Offline chatbot with thread-scoped short-term memory."""

    def __init__(self, store: MemoryStore | None = None) -> None:
        self.store = store or MemoryStore()

    def ask(self, text: str, thread_id: str = DEFAULT_THREAD_ID) -> ChatTurn:
        clean_text = mask_pii(text)
        snapshot = self.store.get(thread_id)
        facts = dict(snapshot.facts)
        facts.update(extract_facts(clean_text))

        answer = respond_to(
            clean_text,
            facts=facts,
            history=snapshot.messages,
            summary=snapshot.summary,
        )
        saved = self.store.append(
            thread_id,
            [HumanMessage(content=clean_text), AIMessage(content=answer)],
            facts=facts,
        )
        return ChatTurn(
            thread_id=thread_id,
            input=clean_text,
            answer=answer,
            checkpoint_id=saved.checkpoint_id,
            message_count=len(saved.messages),
            summary=saved.summary,
            facts=dict(saved.facts),
        )

    def snapshot(self, thread_id: str = DEFAULT_THREAD_ID) -> ThreadSnapshot:
        return self.store.get(thread_id)

    def history_text(self, thread_id: str = DEFAULT_THREAD_ID) -> list[str]:
        return [message_text(message) for message in self.snapshot(thread_id).messages]


def extract_facts(text: str) -> dict[str, str]:
    facts: dict[str, str] = {}

    name = _first_match(
        text,
        [
            r"(?:내\s*이름은|제\s*이름은)\s*([가-힣A-Za-z][가-힣A-Za-z0-9_-]{0,30}?)(?:이야|야|입니다|이에요|예요|라고\s*해)?(?:[.!?,。]|$)",
            r"\bmy name is\s+([A-Za-z][A-Za-z0-9_-]{0,30})",
        ],
    )
    if name:
        facts["name"] = name

    location = _first_match(
        text,
        [
            r"(?:나는|저는|전)\s*([가-힣A-Za-z][가-힣A-Za-z\s-]{0,40}?)(?:에|에서)\s*(?:살아|삽니다|거주)",
            r"\bi live in\s+([A-Za-z][A-Za-z\s-]{1,40})",
        ],
    )
    if location:
        facts["location"] = location.strip()

    return facts


def respond_to(
    text: str,
    *,
    facts: dict[str, str],
    history: tuple[BaseMessage, ...],
    summary: str,
) -> str:
    lowered = text.lower()

    if _asks_name(text):
        name = facts.get("name")
        if name:
            return f"당신의 이름은 {name}입니다."
        return "아직 이 thread에서는 이름을 알지 못합니다."

    if _asks_location(text):
        location = facts.get("location")
        if location:
            return f"당신은 {location}에 살고 있습니다."
        return "아직 이 thread에서는 거주지를 알지 못합니다."

    if "name" in facts and ("이름은" in text or "my name is" in lowered):
        return f"{facts['name']}님, 이 thread에 이름을 기억해둘게요."

    if "location" in facts and ("살아" in text or "live in" in lowered or "거주" in text):
        return f"{facts['location']}에 산다는 내용을 이 thread에 기억해둘게요."

    if "langchain" in lowered and "memory" in lowered:
        return (
            "LangChain memory는 thread별 대화 상태를 저장해 후속 질문이 "
            "이전 맥락을 참조하도록 돕는 short-term state입니다."
        )

    if _asks_for_follow_up(text):
        topic = _recent_topic(history, summary)
        if topic == "LangChain memory":
            return (
                "예를 들어 같은 thread에서 '내 이름은 민수야'라고 말한 뒤 "
                "'내 이름이 뭐야?'라고 물으면 저장된 state에서 민수를 찾아 답합니다."
            )
        if summary:
            return f"앞서 저장된 요약을 바탕으로 답하면: {summary}"
        return "이 thread에 참고할 이전 맥락이 아직 없습니다."

    return "요청을 처리했습니다. 같은 thread라면 이 대화가 다음 답변의 맥락이 됩니다."


def _first_match(text: str, patterns: list[str]) -> str:
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip().rstrip(".!?,。")
    return ""


def _asks_name(text: str) -> bool:
    lowered = text.lower()
    return "내 이름이 뭐" in text or "what is my name" in lowered or "who am i" in lowered


def _asks_location(text: str) -> bool:
    lowered = text.lower()
    return (
        "어디에 살아" in text
        or "어디 살아" in text
        or "거주지" in text
        or "where do i live" in lowered
    )


def _asks_for_follow_up(text: str) -> bool:
    lowered = text.lower()
    return "아까" in text or "앞서" in text or "follow-up" in lowered or "example" in lowered


def _recent_topic(history: tuple[BaseMessage, ...], summary: str) -> str:
    joined = " ".join([summary.lower(), *(message_text(message).lower() for message in history)])
    if "langchain" in joined and "memory" in joined:
        return "LangChain memory"
    return ""
