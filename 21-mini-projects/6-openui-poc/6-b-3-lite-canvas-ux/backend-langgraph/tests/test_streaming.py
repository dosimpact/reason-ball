# 모델과 도구 이벤트를 직접 주입해 AG-UI 변환 규약을 검사합니다.
# 텍스트 연결, 도구 인자 누적, 오류, 중복 방지와 하위 실행 분리를 검증합니다.
"""Regression tests for the Python-to-AG-UI protocol boundary."""

import json

from langchain_core.messages import HumanMessage, ToolMessage

from agent.streaming import OpenUIStreamTransformer


def capture():
    transformer = OpenUIStreamTransformer()
    events = []
    transformer.channel.push = events.append
    return transformer, events


def message(transformer, data, run="model-1", namespace=()):
    transformer.process(
        {
            "method": "messages",
            "params": {
                "namespace": namespace,
                "data": (data, {"run_id": run}),
            },
        }
    )


def start(transformer, run="model-1", role=None):
    data = {"event": "message-start", "id": run}
    if role:
        data["role"] = role
    message(transformer, data, run)


def text(transformer, value, run="model-1"):
    message(
        transformer,
        {
            "event": "content-block-delta",
            "index": 0,
            "delta": {"type": "text-delta", "text": value},
        },
        run,
    )


def test_python_tuple_stream_closes_text_once():
    t, events = capture()
    start(t)
    text(t, "Hello ")
    text(t, "world")
    message(t, {"event": "message-finish"})
    t.finalize()
    assert [e["type"] for e in events] == [
        "TEXT_MESSAGE_START",
        "TEXT_MESSAGE_CONTENT",
        "TEXT_MESSAGE_CONTENT",
        "TEXT_MESSAGE_END",
    ]
    assert "".join(e.get("delta", "") for e in events) == "Hello world"


def test_replayed_user_and_whole_messages_are_not_echoed():
    t, events = capture()
    message(t, HumanMessage(content="user history"))
    start(t, role="user")
    text(t, "user history")
    t.finalize()
    assert events == []


def test_interleaved_model_runs_keep_separate_message_ids():
    t, events = capture()
    start(t, "a")
    start(t, "b")
    text(t, "A", "a")
    text(t, "B", "b")
    t.finalize()
    assert [(e["messageId"], e["delta"]) for e in events if "delta" in e] == [
        ("a", "A"),
        ("b", "B"),
    ]


def test_tool_snapshots_emit_only_new_args_and_unwrap_python_result():
    t, events = capture()
    start(t)
    message(
        t,
        {
            "event": "content-block-start",
            "index": 0,
            "content": {
                "type": "tool_call",
                "id": "call-1",
                "name": "get_weather",
                "args": "",
            },
        },
    )
    for args in ['{"location":', '{"location":"Tokyo"}']:
        message(
            t,
            {
                "event": "content-block-delta",
                "index": 0,
                "delta": {"type": "block-delta", "fields": {"args": args}},
            },
        )
    message(
        t,
        {
            "event": "content-block-finish",
            "index": 0,
            "content": {"type": "tool_call", "args": {"location": "Tokyo"}},
        },
    )
    result = {
        "method": "tools",
        "params": {
            "namespace": [],
            "data": {
                "event": "tool-finished",
                "tool_call_id": "call-1",
                "output": ToolMessage(
                    content='{"temperature":22}', tool_call_id="call-1"
                ),
            },
        },
    }
    t.process(result)
    t.process(result)
    assert json.loads(
        "".join(e["delta"] for e in events if e["type"] == "TOOL_CALL_ARGS")
    ) == {"location": "Tokyo"}
    assert len([e for e in events if e["type"] == "TOOL_CALL_END"]) == 1
    assert [e["content"] for e in events if e["type"] == "TOOL_CALL_RESULT"] == [
        '{"temperature":22}'
    ]


def test_error_closes_open_message_and_emits_one_run_error():
    t, events = capture()
    start(t)
    text(t, "partial")
    t.fail(RuntimeError("provider failed"))
    t.fail(RuntimeError("provider failed"))
    assert [e["type"] for e in events][-2:] == ["TEXT_MESSAGE_END", "RUN_ERROR"]
    assert sum(e["type"] == "RUN_ERROR" for e in events) == 1


def test_tool_error_is_marked_as_error():
    t, events = capture()
    t.process(
        {
            "method": "tools",
            "params": {
                "namespace": [],
                "data": {
                    "event": "tool-error",
                    "tool_call_id": "broken",
                    "message": "unavailable",
                },
            },
        }
    )
    assert events[0]["isError"] is True
    assert events[0]["content"] == "unavailable"


def test_nested_transformer_does_not_duplicate_root_events():
    t = OpenUIStreamTransformer(("nested",))
    events = []
    t.channel.push = events.append
    start(t)
    text(t, "duplicate")
    t.fail(RuntimeError("nested failure"))
    t.finalize()
    assert events == []


def test_builtin_command_tool_result_is_serializable():
    from langgraph.types import Command

    t, events = capture()
    t.process(
        {
            "method": "tools",
            "params": {
                "namespace": [],
                "data": {
                    "event": "tool-finished",
                    "tool_call_id": "todo-1",
                    "output": Command(
                        update={"todos": [{"content": "demo", "status": "completed"}]}
                    ),
                },
            },
        }
    )
    assert (
        json.loads(events[0]["content"])["update"]["todos"][0]["status"] == "completed"
    )
