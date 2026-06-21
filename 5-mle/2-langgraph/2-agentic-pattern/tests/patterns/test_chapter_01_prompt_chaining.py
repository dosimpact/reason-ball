from __future__ import annotations

from langchain_core.messages import AIMessage

from agentic_design_patterns.patterns.chapter_01_prompt_chaining import nodes
from agentic_design_patterns.patterns.chapter_01_prompt_chaining.graph import graph


class FakeChatModel:
    def __init__(self, responses: list[str]) -> None:
        self.responses = list(responses)
        self.calls = []

    def invoke(self, messages):
        self.calls.append(messages)
        if not self.responses:
            raise AssertionError("Unexpected model invocation.")
        return AIMessage(content=self.responses.pop(0))


def test_prompt_chaining_happy_path(monkeypatch):
    fake_model = FakeChatModel(
        [
            "CPU: 3.5 GHz octa-core processor; Memory: 16GB RAM; Storage: 1TB NVMe SSD",
            '{"cpu": "3.5 GHz octa-core processor", "memory": "16GB RAM", "storage": "1TB NVMe SSD"}',
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": (
                "The laptop includes a 3.5 GHz octa-core processor, "
                "16GB RAM, and a 1TB NVMe SSD."
            )
        }
    )

    assert result["status"] == "ok"
    assert result["final_output"]["status"] == "ok"
    assert result["specifications"]["cpu"] == "3.5 GHz octa-core processor"
    assert result["specifications"]["memory"] == "16GB RAM"
    assert result["specifications"]["storage"] == "1TB NVMe SSD"
    assert result["missing_fields"] == []
    assert result["validation_errors"] == []
    assert len(fake_model.calls) == 2
    assert [item["step"] for item in result["intermediate_artifacts"]] == [
        "prepare_input",
        "extract_specs",
        "transform_to_json",
        "validate_output",
        "finalize",
    ]


def test_malformed_json_routes_through_repair(monkeypatch):
    fake_model = FakeChatModel(
        [
            "CPU: 3.5 GHz octa-core processor; Memory: 16GB RAM; Storage: 1TB NVMe SSD",
            '{"cpu": "3.5 GHz octa-core processor", "memory": "16GB RAM"',
            '{"cpu": "3.5 GHz octa-core processor", "memory": "16GB RAM", "storage": "1TB NVMe SSD"}',
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": (
                "The laptop includes a 3.5 GHz octa-core processor, "
                "16GB RAM, and a 1TB NVMe SSD."
            )
        }
    )

    assert result["status"] == "ok"
    assert result["retry_count"] == 1
    assert result["final_output"]["retry_count"] == 1
    assert len(fake_model.calls) == 3
    assert "repair_output" in [
        item["step"] for item in result["intermediate_artifacts"]
    ]


def test_missing_required_field_ends_in_needs_review(monkeypatch):
    fake_model = FakeChatModel(
        [
            "CPU: 3.5 GHz octa-core processor; Memory: 16GB RAM",
            '{"cpu": "3.5 GHz octa-core processor", "memory": "16GB RAM", "storage": null}',
            '{"cpu": "3.5 GHz octa-core processor", "memory": "16GB RAM", "storage": null}',
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": (
                "The laptop includes a 3.5 GHz octa-core processor "
                "and 16GB RAM."
            )
        }
    )

    assert result["status"] == "needs_review"
    assert result["final_output"]["status"] == "needs_review"
    assert result["missing_fields"] == ["storage"]
    assert result["retry_count"] == 1
    assert result["final_output"]["retry_count"] == 1


def test_empty_input_fails_before_model_call(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "   "})

    assert result["status"] == "failed"
    assert result["final_output"]["status"] == "failed"
    assert result["missing_fields"] == ["cpu", "memory", "storage"]
    assert result["validation_errors"] == ["Input is empty."]
    assert fake_model.calls == []


def test_retry_count_does_not_exceed_max_retries(monkeypatch):
    fake_model = FakeChatModel(
        [
            "CPU: 3.5 GHz octa-core processor; Memory: 16GB RAM",
            '{"cpu": "3.5 GHz octa-core processor", "memory": "16GB RAM", "storage": null}',
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": (
                "The laptop includes a 3.5 GHz octa-core processor "
                "and 16GB RAM."
            ),
            "max_retries": 0,
        }
    )

    assert result["status"] == "needs_review"
    assert result["retry_count"] == 0
    assert len(fake_model.calls) == 2
