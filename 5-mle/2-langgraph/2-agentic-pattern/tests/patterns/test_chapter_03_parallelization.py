from __future__ import annotations

import threading
import time

from langchain_core.messages import AIMessage

from agentic_design_patterns.patterns.chapter_03_parallelization import nodes
from agentic_design_patterns.patterns.chapter_03_parallelization.graph import graph


class DispatchingFakeChatModel:
    def __init__(
        self,
        *,
        responses: dict[str, str] | None = None,
        failures: dict[str, int] | None = None,
        delay_seconds: float = 0,
    ) -> None:
        self.responses = responses or {
            "summary": "Space exploration is the study and travel beyond Earth.",
            "questions": (
                "- What missions changed space exploration?\n"
                "- How did launch technology evolve?\n"
                "- What should future missions prioritize?"
            ),
            "key_terms": "Satellites, Rockets, Apollo, Mars, Orbit",
        }
        self.failures = dict(failures or {})
        self.delay_seconds = delay_seconds
        self.calls: list[dict[str, float | str | None]] = []
        self.call_counts: dict[str, int] = {}
        self._lock = threading.Lock()

    def invoke(self, messages):
        branch = self._branch_for(messages)
        call: dict[str, float | str | None] = {
            "branch": branch,
            "start": time.perf_counter(),
            "end": None,
        }
        with self._lock:
            self.calls.append(call)
            self.call_counts[branch] = self.call_counts.get(branch, 0) + 1
            call_number = self.call_counts[branch]

        try:
            if self.delay_seconds:
                time.sleep(self.delay_seconds)
            if call_number <= self.failures.get(branch, 0):
                raise RuntimeError(f"{branch} branch failed")
            return AIMessage(content=self.responses[branch])
        finally:
            with self._lock:
                call["end"] = time.perf_counter()

    def _branch_for(self, messages) -> str:
        system_text = str(messages[0].content).lower()
        if "summary branch" in system_text:
            return "summary"
        if "question branch" in system_text:
            return "questions"
        if "key terms branch" in system_text:
            return "key_terms"
        raise AssertionError(f"Unexpected prompt: {system_text}")


def test_parallelization_happy_path_fans_out_and_fans_in(monkeypatch):
    fake_model = DispatchingFakeChatModel(delay_seconds=0.05)
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "The history of space exploration"})

    assert result["status"] == "ok"
    assert result["summary"] == "Space exploration is the study and travel beyond Earth."
    assert result["questions"] == [
        "What missions changed space exploration?",
        "How did launch technology evolve?",
        "What should future missions prioritize?",
    ]
    assert result["key_terms"] == ["Satellites", "Rockets", "Apollo", "Mars", "Orbit"]
    assert sorted(result["completed_branches"]) == [
        "key_terms",
        "questions",
        "summary",
    ]
    assert result["branch_errors"] == []
    assert "Follow-up Questions:" in result["final_answer"]
    assert "Key Terms:" in result["final_answer"]

    starts = [float(call["start"]) for call in fake_model.calls]
    ends = [float(call["end"]) for call in fake_model.calls]
    assert len(fake_model.calls) == 3
    assert max(starts) < min(ends)


def test_empty_input_routes_to_failure_without_branch_calls(monkeypatch):
    fake_model = DispatchingFakeChatModel()
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke({"input": "   "})

    assert result["status"] == "failed"
    assert result["failure_reason"] == "Input topic is empty."
    assert "Input topic is empty." in result["final_answer"]
    assert fake_model.calls == []


def test_recoverable_branch_failure_preserves_successful_outputs(monkeypatch):
    fake_model = DispatchingFakeChatModel(failures={"key_terms": 1})
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "The history of space exploration",
            "branch_retry_limit": 0,
        }
    )

    assert result["status"] == "partial"
    assert result["summary"] == "Space exploration is the study and travel beyond Earth."
    assert result["questions"] == [
        "What missions changed space exploration?",
        "How did launch technology evolve?",
        "What should future missions prioritize?",
    ]
    assert result["key_terms"] == []
    assert result["branch_errors"] == [
        {
            "branch": "key_terms",
            "message": "key_terms branch failed",
            "attempts": 1,
        }
    ]
    assert sorted(result["completed_branches"]) == ["questions", "summary"]
    assert "Unavailable - key terms branch did not complete." in result["final_answer"]
    assert "partial synthesis" in result["final_answer"]


def test_required_branch_failure_routes_to_handle_failure_when_partial_disabled(
    monkeypatch,
):
    fake_model = DispatchingFakeChatModel(failures={"questions": 1})
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "The history of space exploration",
            "allow_partial_synthesis": False,
            "branch_retry_limit": 0,
        }
    )

    assert result["status"] == "failed"
    assert result["summary"] == "Space exploration is the study and travel beyond Earth."
    assert result["key_terms"] == ["Satellites", "Rockets", "Apollo", "Mars", "Orbit"]
    assert result["questions"] == []
    assert result["branch_errors"][0]["branch"] == "questions"
    assert "partial synthesis is disabled" in result["failure_reason"]
    assert "failed before it could safely synthesize" in result["final_answer"]


def test_branch_retry_can_recover_before_synthesis(monkeypatch):
    fake_model = DispatchingFakeChatModel(failures={"summary": 1})
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)

    result = graph.invoke(
        {
            "input": "The history of space exploration",
            "branch_retry_limit": 1,
        }
    )

    assert result["status"] == "ok"
    assert result["branch_errors"] == []
    assert fake_model.call_counts["summary"] == 2
    assert sorted(result["completed_branches"]) == [
        "key_terms",
        "questions",
        "summary",
    ]


def test_synthesis_ignores_branch_outputs_from_previous_run():
    result = nodes.synthesize_answer(
        {
            "input": "The history of space exploration",
            "allow_partial_synthesis": True,
            "started_at": time.perf_counter(),
            "metadata": {"run_id": "current-run"},
            "branch_outputs": {
                "summary": {
                    "run_id": "previous-run",
                    "value": "Stale summary from an earlier run.",
                    "attempts": 1,
                },
                "questions": {
                    "run_id": "current-run",
                    "value": ["What changed launch technology?"],
                    "attempts": 1,
                },
                "key_terms": {
                    "run_id": "current-run",
                    "value": ["Rockets", "Orbit"],
                    "attempts": 1,
                },
            },
        }
    )

    assert result["status"] == "partial"
    assert result["summary"] is None
    assert result["questions"] == ["What changed launch technology?"]
    assert result["key_terms"] == ["Rockets", "Orbit"]
    assert result["completed_branches"] == ["questions", "key_terms"]
    assert result["branch_errors"] == []
    assert "summary" in result["metadata"]["missing_branches"]
    assert "Stale summary" not in result["final_answer"]
