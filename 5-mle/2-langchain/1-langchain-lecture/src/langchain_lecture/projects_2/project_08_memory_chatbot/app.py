"""대화 기록을 저장하고 다시 사용하는 메모리 챗봇 예제입니다. 콘솔에서 바로 실행할 수 있는 예제 진입점입니다."""

from __future__ import annotations

from langchain_lecture.projects_2.project_08_memory_chatbot.memory_chatbot import (
    ChatTurn,
    MemoryChatbot,
    StatelessChatbot,
)
from langchain_lecture.projects_2.project_08_memory_chatbot.memory_store import MemoryStore


def run_demo() -> list[ChatTurn]:
    chatbot = MemoryChatbot(MemoryStore(max_messages=6))
    return [
        chatbot.ask("내 이름은 민수야", thread_id="demo-a"),
        chatbot.ask("나는 부산에 살아", thread_id="demo-a"),
        chatbot.ask("내 이름이 뭐야?", thread_id="demo-a"),
        chatbot.ask("나는 서울에 살아", thread_id="demo-b"),
        chatbot.ask("어디에 살아?", thread_id="demo-a"),
        chatbot.ask("어디에 살아?", thread_id="demo-b"),
    ]


def compare_stateless_and_stateful() -> dict[str, str]:
    stateless = StatelessChatbot()
    stateful = MemoryChatbot()
    stateless.ask("내 이름은 민수야")
    stateful.ask("내 이름은 민수야", thread_id="same-thread")

    return {
        "stateless": stateless.ask("내 이름이 뭐야?"),
        "stateful": stateful.ask("내 이름이 뭐야?", thread_id="same-thread").answer,
    }


# 예제 실행 진입점입니다.
def main() -> None:
    for turn in run_demo():
        print(f"[{turn.thread_id} #{turn.checkpoint_id}] {turn.answer}")


if __name__ == "__main__":
    main()
