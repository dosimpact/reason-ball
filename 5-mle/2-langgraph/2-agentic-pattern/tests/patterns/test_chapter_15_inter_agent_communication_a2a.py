from __future__ import annotations

import copy
from typing import Any

from langchain_core.messages import AIMessage

from agentic_design_patterns.patterns.chapter_15_inter_agent_communication_a2a import (
    nodes,
)
from agentic_design_patterns.patterns.chapter_15_inter_agent_communication_a2a.graph import (
    graph,
)


class FakeChatModel:
    def __init__(self, responses: list[str]) -> None:
        self.responses = list(responses)
        self.calls = []

    def invoke(self, messages):
        self.calls.append(messages)
        if not self.responses:
            raise AssertionError("Unexpected aggregation model invocation.")
        return AIMessage(content=self.responses.pop(0))


class ScriptedA2ATransport:
    def __init__(self, scripts: dict[str, Any] | None = None) -> None:
        self.scripts = copy.deepcopy(scripts or {})
        self.calls: list[dict[str, Any]] = []
        self.remote_task_agents: dict[str, str] = {}
        self.poll_counts: dict[str, int] = {}

    def send_task(
        self,
        endpoint: str,
        payload: dict[str, Any],
        credential_status: str = "not_required",
    ) -> dict[str, Any]:
        agent_id = payload["params"]["agent"]
        self.calls.append(
            {
                "method": "send_task",
                "endpoint": endpoint,
                "payload": copy.deepcopy(payload),
                "credential_status": credential_status,
            }
        )
        return self._next(
            f"send:{agent_id}",
            completed_response(
                payload["id"],
                "calendar",
                {"availability": "free from 13:00 to 17:00"},
                "Calendar shows you are free tomorrow afternoon.",
            ),
        )

    def start_task(
        self,
        endpoint: str,
        payload: dict[str, Any],
        credential_status: str = "not_required",
    ) -> dict[str, Any]:
        agent_id = payload["params"]["agent"]
        local_task_id = payload["id"]
        remote_task_id = f"remote-{local_task_id}"
        self.remote_task_agents[remote_task_id] = agent_id
        self.calls.append(
            {
                "method": "start_task",
                "endpoint": endpoint,
                "payload": copy.deepcopy(payload),
                "credential_status": credential_status,
            }
        )
        return self._next(
            f"start:{agent_id}",
            {
                "taskId": remote_task_id,
                "contextId": "ctx-test",
                "status": {"state": "working"},
                "messages": [
                    {
                        "role": "agent",
                        "parts": [{"kind": "text", "text": "Task accepted."}],
                    }
                ],
                "artifacts": [],
            },
        )

    def poll_task(self, endpoint: str, task_id: str) -> dict[str, Any]:
        agent_id = self.remote_task_agents.get(task_id, "weather_bot")
        self.calls.append(
            {
                "method": "poll_task",
                "endpoint": endpoint,
                "task_id": task_id,
            }
        )
        self.poll_counts[task_id] = self.poll_counts.get(task_id, 0) + 1
        local_task_id = task_id.removeprefix("remote-")
        default = (
            {"taskId": task_id, "status": {"state": "working"}, "artifacts": []}
            if self.poll_counts[task_id] == 1
            else completed_response(
                local_task_id,
                "weather",
                {"forecast": "clear, 22 C, low rain risk"},
                "Forecast is clear with low rain risk.",
                remote_task_id=task_id,
            )
        )
        return self._next(f"poll:{agent_id}", default)

    def stream_task(self, endpoint: str, task_id: str):
        agent_id = self.remote_task_agents.get(task_id, "weather_bot")
        self.calls.append(
            {
                "method": "stream_task",
                "endpoint": endpoint,
                "task_id": task_id,
            }
        )
        events = self._next(
            f"stream:{agent_id}",
            [
                {"taskId": task_id, "status": {"state": "working"}},
                completed_response(
                    task_id.removeprefix("remote-"),
                    "weather",
                    {"forecast": "clear, 22 C, low rain risk"},
                    "Forecast stream completed.",
                    remote_task_id=task_id,
                ),
            ],
        )
        for event in events:
            if isinstance(event, Exception):
                raise event
            yield copy.deepcopy(event)

    def _next(self, key: str, default: Any) -> Any:
        if key not in self.scripts:
            return copy.deepcopy(default)
        value = self.scripts[key]
        if isinstance(value, list):
            if not value:
                return copy.deepcopy(default)
            response = value.pop(0)
        else:
            response = value
        if isinstance(response, Exception):
            raise response
        return copy.deepcopy(response)


