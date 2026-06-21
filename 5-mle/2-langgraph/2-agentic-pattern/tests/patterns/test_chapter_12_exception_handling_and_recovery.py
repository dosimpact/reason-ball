from __future__ import annotations

import json

from langchain_core.messages import AIMessage

from agentic_design_patterns.patterns.chapter_12_exception_handling_and_recovery import (
    nodes,
)
from agentic_design_patterns.patterns.chapter_12_exception_handling_and_recovery.graph import (
    graph,
)


class FakeChatModel:
    def __init__(self, responses: list[str]) -> None:
        self.responses = list(responses)
        self.calls = []

    def invoke(self, messages):
        self.calls.append(messages)
        if not self.responses:
            raise AssertionError("Unexpected model invocation.")
        return AIMessage(content=self.responses.pop(0))


def _parse_response(address: str | None, city: str | None) -> str:
    return json.dumps({"address": address, "city": city})


def _patch_model(monkeypatch, address: str | None, city: str | None) -> FakeChatModel:
    fake_model = FakeChatModel([_parse_response(address, city)])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)
    return fake_model


def test_precise_lookup_success_finalizes_without_recovery(monkeypatch):
    fake_model = _patch_model(
        monkeypatch,
        "1600 Amphitheatre Parkway, Mountain View, CA",
        "Mountain View",
    )
    precise_calls = []

    def precise_lookup(address, state):
        precise_calls.append(address)
        return {"address": address, "confidence": 0.94}

    def fallback_lookup(city, state):
        raise AssertionError("fallback should not be called")

    monkeypatch.setattr(nodes, "precise_location_lookup", precise_lookup)
    monkeypatch.setattr(nodes, "general_area_lookup", fallback_lookup)

    result = graph.invoke(
        {"input": "Find precise details for 1600 Amphitheatre Parkway."}
    )

    assert result["final_output"]["status"] == "ok"
    assert result["final_output"]["result_source"] == "primary"
    assert result["primary_result"]["confidence"] == 0.94
    assert result["tool_errors"] == []
    assert result["retry_count"] == 0
    assert result["final_output"]["recovery_path"] == ["primary_success"]
    assert precise_calls == ["1600 Amphitheatre Parkway, Mountain View, CA"]
    assert len(fake_model.calls) == 1


def test_transient_error_retries_once_then_uses_primary_result(monkeypatch):
    _patch_model(
        monkeypatch,
        "1600 Amphitheatre Parkway, Mountain View, CA",
        "Mountain View",
    )
    precise_calls = []

    def precise_lookup(address, state):
        precise_calls.append(address)
        if len(precise_calls) == 1:
            raise TimeoutError("temporary timeout")
        return {"address": address, "confidence": 0.91}

    def fallback_lookup(city, state):
        raise AssertionError("fallback should not be called after retry success")

    monkeypatch.setattr(nodes, "precise_location_lookup", precise_lookup)
    monkeypatch.setattr(nodes, "general_area_lookup", fallback_lookup)

    result = graph.invoke(
        {"input": "Find precise details for 1600 Amphitheatre Parkway."}
    )

    assert result["final_output"]["status"] == "ok"
    assert result["retry_count"] == 1
    assert len(precise_calls) == 2
    assert result["tool_errors"][0]["category"] == "transient"
    assert result["tool_errors"][0]["retryable"] is True
    assert result["final_output"]["diagnostics"]["error_count"] == 1
    assert result["final_output"]["recovery_path"] == [
        "primary_failed",
        "retry_scheduled",
        "primary_success",
    ]


def test_repeated_transient_error_falls_back_to_general_area(monkeypatch):
    _patch_model(
        monkeypatch,
        "1600 Amphitheatre Parkway, Mountain View, CA",
        "Mountain View",
    )
    precise_calls = []
    fallback_calls = []

    def precise_lookup(address, state):
        precise_calls.append(address)
        raise TimeoutError("temporary timeout")

    def fallback_lookup(city, state):
        fallback_calls.append(city)
        return {
            "city": city,
            "summary": f"General area information for {city}.",
            "confidence": 0.64,
        }

    monkeypatch.setattr(nodes, "precise_location_lookup", precise_lookup)
    monkeypatch.setattr(nodes, "general_area_lookup", fallback_lookup)

    result = graph.invoke(
        {"input": "Find precise details for 1600 Amphitheatre Parkway."}
    )

    assert result["final_output"]["status"] == "degraded"
    assert result["final_output"]["result_source"] == "fallback"
    assert result["recovery_action"] == "degrade"
    assert result["retry_count"] == 1
    assert len(precise_calls) == 2
    assert fallback_calls == ["Mountain View"]
    assert [error["category"] for error in result["tool_errors"]] == [
        "transient",
        "transient",
    ]
    assert result["final_output"]["recovery_path"] == [
        "primary_failed",
        "retry_scheduled",
        "primary_failed",
        "fallback_success",
    ]


