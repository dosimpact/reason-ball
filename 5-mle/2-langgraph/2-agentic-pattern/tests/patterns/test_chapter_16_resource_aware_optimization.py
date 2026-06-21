from __future__ import annotations

from typing import Any

from langchain_core.messages import AIMessage

from agentic_design_patterns.patterns.chapter_16_resource_aware_optimization import (
    nodes,
)
from agentic_design_patterns.patterns.chapter_16_resource_aware_optimization.graph import (
    graph,
)


class FakeChatModel:
    def __init__(self, responses: list[str | Exception]) -> None:
        self.responses = list(responses)
        self.calls: list[Any] = []

    def invoke(self, messages):
        self.calls.append(messages)
        if not self.responses:
            raise AssertionError("Unexpected model invocation.")
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return AIMessage(content=response)


def install_model(monkeypatch, responses: list[str | Exception]) -> FakeChatModel:
    fake_model = FakeChatModel(responses)
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)
    return fake_model


def test_graph_constructs_and_simple_query_uses_fast_path(monkeypatch):
    fake_model = install_model(monkeypatch, ["Canberra is the capital of Australia."])

    result = graph.invoke({"input": "What is the capital of Australia?"})

    assert result["final_output"]["status"] == "answered"
    assert result["classification"] == "simple"
    assert result["selected_path"]["id"] == "fast"
    assert result["model_tier"] == "fast"
    assert result["selected_tools"] == []
    assert result["resource_usage"]["estimated_cost_usd"] == 0.001
    assert result["resource_usage"]["tool_calls"] == 0.0
    assert result["fallback_used"] is False
    assert result["final_output"]["answer"] == "Canberra is the capital of Australia."
    assert len(fake_model.calls) == 1


def test_reasoning_query_uses_reasoning_path_when_budget_allows(monkeypatch):
    fake_model = install_model(
        monkeypatch,
        ["Strategy A has lower downside risk, while strategy B has higher upside."],
    )

    result = graph.invoke(
        {
            "input": "Compare the risk of two investment strategies under three scenarios.",
            "resource_limits": {"cost_usd": 0.05, "tokens": 5000, "time_ms": 5000},
        }
    )

    assert result["classification"] == "reasoning"
    assert result["selected_path"]["id"] == "reasoning"
    assert result["model_tier"] == "reasoning"
    assert result["final_output"]["status"] == "answered"
    assert len(fake_model.calls) == 1


def test_current_information_uses_search_then_grounded_model(monkeypatch):
    fake_model = install_model(
        monkeypatch,
        ["The fixture says the event starts on January 12, 2026."],
    )

    def search_tool(query: str) -> list[dict[str, str]]:
        return [
            {
                "title": "Australian Open fixture",
                "url": "https://example.test/open",
                "snippet": "The 2026 event starts on January 12, 2026.",
            }
        ]

    result = graph.invoke(
        {
            "input": "When does the Australian Open 2026 start?",
            "resource_limits": {"cost_usd": 0.05, "tokens": 5000, "tool_calls": 2, "time_ms": 5000},
            "search_tool": search_tool,
        }
    )

    assert result["classification"] == "current_info"
    assert result["selected_path"]["id"] == "grounded_search"
    assert result["selected_tools"] == ["search"]
    assert result["search_results"][0]["title"] == "Australian Open fixture"
    assert result["resource_usage"]["tool_calls"] == 1.0
    assert result["final_output"]["status"] == "answered"
    assert len(fake_model.calls) == 1


def test_current_information_with_search_disabled_degrades_without_fabrication(monkeypatch):
    fake_model = install_model(monkeypatch, [])

    result = graph.invoke(
        {
            "input": "What is the latest price today?",
            "allowed_capabilities": ["fast_model", "reasoning_model", "fallback", "critique"],
            "resource_limits": {"cost_usd": 0.01, "tokens": 1000, "tool_calls": 0, "time_ms": 1000},
        }
    )

    assert result["classification"] == "current_info"
    assert result["fallback_used"] is True
    assert result["final_output"]["status"] == "degraded"
    assert "cannot verify current information" in result["final_output"]["answer"]
    assert "Search is disabled" in result["final_output"]["degradation_reason"]
    assert fake_model.calls == []


def test_oversized_context_is_compressed_and_preserved(monkeypatch):
    fake_model = install_model(monkeypatch, ["The compressed context is enough to answer."])
    long_text = "Important policy context. " * 120

    result = graph.invoke(
        {
            "input": "Summarize the policy.",
            "context": [{"source": "policy", "text": long_text}],
        }
    )

    assert result["compressed_context"] is not None
    assert len(result["compressed_context"]) <= nodes.MAX_CONTEXT_CHARS
    assert "Important policy context" in result["compressed_context"]
    assert "summarizer" in result["selected_tools"]
    assert result["final_output"]["status"] == "answered"


def test_budget_exhaustion_prevents_model_and_tool_calls(monkeypatch):
    fake_model = install_model(monkeypatch, [])

    result = graph.invoke(
        {
            "input": "Compare the risk of two plans.",
            "resource_limits": {"cost_usd": 0.0, "tokens": 100, "tool_calls": 0, "time_ms": 100},
        }
    )

    assert result["final_output"]["status"] == "budget_exhausted"
    assert result["selected_path"] is None
    assert any("No execution path fits" in error for error in result["errors"])
    assert fake_model.calls == []


def test_primary_model_failure_routes_through_fallback(monkeypatch):
    fake_model = install_model(
        monkeypatch,
        [TimeoutError("primary timeout"), "Fallback answer from cheaper model."],
    )

    result = graph.invoke({"input": "What is the capital of Australia?"})

    assert result["fallback_used"] is True
    assert result["selected_path"]["id"] == "fallback"
    assert result["final_output"]["status"] == "degraded"
    assert result["final_output"]["answer"] == "Fallback answer from cheaper model."
    assert any("run_fast_model failed" in error for error in result["errors"])
    assert "handle_execution_failure" in [event["step"] for event in result["routing_trace"]]
    assert len(fake_model.calls) == 2


def test_fallback_chain_exhaustion_is_stable(monkeypatch):
    fake_model = install_model(monkeypatch, [RuntimeError("primary unavailable")])

    result = graph.invoke(
        {
            "input": "What is the capital of Australia?",
            "fallback_chain": [],
        }
    )

    assert result["final_output"]["status"] == "fallback_exhausted"
    assert result["fallback_used"] is True
    assert any("Fallback chain exhausted" in error for error in result["errors"])
    assert len(fake_model.calls) == 1


def test_low_critique_score_triggers_one_upgrade_when_budget_remains(monkeypatch):
    fake_model = install_model(
        monkeypatch,
        ["Too short.", "A fuller reasoning answer that satisfies the request."],
    )

    result = graph.invoke(
        {
            "input": "Explain routing.",
            "resource_limits": {"cost_usd": 0.05, "tokens": 5000, "time_ms": 5000},
        }
    )

    assert result["retry_count"] == 1
    assert result["classification"] == "reasoning"
    assert result["selected_path"]["id"] == "reasoning"
    assert result["final_output"]["answer"] == "A fuller reasoning answer that satisfies the request."
    assert len(fake_model.calls) == 2


def test_blank_input_fails_before_resource_execution(monkeypatch):
    fake_model = install_model(monkeypatch, [])

    result = graph.invoke({"input": "   "})

    assert result["final_output"]["status"] == "failed"
    assert result["final_output"]["answer"] == "The request could not be processed."
    assert result["errors"] == ["Input is empty."]
    assert fake_model.calls == []
