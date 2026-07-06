from __future__ import annotations

from langchain_lecture.projects_2.project_07_streaming_chatbot.graph import (
    streaming_chatbot_node,
)
from langchain_lecture.projects_2.project_07_streaming_chatbot.streaming_chatbot import (
    StreamingChatbot,
    collect_stream,
)
from langchain_lecture.shared.events import EventType


def test_invoke_returns_final_answer_without_stream_events():
    response = StreamingChatbot().invoke("LangChain streaming을 5문장으로 설명해줘")

    assert response.answer
    assert response.error == ""
    assert response.events[-1].type == EventType.DONE
    assert [event.type for event in response.events] == [EventType.DONE]


def test_stream_emits_typed_token_and_custom_events():
    response = collect_stream("LangChain streaming을 5문장으로 설명해줘")
    event_types = [event.type for event in response.events]

    assert EventType.CUSTOM in event_types
    assert EventType.TOKEN in event_types
    assert response.events[-1].type == EventType.DONE
    assert "".join(event.content for event in response.events if event.type == EventType.TOKEN).strip()


def test_stream_separates_tool_progress_from_final_answer():
    response = collect_stream("현재 시간 기준으로 오늘 할 일을 정리해줘")
    tool_events = [
        event
        for event in response.events
        if event.type in {EventType.TOOL_START, EventType.TOOL_RESULT}
    ]

    assert [event.type for event in tool_events] == [
        EventType.TOOL_START,
        EventType.TOOL_RESULT,
        EventType.TOOL_START,
        EventType.TOOL_RESULT,
    ]
    assert response.answer.startswith("2026-07-02 09:00 UTC 기준")
    assert response.error == ""


def test_stream_handles_tool_error_with_done_status():
    response = collect_stream("tool-error 입력으로 실패를 보여줘")

    assert any(event.type == EventType.ERROR for event in response.events)
    assert response.events[-1].type == EventType.DONE
    assert response.events[-1].metadata == {"status": "error"}
    assert "ToolExecutionError" in response.error


def test_stream_modes_filter_event_categories():
    response = collect_stream(
        "현재 시간 기준으로 오늘 할 일을 정리해줘",
        stream_modes=["updates"],
    )
    event_types = {event.type for event in response.events}

    assert EventType.TOOL_START in event_types
    assert EventType.TOOL_RESULT in event_types
    assert EventType.TOKEN not in event_types
    assert EventType.CUSTOM not in event_types
    assert response.events[-1].type == EventType.DONE


def test_graph_node_returns_rendered_events_and_answer():
    result = streaming_chatbot_node({"question": "RAG 시스템의 문제 해결 절차를 자세히 설명해줘"})

    assert result["answer"]
    assert result["error"] == ""
    assert result["events"][-1].startswith("[done]")