def test_not_found_skips_retry_and_uses_fallback(monkeypatch):
    _patch_model(monkeypatch, "Imaginary Tower, Paris", "Paris")
    fallback_calls = []

    def precise_lookup(address, state):
        raise nodes.LocationNotFoundError("precise location not found")

    def fallback_lookup(city, state):
        fallback_calls.append(city)
        return {"city": city, "summary": "General area information for Paris."}

    monkeypatch.setattr(nodes, "precise_location_lookup", precise_lookup)
    monkeypatch.setattr(nodes, "general_area_lookup", fallback_lookup)

    result = graph.invoke({"input": "Find Imaginary Tower, Paris."})

    assert result["final_output"]["status"] == "degraded"
    assert result["retry_count"] == 0
    assert fallback_calls == ["Paris"]
    assert result["tool_errors"][0]["category"] == "not_found"
    assert "retry_scheduled" not in result["final_output"]["recovery_path"]


def test_malformed_primary_output_is_classified_and_recovered(monkeypatch):
    _patch_model(monkeypatch, "1600 Amphitheatre Parkway, Mountain View, CA", "Mountain View")

    def precise_lookup(address, state):
        return {"value": address}

    def fallback_lookup(city, state):
        return {"city": city, "summary": "General area information for Mountain View."}

    monkeypatch.setattr(nodes, "precise_location_lookup", precise_lookup)
    monkeypatch.setattr(nodes, "general_area_lookup", fallback_lookup)

    result = graph.invoke(
        {"input": "Find precise details for 1600 Amphitheatre Parkway."}
    )

    assert result["final_output"]["status"] == "degraded"
    assert result["tool_errors"][0]["category"] == "malformed_output"
    assert result["tool_errors"][0]["operation"] == "precise_location_lookup"
    assert result["fallback_result"]["city"] == "Mountain View"


def test_severe_error_routes_to_escalation_without_fallback(monkeypatch):
    _patch_model(monkeypatch, "Restricted Facility, Mountain View, CA", "Mountain View")

    def precise_lookup(address, state):
        raise nodes.SevereLocationError("fatal provider integrity failure")

    def fallback_lookup(city, state):
        raise AssertionError("severe primary failure should not use fallback")

    monkeypatch.setattr(nodes, "precise_location_lookup", precise_lookup)
    monkeypatch.setattr(nodes, "general_area_lookup", fallback_lookup)

    result = graph.invoke({"input": "Find Restricted Facility in Mountain View."})

    assert result["final_output"]["status"] == "failed"
    assert result["final_output"]["needs_human_review"] is True
    assert result["recovery_action"] == "review"
    assert result["last_error"]["category"] == "severe"
    assert result["final_output"]["result_source"] is None
    assert result["final_output"]["recovery_path"] == [
        "primary_failed",
        "escalated_for_review",
    ]


def test_fallback_failure_returns_controlled_final_error(monkeypatch):
    _patch_model(monkeypatch, "Imaginary Tower, Paris", "Paris")

    def precise_lookup(address, state):
        raise nodes.LocationNotFoundError("precise location not found")

    def fallback_lookup(city, state):
        raise nodes.ServiceUnavailableError("area index unavailable")

    monkeypatch.setattr(nodes, "precise_location_lookup", precise_lookup)
    monkeypatch.setattr(nodes, "general_area_lookup", fallback_lookup)

    result = graph.invoke({"input": "Find Imaginary Tower, Paris."})

    assert result["final_output"]["status"] == "failed"
    assert result["final_output"]["needs_human_review"] is True
    assert result["final_output"]["result"] is None
    assert result["last_error"]["category"] == "service_unavailable"
    assert [error["category"] for error in result["tool_errors"]] == [
        "not_found",
        "service_unavailable",
    ]
    assert result["final_output"]["diagnostics"]["last_error"]["category"] == (
        "service_unavailable"
    )
    assert result["final_output"]["recovery_path"] == [
        "primary_failed",
        "fallback_failed",
        "recovery_failed",
    ]


def test_blank_input_stops_before_model_or_tools(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    def precise_lookup(address, state):
        raise AssertionError("precise lookup should not be called")

    def fallback_lookup(city, state):
        raise AssertionError("fallback lookup should not be called")

    monkeypatch.setattr(nodes, "precise_location_lookup", precise_lookup)
    monkeypatch.setattr(nodes, "general_area_lookup", fallback_lookup)

    result = graph.invoke({"input": "   "})

    assert result["final_output"]["status"] == "failed"
    assert result["final_output"]["needs_human_review"] is True
    assert result["last_error"]["category"] == "invalid_input"
    assert result["tool_errors"][0]["message"] == "Input is empty."
    assert result["final_output"]["recovery_path"] == [
        "request_rejected",
        "escalated_for_review",
    ]
    assert fake_model.calls == []