def install_fakes(
    monkeypatch,
    responses: list[str] | None = None,
    transport: ScriptedA2ATransport | None = None,
) -> tuple[FakeChatModel, ScriptedA2ATransport]:
    fake_model = FakeChatModel(responses or [])
    fake_transport = transport or ScriptedA2ATransport()
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)
    monkeypatch.setattr(nodes, "get_default_transport", lambda: fake_transport)
    return fake_model, fake_transport


def completed_response(
    task_id: str,
    artifact_name: str,
    data: dict[str, Any],
    message: str,
    remote_task_id: str | None = None,
) -> dict[str, Any]:
    return {
        "taskId": remote_task_id or task_id,
        "contextId": "ctx-test",
        "status": {"state": "completed"},
        "messages": [
            {
                "role": "agent",
                "parts": [{"kind": "text", "text": message}],
            }
        ],
        "artifacts": [
            {
                "name": artifact_name,
                "parts": [{"kind": "json", "json": data}],
            }
        ],
    }


def failed_response(task_id: str, message: str) -> dict[str, Any]:
    return {
        "taskId": task_id,
        "status": {"state": "failed", "error": {"message": message}},
        "messages": [],
        "artifacts": [],
    }


def input_required_response(task_id: str, question: str) -> dict[str, Any]:
    return {
        "taskId": task_id,
        "status": {
            "state": "input-required",
            "message": {
                "role": "agent",
                "parts": [{"kind": "text", "text": question}],
            },
        },
        "artifacts": [],
    }


def default_cards() -> dict[str, dict[str, Any]]:
    return copy.deepcopy(nodes._default_agent_cards())


def test_happy_path_builds_a2a_envelopes_routes_recipients_and_aggregates(
    monkeypatch,
):
    fake_model, fake_transport = install_fakes(
        monkeypatch,
        responses=[
            "You are free tomorrow afternoon, and the weather is good for an outdoor meeting."
        ],
    )

    result = graph.invoke(
        {
            "input": (
                "Check if I am free tomorrow afternoon and whether the weather "
                "is good for an outdoor meeting."
            ),
            "session_id": "session-chapter-15",
        }
    )

    calendar_task = "task-calendar-agent-check-availability"
    weather_task = "task-weather-bot-get-forecast"
    assert result["status"] == "ok"
    assert result["final_output"]["status"] == "ok"
    assert result["final_output"]["artifact_summary"] == {
        "calendar": "free from 13:00 to 17:00",
        "weather": "clear, 22 C, low rain risk",
    }
    assert result["interaction_modes"] == {
        calendar_task: "sync",
        weather_task: "polling",
    }
    assert result["task_statuses"][calendar_task] == "completed"
    assert result["task_statuses"][weather_task] == "completed"

    send_call = fake_transport.calls[0]
    start_call = fake_transport.calls[1]
    assert send_call["method"] == "send_task"
    assert send_call["endpoint"] == "https://calendar.example.test/a2a"
    assert send_call["payload"]["jsonrpc"] == "2.0"
    assert send_call["payload"]["method"] == "tasks/send"
    assert send_call["payload"]["params"]["sessionId"] == "session-chapter-15"
    assert send_call["payload"]["params"]["agent"] == "calendar_agent"
    assert send_call["payload"]["params"]["skill"] == "check_availability"
    assert send_call["payload"]["params"]["message"]["parts"] == [
        {
            "kind": "text",
            "text": (
                "Check if I am free tomorrow afternoon and whether the weather "
                "is good for an outdoor meeting."
            ),
        }
    ]
    assert "json" in send_call["payload"]["params"]["acceptedOutputModes"]

    assert start_call["method"] == "start_task"
    assert start_call["endpoint"] == "https://weather.example.test/a2a"
    assert start_call["payload"]["params"]["agent"] == "weather_bot"
    assert result["poll_attempts"][weather_task] == 2
    assert len(fake_model.calls) == 1


