"""네트워크 없이 테스트하기 위한 규칙 기반 응답 모델입니다."""

from __future__ import annotations

from collections.abc import Iterable

from langchain_core.messages import AIMessage, BaseMessage


def message_text(message: BaseMessage | object) -> str:
    content = getattr(message, "content", message)
    if isinstance(content, list):
        return " ".join(str(part) for part in content)
    return str(content)


def latest_human_text(messages: Iterable[BaseMessage | object]) -> str:
    latest = ""
    for message in messages:
        if getattr(message, "type", None) == "human" or getattr(message, "__class__", None).__name__ == "HumanMessage":
            latest = message_text(message)
    return latest


class KeywordResponder:
    def __init__(self, rules: dict[str, str] | None = None, default: str | None = None) -> None:
        self.rules = {key.lower(): value for key, value in (rules or {}).items()}
        self.default = default or "요청을 처리했습니다."

    def respond(self, text: str) -> str:
        lowered = text.lower()
        for keyword, response in self.rules.items():
            if keyword in lowered:
                return response
        return self.default

    def invoke(self, messages: Iterable[BaseMessage | object] | str) -> AIMessage:
        if isinstance(messages, str):
            text = messages
        else:
            text = latest_human_text(messages)
        return AIMessage(content=self.respond(text))
