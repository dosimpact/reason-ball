from __future__ import annotations

from langchain_core.messages import AIMessage, HumanMessage

from agentic_design_patterns.patterns.chapter_02_routing import nodes
from agentic_design_patterns.patterns.chapter_02_routing.graph import graph


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


def test_order_status_route(monkeypatch):
    fake_model = FakeChatModel(
        [
            '{"route": "order_status", "reason": "Order tracking request.", "confidence": 0.95}',
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "Where is order 12345?"})

    assert result["normalized_input"] == "Where is order 12345?"
    assert result["route"] == "order_status"
    assert result["route_confidence"] == 0.95
    assert "order status" in result["handler_output"].lower()
    assert result["final_output"] == result["handler_output"]
    assert result["errors"] == []
    assert [message.type for message in result["messages"]] == ["human", "ai"]
    assert result["messages"][0].content == "Where is order 12345?"
    assert result["messages"][-1].content == result["final_output"]
    assert len(fake_model.calls) == 1


def test_product_info_route(monkeypatch):
    fake_model = FakeChatModel(
        [
            '{"route": "product_info", "reason": "Compatibility question.", "confidence": 0.9}',
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {"input": "Does this laptop support two external monitors?"}
    )

    assert result["route"] == "product_info"
    assert "product information" in result["handler_output"].lower()
    assert "technical support" not in result["handler_output"].lower()


def test_technical_support_route(monkeypatch):
    fake_model = FakeChatModel(
        [
            '{"route": "technical_support", "reason": "Connectivity failure.", "confidence": 0.88}',
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "My device will not connect to Wi-Fi."})

    assert result["route"] == "technical_support"
    assert result["requires_human_review"] is False
    assert "technical support" in result["handler_output"].lower()


def test_clarification_route(monkeypatch):
    fake_model = FakeChatModel(
        [
            '{"route": "clarify", "reason": "Unclear reference.", "confidence": 0.8}',
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "Can you help me with that thing from yesterday?"})

    assert result["route"] == "clarify"
    assert "order, product information, or technical support" in result["final_output"]
    assert len(fake_model.calls) == 1


def test_malformed_router_output_routes_to_clarification(monkeypatch):
    fake_model = FakeChatModel(["I would probably send this to orders."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "Where is my shipment?"})

    assert result["route"] == "clarify"
    assert "invalid decision" in result["route_reason"]
    assert any("Malformed router output" in error for error in result["errors"])
    assert "order, product information, or technical support" in result["final_output"]


def test_low_confidence_route_falls_back_to_clarification(monkeypatch):
    fake_model = FakeChatModel(
        [
            '{"route": "product_info", "reason": "Maybe a product question.", "confidence": 0.2}',
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "Can you help with the thing?"})

    assert result["route"] == "clarify"
    assert result["route_confidence"] == 0.2
    assert any("below threshold" in error for error in result["errors"])
    assert "product information" in result["final_output"]


def test_custom_min_confidence_can_be_set_on_state(monkeypatch):
    fake_model = FakeChatModel(
        [
            '{"route": "product_info", "reason": "Product question.", "confidence": 0.7}',
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "Does this model support Bluetooth?",
            "min_route_confidence": 0.8,
        }
    )

    assert result["route"] == "clarify"
    assert result["route_confidence"] == 0.7
    assert any("below threshold" in error for error in result["errors"])


def test_blank_input_skips_model_and_asks_for_clarification(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "   "})

    assert result["route"] == "clarify"
    assert result["route_confidence"] == 0.0
    assert result["errors"] == ["Input is empty."]
    assert "Please describe" in result["final_output"]
    assert [message.type for message in result["messages"]] == ["ai"]
    assert fake_model.calls == []


def test_router_failure_retries_then_clarifies(monkeypatch):
    fake_model = FakeChatModel(
        [
            RuntimeError("temporary router outage"),
            '{"route": "technical_support", "reason": "Setup failure.", "confidence": 0.86}',
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "The app crashes during setup."})

    assert result["route"] == "technical_support"
    assert result["retry_count"] == 1
    assert len(fake_model.calls) == 2
    assert any("model invocation failed" in error for error in result["errors"])


def test_handler_exception_is_captured(monkeypatch):
    fake_model = FakeChatModel(
        [
            '{"route": "order_status", "reason": "Order lookup.", "confidence": 0.93}',
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)
    monkeypatch.setattr(
        nodes,
        "_order_status_response",
        lambda state: (_ for _ in ()).throw(RuntimeError("order service unavailable")),
    )

    result = graph.invoke({"input": "Where is order 12345?"})

    assert result["route"] == "order_status"
    assert "try again later" in result["final_output"]
    assert any("order_status_handler failed" in error for error in result["errors"])


def test_existing_messages_are_preserved_for_chat_state(monkeypatch):
    fake_model = FakeChatModel(
        [
            '{"route": "product_info", "reason": "Compatibility question.", "confidence": 0.9}',
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "Is it compatible with macOS?",
            "messages": [HumanMessage(content="Earlier question")],
        }
    )

    assert [message.type for message in result["messages"]] == ["human", "human", "ai"]
    assert result["messages"][0].content == "Earlier question"
    assert result["messages"][1].content == "Is it compatible with macOS?"
    assert result["messages"][2].content == result["final_output"]


def test_technical_support_can_require_human_review(monkeypatch):
    fake_model = FakeChatModel(
        [
            '{"route": "technical_support", "reason": "Safety issue.", "confidence": 0.96}',
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "My router is smoking and sparking."})

    assert result["route"] == "technical_support"
    assert result["requires_human_review"] is True
    assert "human review required" in result["final_output"].lower()
