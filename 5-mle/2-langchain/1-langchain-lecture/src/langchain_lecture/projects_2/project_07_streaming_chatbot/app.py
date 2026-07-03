"""토큰과 이벤트를 스트리밍하는 챗봇 예제입니다. 콘솔에서 바로 실행할 수 있는 예제 진입점입니다."""

from __future__ import annotations

from langchain_lecture.projects_2.project_07_streaming_chatbot.streaming_chatbot import (
    StreamingChatbot,
)
from langchain_lecture.shared.events import render_event


# 예제 실행 진입점입니다.
def main() -> None:
    question = "현재 시간 기준으로 오늘 할 일을 정리해줘"
    chatbot = StreamingChatbot()

    non_streaming = chatbot.invoke(question)
    print("Non-streaming:")
    print(non_streaming.answer)

    print("\nStreaming:")
    for event in chatbot.stream(question):
        print(render_event(event), end="" if event.type.value == "token" else "\n")


if __name__ == "__main__":
    main()