def test_malformed_agent_cards_are_rejected_before_delegation(monkeypatch):
    fake_model, fake_transport = install_fakes(monkeypatch)

    result = graph.invoke(
        {
            "input": "Check my calendar for tomorrow.",
            "agent_cards": {
                "broken_agent": {
                    "name": "Broken Agent",
                    "version": "1.0.0",
                    "skills": [{"id": "broken"}],
                }
            },
        }
    )

    assert result["status"] == "no_agents_available"
    assert result["validated_agent_cards"] == {}
    assert result["final_output"]["status"] == "no_agents_available"
    assert any("invalid endpoint URL" in error for error in result["errors"])
    assert fake_transport.calls == []
    assert fake_model.calls == []


def test_no_matching_skill_returns_without_remote_dispatch(monkeypatch):
    fake_model, fake_transport = install_fakes(monkeypatch)

    result = graph.invoke({"input": "Translate this paragraph into Spanish."})

    assert result["status"] == "no_matching_skill"
    assert result["delegation_plan"] == []
    assert result["final_output"]["answer"] == (
        "No advertised remote agent skill matches the request."
    )
    assert fake_transport.calls == []
    assert fake_model.calls == []


def test_missing_required_credentials_prevent_dispatch(monkeypatch):
    cards = default_cards()
    cards["calendar_agent"]["authentication"] = {
        "required": True,
        "scheme": "api_key",
        "credential_alias": "calendar_api_key",
    }
    fake_model, fake_transport = install_fakes(monkeypatch)

    result = graph.invoke(
        {
            "input": "Check whether I am free for a calendar meeting.",
            "agent_cards": {"calendar_agent": cards["calendar_agent"]},
        }
    )

    assert result["status"] == "auth_failed"
    assert result["credential_status"] == {"calendar_agent": "missing"}
    assert result["final_output"]["status"] == "auth_failed"
    assert "calendar_api_key" in result["errors"][0]
    assert fake_transport.calls == []
    assert fake_model.calls == []


def test_input_required_state_generates_pending_user_question(monkeypatch):
    transport = ScriptedA2ATransport(
        {
            "send:calendar_agent": input_required_response(
                "task-calendar-agent-check-availability",
                "Which date should I check?",
            )
        }
    )
    fake_model, fake_transport = install_fakes(monkeypatch, transport=transport)

    result = graph.invoke({"input": "Check my calendar availability."})

    assert result["status"] == "input_required"
    assert result["pending_user_questions"] == ["Which date should I check?"]
    assert result["final_output"]["pending_user_questions"] == [
        "Which date should I check?"
    ]
    assert result["task_statuses"]["task-calendar-agent-check-availability"] == (
        "input-required"
    )
    assert len(fake_transport.calls) == 1
    assert fake_model.calls == []


