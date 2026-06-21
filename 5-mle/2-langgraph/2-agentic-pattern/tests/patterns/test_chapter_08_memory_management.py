from __future__ import annotations

from langchain_core.messages import AIMessage

from agentic_design_patterns.patterns.chapter_08_memory_management import nodes
from agentic_design_patterns.patterns.chapter_08_memory_management.graph import (
    test_graph as graph,
)


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


def invoke_memory_graph(state: dict, thread_id: str):
    return graph.invoke(
        state,
        config={"configurable": {"thread_id": thread_id}},
    )


def test_stores_durable_travel_preferences(monkeypatch):
    fake_model = FakeChatModel(["I will remember those travel preferences."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = invoke_memory_graph(
        {
            "input": "Remember that I prefer morning flights and aisle seats.",
            "user_id": "chapter-08-store-user",
            "thread_id": "chapter-08-store-thread",
        },
        "chapter-08-store-thread",
    )

    assert result["status"] == "ok"
    assert result["approved_memory_updates"][0]["namespace"] == [
        "chapter-08-store-user",
        "travel",
    ]
    stored = result["memory_write_results"][0]
    assert stored["success"] is True
    assert stored["key"] == "preferences"
    assert stored["value"]["values"] == {
        "flight_time": "morning",
        "seat": "aisle",
    }
    assert result["final_output"]["stored_updates"] == [stored]
    assert fake_model.calls


def test_cross_thread_recall_uses_user_scoped_memory(monkeypatch):
    fake_model = FakeChatModel(
        [
            "Saved preferences.",
            "I will prioritize morning flights and aisle seats for Denver.",
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    invoke_memory_graph(
        {
            "input": "Remember that I prefer morning flights and aisle seats.",
            "user_id": "chapter-08-recall-user",
            "thread_id": "chapter-08-recall-thread-a",
        },
        "chapter-08-recall-thread-a",
    )
    result = invoke_memory_graph(
        {
            "input": "Find me a flight to Denver.",
            "user_id": "chapter-08-recall-user",
            "thread_id": "chapter-08-recall-thread-b",
        },
        "chapter-08-recall-thread-b",
    )

    assert result["status"] == "ok"
    assert result["retrieved_memories"][0]["namespace"] == [
        "chapter-08-recall-user",
        "travel",
    ]
    assert result["retrieved_memories"][0]["value"]["values"]["flight_time"] == "morning"
    assert result["retrieved_memories"][0]["value"]["values"]["seat"] == "aisle"
    assert result["final_output"]["response"] == (
        "I will prioritize morning flights and aisle seats for Denver."
    )
    assert result["skipped_memory_updates"] == [
        {
            "candidate": "Find me a flight to Denver.",
            "reason": "transient request, not durable memory",
        }
    ]
    second_prompt = fake_model.calls[1][1].content
    assert "morning" in second_prompt
    assert "aisle" in second_prompt


def test_updates_existing_memory_with_conflict_metadata(monkeypatch):
    fake_model = FakeChatModel(
        [
            "Saved preferences.",
            "I updated your seat preference to window.",
            "I will use window seats going forward.",
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    invoke_memory_graph(
        {
            "input": "Remember that I prefer morning flights and aisle seats.",
            "user_id": "chapter-08-update-user",
            "thread_id": "chapter-08-update-thread-a",
        },
        "chapter-08-update-thread-a",
    )
    update_result = invoke_memory_graph(
        {
            "input": "Actually, remember I prefer window seats.",
            "user_id": "chapter-08-update-user",
            "thread_id": "chapter-08-update-thread-b",
        },
        "chapter-08-update-thread-b",
    )
    recall_result = invoke_memory_graph(
        {
            "input": "Book a flight to Denver.",
            "user_id": "chapter-08-update-user",
            "thread_id": "chapter-08-update-thread-c",
        },
        "chapter-08-update-thread-c",
    )

    assert update_result["status"] == "ok"
    assert update_result["approved_memory_updates"][0]["conflicts"] == [
        {"field": "seat", "previous": "aisle", "new": "window"}
    ]
    assert update_result["memory_write_results"][0]["value"]["values"] == {
        "flight_time": "morning",
        "seat": "window",
    }
    assert recall_result["retrieved_memories"][0]["value"]["values"]["seat"] == "window"


def test_duplicate_memory_is_skipped_without_new_write(monkeypatch):
    fake_model = FakeChatModel(["Saved preferences.", "That preference is already noted."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    invoke_memory_graph(
        {
            "input": "Remember that I prefer morning flights.",
            "user_id": "chapter-08-duplicate-user",
            "thread_id": "chapter-08-duplicate-thread-a",
        },
        "chapter-08-duplicate-thread-a",
    )
    result = invoke_memory_graph(
        {
            "input": "Please remember I prefer morning flights.",
            "user_id": "chapter-08-duplicate-user",
            "thread_id": "chapter-08-duplicate-thread-b",
        },
        "chapter-08-duplicate-thread-b",
    )

    assert result["approved_memory_updates"] == []
    assert result["memory_write_results"] == []
    assert result["skipped_memory_updates"] == [
        {
            "candidate": {"flight_time": "morning"},
            "reason": "duplicate memory already stored",
        }
    ]


def test_sensitive_memory_routes_to_review_without_persistence(monkeypatch):
    fake_model = FakeChatModel(["I cannot save sensitive identity information."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = invoke_memory_graph(
        {
            "input": "Remember my passport number is X1234567.",
            "user_id": "chapter-08-sensitive-user",
            "thread_id": "chapter-08-sensitive-thread",
        },
        "chapter-08-sensitive-thread",
    )

    assert result["status"] == "needs_review"
    assert result["approved_memory_updates"] == []
    assert result["memory_write_results"] == []
    assert result["final_output"]["status"] == "needs_review"
    assert "Sensitive or regulated information" in result["review_reasons"][0]
    assert result["skipped_memory_updates"][0]["reason"] == (
        "sensitive memory requires review and was not persisted"
    )


def test_missing_memory_falls_back_without_writing_transient_request(monkeypatch):
    fake_model = FakeChatModel(["I can search for Denver flights without stored preferences."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = invoke_memory_graph(
        {
            "input": "Find me a flight to Denver.",
            "user_id": "chapter-08-missing-memory-user",
            "thread_id": "chapter-08-missing-memory-thread",
        },
        "chapter-08-missing-memory-thread",
    )

    assert result["status"] == "ok"
    assert result["retrieved_memories"] == []
    assert result["approved_memory_updates"] == []
    assert result["memory_write_results"] == []
    assert result["skipped_memory_updates"] == [
        {
            "candidate": "Find me a flight to Denver.",
            "reason": "transient request, not durable memory",
        }
    ]
    assert result["final_output"]["errors"] == []


def test_retrieval_error_is_reported_and_falls_back(monkeypatch):
    fake_model = FakeChatModel(["I will continue without personalization for this turn."])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = invoke_memory_graph(
        {
            "input": "Find me a hotel in Denver.",
            "user_id": "chapter-08-retrieval-error-user",
            "thread_id": "chapter-08-retrieval-error-thread",
            "metadata": {"force_retrieval_error": "memory store unavailable"},
        },
        "chapter-08-retrieval-error-thread",
    )

    assert result["status"] == "ok"
    assert result["retrieved_memories"] == []
    assert result["final_output"]["errors"] == [
        "retrieve_long_term_memory failed: memory store unavailable"
    ]
    assert result["final_output"]["response"] == (
        "I will continue without personalization for this turn."
    )


def test_short_term_context_is_checkpointed_and_compacted(monkeypatch):
    fake_model = FakeChatModel(
        [
            "First response.",
            "Second response with earlier context.",
            "Compacted response.",
        ]
    )
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    invoke_memory_graph(
        {
            "input": "Remember that I prefer quiet hotels with a gym.",
            "user_id": "chapter-08-short-term-user",
            "thread_id": "chapter-08-short-term-thread",
        },
        "chapter-08-short-term-thread",
    )
    second = invoke_memory_graph(
        {
            "input": "Also remember I prefer morning flights.",
            "user_id": "chapter-08-short-term-user",
            "thread_id": "chapter-08-short-term-thread",
        },
        "chapter-08-short-term-thread",
    )

    assert [message["role"] for message in second["messages"]] == [
        "user",
        "assistant",
        "user",
        "assistant",
    ]

    result = invoke_memory_graph(
        {
            "input": "Find a hotel and flight for Denver.",
            "user_id": "chapter-08-short-term-user",
            "thread_id": "chapter-08-compact-thread",
            "messages": [
                {"role": "user", "content": f"Earlier user message {index}"}
                for index in range(8)
            ],
        },
        "chapter-08-compact-thread",
    )

    assert result["short_term_summary"].startswith(
        "Earlier thread context compressed from"
    )
    assert len(result["prompt_context"]["recent_messages"]) == 6
    assert len(result["messages"]) == 7


def test_empty_input_fails_before_model_call(monkeypatch):
    fake_model = FakeChatModel([])
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = invoke_memory_graph(
        {
            "input": " ",
            "user_id": "chapter-08-empty-user",
            "thread_id": "chapter-08-empty-thread",
        },
        "chapter-08-empty-thread",
    )

    assert result["status"] == "failed"
    assert result["final_output"]["status"] == "failed"
    assert result["final_output"]["errors"] == ["Input is empty."]
    assert fake_model.calls == []
