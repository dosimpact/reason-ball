from __future__ import annotations

import json

from langchain_core.messages import AIMessage

from agentic_design_patterns.patterns.chapter_05_tool_use import nodes
from agentic_design_patterns.patterns.chapter_05_tool_use.graph import graph


class FakeChatModel:
    def __init__(self, responses: list[str | Exception]) -> None:
        self.responses = list(responses)
        self.calls = []

    def invoke(self, messages):
        self.calls.append(messages)
        if not self.responses:
            raise AssertionError("Unexpected model invocation.")
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return AIMessage(content=response)


def _answer(text: str) -> str:
    return json.dumps({"action": "answer", "answer": text})


def _tool_call(name: str, arguments: dict) -> str:
    return json.dumps(
        {
            "action": "tool_call",
            "tool_call": {"name": name, "arguments": arguments},
        }
    )


def test_direct_answer_path_does_not_execute_tools(monkeypatch):
    fake_model = FakeChatModel([_answer("No tool is needed for that request.")])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "Say hello without tools."})

    assert result["status"] == "ok"
    assert result["final_output"] == "No tool is needed for that request."
    assert result["tool_results"] == []
    assert result["tool_errors"] == []
    assert result["tool_call_count"] == 0
    assert len(fake_model.calls) == 1


def test_search_information_tool_execution_and_observation(monkeypatch):
    fake_model = FakeChatModel(
        [
            _tool_call("search_information", {"query": "capital of France"}),
            _answer("Paris is the capital of France."),
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "What is the capital of France?"})

    assert result["status"] == "ok"
    assert result["final_output"] == "Paris is the capital of France."
    assert result["tool_call_count"] == 1
    assert result["tool_results"] == [
        {
            "name": "search_information",
            "arguments": {"query": "capital of France"},
            "result": "Paris is the capital of France.",
            "status": "ok",
        }
    ]
    assert result["tool_errors"] == []
    assert [message["role"] for message in result["messages"]] == [
        "user",
        "assistant",
        "tool",
        "assistant",
        "assistant",
    ]
    assert len(fake_model.calls) == 2


def test_stock_price_tool_happy_path(monkeypatch):
    fake_model = FakeChatModel(
        [
            _tool_call("get_stock_price", {"ticker": "AAPL"}),
            _answer("The simulated stock price for AAPL is 178.15."),
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "What is the simulated AAPL price?"})

    assert result["status"] == "ok"
    assert result["tool_results"][0]["name"] == "get_stock_price"
    assert result["tool_results"][0]["result"] == 178.15
    assert result["final_output"] == "The simulated stock price for AAPL is 178.15."


def test_multi_step_tool_plan_preserves_observation_order(monkeypatch):
    fake_model = FakeChatModel(
        [
            _tool_call("get_stock_price", {"ticker": "AAPL"}),
            _tool_call("calculate_expression", {"expression": "(178.15 - 150) * 100"}),
            _answer("AAPL is 178.15. The simulated gain is 2815.00."),
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": (
                "What is the gain on 100 AAPL shares bought at 150 if "
                "the current price is AAPL's simulated price?"
            )
        }
    )

    assert result["status"] == "ok"
    assert result["tool_call_count"] == 2
    assert [item["name"] for item in result["tool_results"]] == [
        "get_stock_price",
        "calculate_expression",
    ]
    assert result["tool_results"][1]["result"] == 2815.0
    assert result["final_output"] == "AAPL is 178.15. The simulated gain is 2815.00."
    assert len(fake_model.calls) == 3


def test_unknown_tool_is_rejected_without_execution(monkeypatch):
    fake_model = FakeChatModel(
        [_tool_call("delete_customer_record", {"customer_id": "123"})]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "Delete customer record 123."})

    assert result["status"] == "failed"
    assert result["tool_results"] == []
    assert result["tool_call_count"] == 0
    assert result["tool_errors"][0]["error_type"] == "unknown_tool"
    assert "Unknown tool requested" in result["tool_errors"][0]["message"]
    assert "available tools" in result["final_output"]


def test_missing_tool_argument_is_schema_error(monkeypatch):
    fake_model = FakeChatModel([_tool_call("get_stock_price", {})])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "What is the AAPL price?"})

    assert result["status"] == "failed"
    assert result["tool_results"] == []
    assert result["tool_call_count"] == 0
    assert result["tool_errors"][0]["error_type"] == "schema_validation"
    assert "Missing required tool arguments: ticker." in result["final_output"]


def test_wrong_tool_argument_type_is_schema_error(monkeypatch):
    fake_model = FakeChatModel([_tool_call("calculate_expression", {"expression": 42})])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "Calculate 42."})

    assert result["status"] == "failed"
    assert result["tool_results"] == []
    assert result["tool_errors"][0]["error_type"] == "schema_validation"
    assert "must be str" in result["tool_errors"][0]["message"]


def test_tool_failure_returns_grounded_fallback(monkeypatch):
    fake_model = FakeChatModel([_tool_call("get_stock_price", {"ticker": "ZZZZ"})])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "What is the simulated ZZZZ price?"})

    assert result["status"] == "failed"
    assert result["tool_call_count"] == 1
    assert result["tool_results"] == []
    assert result["tool_errors"][0]["error_type"] == "tool_execution"
    assert "Unknown simulated ticker: ZZZZ." in result["final_output"]
    assert "178.15" not in result["final_output"]


def test_tool_call_limit_prevents_unbounded_loop(monkeypatch):
    fake_model = FakeChatModel(
        [
            _tool_call("search_information", {"query": "capital of France"}),
            _tool_call("search_information", {"query": "capital of France"}),
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "Keep searching.",
            "max_tool_calls": 1,
        }
    )

    assert result["status"] == "failed"
    assert result["tool_call_count"] == 1
    assert len(result["tool_results"]) == 1
    assert result["tool_errors"][0]["error_type"] == "tool_call_limit"
    assert result["requires_human_review"] is True


def test_side_effecting_tool_requires_confirmation(monkeypatch):
    def send_email(arguments):
        raise AssertionError("Side-effecting tool should not execute.")

    registry = dict(nodes.TOOL_REGISTRY)
    registry["send_email"] = nodes.ToolSpec(
        name="send_email",
        description="Send a simulated email.",
        required_arguments={"recipient": str, "body": str},
        handler=send_email,
        requires_confirmation=True,
    )
    monkeypatch.setattr(nodes, "TOOL_REGISTRY", registry)

    fake_model = FakeChatModel(
        [
            _tool_call(
                "send_email",
                {"recipient": "ops@example.com", "body": "deploy now"},
            )
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "Email ops@example.com to deploy now."})

    assert result["status"] == "needs_confirmation"
    assert result["requires_confirmation"] is True
    assert result["tool_call_count"] == 0
    assert result["tool_results"] == []
    assert "Confirmation required before executing send_email" in result["final_output"]


def test_blank_input_fails_before_model_call(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "   "})

    assert result["status"] == "failed"
    assert result["final_output"] == "Input is empty."
    assert result["tool_results"] == []
    assert fake_model.calls == []


def test_prose_only_tool_request_is_invalid_model_decision(monkeypatch):
    fake_model = FakeChatModel(["I should probably call the stock price tool."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "What is AAPL?"})

    assert result["status"] == "failed"
    assert result["tool_results"] == []
    assert result["tool_call_count"] == 0
    assert "Model decision must be JSON" in result["final_output"]