def test_remote_failure_with_successful_dependency_returns_partial_result(
    monkeypatch,
):
    weather_task = "task-weather-bot-get-forecast"
    transport = ScriptedA2ATransport(
        {"poll:weather_bot": [failed_response(f"remote-{weather_task}", "weather down")]}
    )
    fake_model, _ = install_fakes(
        monkeypatch,
        responses=["Calendar is available, but the weather agent failed."],
        transport=transport,
    )

    result = graph.invoke(
        {
            "input": (
                "Check calendar availability and weather for an outdoor meeting."
            )
        }
    )

    assert result["status"] == "partial"
    assert result["task_statuses"]["task-calendar-agent-check-availability"] == (
        "completed"
    )
    assert result["task_statuses"][weather_task] == "failed"
    assert result["final_output"]["artifact_summary"] == {
        "calendar": "free from 13:00 to 17:00"
    }
    assert any("weather down" in error for error in result["errors"])
    assert len(fake_model.calls) == 1


def test_polling_timeout_escalates_without_aggregation_model(monkeypatch):
    weather_task = "task-weather-bot-get-forecast"
    transport = ScriptedA2ATransport(
        {
            "poll:weather_bot": [
                {"taskId": f"remote-{weather_task}", "status": {"state": "working"}},
                {"taskId": f"remote-{weather_task}", "status": {"state": "working"}},
            ]
        }
    )
    fake_model, _ = install_fakes(monkeypatch, transport=transport)

    result = graph.invoke(
        {
            "input": "Give me the weather forecast for tomorrow.",
            "max_poll_attempts": 2,
        }
    )

    assert result["status"] == "failed"
    assert result["task_statuses"][weather_task] == "timeout"
    assert result["poll_attempts"][weather_task] == 2
    assert any("timed out" in error for error in result["errors"])
    assert fake_model.calls == []


def test_streaming_mode_records_events_and_normalizes_artifacts(monkeypatch):
    fake_model, fake_transport = install_fakes(
        monkeypatch,
        responses=["The streamed forecast is clear enough for outdoor plans."],
    )

    result = graph.invoke(
        {
            "input": "Stream the weather forecast for an outdoor plan.",
            "preferred_interaction_modes": {"weather_bot": "streaming"},
        }
    )

    weather_task = "task-weather-bot-get-forecast"
    assert result["status"] == "ok"
    assert result["interaction_modes"][weather_task] == "streaming"
    assert result["task_statuses"][weather_task] == "completed"
    assert len(result["stream_events"][weather_task]) == 2
    assert result["remote_artifacts"][weather_task][0]["parts"][0]["json"] == {
        "forecast": "clear, 22 C, low rain risk"
    }
    assert [call["method"] for call in fake_transport.calls] == [
        "start_task",
        "stream_task",
    ]
    assert len(fake_model.calls) == 1


def test_unsupported_interaction_mode_prevents_task_creation(monkeypatch):
    fake_model, fake_transport = install_fakes(monkeypatch)

    result = graph.invoke(
        {
            "input": "Check my calendar availability.",
            "preferred_interaction_modes": {"calendar_agent": "streaming"},
        }
    )

    calendar_task = "task-calendar-agent-check-availability"
    assert result["status"] == "unsupported"
    assert result["task_statuses"][calendar_task] == "unsupported"
    assert result["a2a_tasks"] == {}
    assert any("streaming support" in error for error in result["errors"])
    assert fake_transport.calls == []
    assert fake_model.calls == []


def test_malformed_artifact_is_rejected_and_routes_to_failure(monkeypatch):
    transport = ScriptedA2ATransport(
        {
            "send:calendar_agent": {
                "taskId": "task-calendar-agent-check-availability",
                "contextId": "ctx-test",
                "status": {"state": "completed"},
                "messages": [],
                "artifacts": [
                    {
                        "name": "calendar",
                        "parts": [{"kind": "image", "url": "file://bad.png"}],
                    }
                ],
            }
        }
    )
    fake_model, _ = install_fakes(monkeypatch, transport=transport)

    result = graph.invoke({"input": "Check my calendar availability."})

    assert result["status"] == "failed"
    assert result["task_statuses"]["task-calendar-agent-check-availability"] == (
        "malformed"
    )
    assert any("unsupported part kind" in error for error in result["errors"])
    assert result["final_output"]["artifact_summary"] == {}
    assert fake_model.calls == []
