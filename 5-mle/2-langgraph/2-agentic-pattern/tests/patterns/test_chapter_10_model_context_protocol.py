from __future__ import annotations

from langchain_core.messages import AIMessage

from agentic_design_patterns.patterns.chapter_10_model_context_protocol import nodes
from agentic_design_patterns.patterns.chapter_10_model_context_protocol.graph import graph


class FakeChatModel:
    def __init__(self, responses: list[str]) -> None:
        self.responses = list(responses)
        self.calls = []

    def invoke(self, messages):
        self.calls.append(messages)
        if not self.responses:
            raise AssertionError("Unexpected model invocation.")
        return AIMessage(content=self.responses.pop(0))


class FakeMCPClient:
    def __init__(self, manifest: dict, results: list[dict | Exception] | None = None) -> None:
        self.manifest = manifest
        self.results = list(results or [])
        self.discover_calls = 0
        self.invoke_calls: list[dict] = []

    def discover(self):
        self.discover_calls += 1
        return self.manifest

    def invoke(self, request):
        self.invoke_calls.append(request)
        if not self.results:
            raise AssertionError("Unexpected MCP invocation.")
        result = self.results.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


def patch_model(monkeypatch, *responses: str) -> FakeChatModel:
    fake_model = FakeChatModel(list(responses))
    monkeypatch.setattr(nodes, "get_chat_model", lambda: fake_model)
    return fake_model


def test_tool_discovery_selection_invocation_and_final_response(monkeypatch):
    fake_model = patch_model(
        monkeypatch,
        "The managed folder contains sample.txt and notes.md.",
    )
    client = FakeMCPClient(
        {
            "servers": {
                "filesystem": {
                    "tools": [
                        {
                            "name": "list_directory",
                            "description": "List files in a managed folder.",
                            "input_schema": {
                                "required": ["path"],
                                "properties": {"path": {"type": "string"}},
                            },
                            "default_arguments": {"path": "managed"},
                            "output_content_type": "application/json",
                            "read_only": True,
                        }
                    ]
                }
            }
        },
        [
            {
                "success": True,
                "content": {"items": ["sample.txt", "notes.md"]},
                "content_type": "application/json",
            }
        ],
    )

    result = graph.invoke(
        {"input": "List files in the managed folder.", "mcp_client": client}
    )

    assert result["intent"] == "execute_tool"
    assert result["operation_type"] == "tool"
    assert result["selected_capability"]["name"] == "list_directory"
    assert result["mcp_request"]["arguments"] == {"path": "managed"}
    assert result["context_update"]["item_count"] == 2
    assert result["final_output"]["status"] == "ok"
    assert result["final_output"]["response"] == (
        "The managed folder contains sample.txt and notes.md."
    )
    assert client.discover_calls == 1
    assert [call["name"] for call in client.invoke_calls] == ["list_directory"]
    assert len(fake_model.calls) == 1


def test_text_resource_retrieval_is_integrated(monkeypatch):
    patch_model(monkeypatch, "sample.txt says the release is ready.")
    client = FakeMCPClient(
        {
            "servers": {
                "filesystem": {
                    "resources": [
                        {
                            "name": "sample.txt",
                            "uri": "mcp://files/sample.txt",
                            "description": "Readable text file sample.txt",
                            "content_type": "text/plain",
                        }
                    ]
                }
            }
        },
        [
            {
                "success": True,
                "content": "Release is ready.",
                "content_type": "text/plain",
            }
        ],
    )

    result = graph.invoke({"input": "Read sample.txt", "mcp_client": client})

    assert result["intent"] == "read_resource"
    assert result["selected_capability"]["type"] == "resource"
    assert result["mcp_request"]["uri"] == "mcp://files/sample.txt"
    assert result["context_update"]["content"] == "Release is ready."
    assert result["final_output"]["status"] == "ok"


def test_prompt_capability_is_selected_without_treating_as_tool(monkeypatch):
    patch_model(monkeypatch, "Use the incident summary prompt before drafting the report.")
    client = FakeMCPClient(
        {
            "servers": {
                "ops": {
                    "prompts": [
                        {
                            "name": "incident_summary_template",
                            "description": "Prompt template for incident summaries.",
                            "input_schema": {"required": ["topic"]},
                            "output_content_type": "text/plain",
                        }
                    ]
                }
            }
        },
        [
            {
                "success": True,
                "content": "Summarize the incident, impact, timeline, and next steps.",
                "content_type": "text/plain",
            }
        ],
    )

    result = graph.invoke(
        {"input": "Use the incident summary prompt", "mcp_client": client}
    )

    assert result["intent"] == "use_prompt"
    assert result["selected_capability"]["type"] == "prompt"
    assert result["mcp_request"]["type"] == "prompt"
    assert result["mcp_request"]["arguments"]["topic"] == (
        "Use the incident summary prompt"
    )
    assert client.invoke_calls[0]["type"] == "prompt"


def test_direct_answer_routes_without_discovery(monkeypatch):
    fake_model = patch_model(monkeypatch, "MCP is a standard integration layer.")
    client = FakeMCPClient({"servers": {}})

    result = graph.invoke(
        {"input": "Explain MCP in one sentence.", "mcp_client": client}
    )

    assert result["operation_type"] == "none"
    assert result["capability_manifest"] == {}
    assert result["final_output"]["status"] == "ok"
    assert result["final_output"]["response"] == "MCP is a standard integration layer."
    assert client.discover_calls == 0
    assert client.invoke_calls == []
    assert len(fake_model.calls) == 1


def test_no_server_manifest_falls_back_without_invocation(monkeypatch):
    patch_model(monkeypatch, "No MCP server is available for that folder request.")
    client = FakeMCPClient({"servers": {}})

    result = graph.invoke(
        {"input": "List files in the managed folder.", "mcp_client": client}
    )

    assert result["final_output"]["status"] == "fallback"
    assert result["selected_capability"] is None
    assert result["mcp_request"] is None
    assert client.discover_calls == 1
    assert client.invoke_calls == []
    assert "No MCP servers" in result["fallback_reason"]


def test_malformed_manifest_records_error_and_avoids_invocation(monkeypatch):
    patch_model(monkeypatch, "The MCP manifest is malformed, so I cannot invoke it.")
    client = FakeMCPClient({"servers": "broken"})

    result = graph.invoke(
        {"input": "List files in the managed folder.", "mcp_client": client}
    )

    assert result["final_output"]["status"] == "fallback"
    assert result["selected_capability"] is None
    assert any("servers must be a dictionary or list" in error for error in result["errors"])
    assert client.invoke_calls == []


def test_missing_required_parameters_falls_back_without_fabricating_values(monkeypatch):
    patch_model(monkeypatch, "I need a ticket id before using the ticket lookup tool.")
    client = FakeMCPClient(
        {
            "servers": {
                "tickets": {
                    "tools": [
                        {
                            "name": "read_ticket",
                            "description": "Read a specific support ticket by id.",
                            "input_schema": {"required": ["ticket_id"]},
                            "output_content_type": "application/json",
                            "read_only": True,
                        }
                    ]
                }
            }
        }
    )

    result = graph.invoke({"input": "Use the ticket lookup tool.", "mcp_client": client})

    assert result["final_output"]["status"] == "fallback"
    assert result["selected_capability"]["name"] == "read_ticket"
    assert result["capability_validation"]["missing_arguments"] == ["ticket_id"]
    assert result["mcp_request"] is None
    assert client.invoke_calls == []


def test_unauthorized_high_impact_tool_routes_to_review(monkeypatch):
    patch_model(
        monkeypatch,
        "I found an email tool, but sending external messages requires approval.",
    )
    client = FakeMCPClient(
        {
            "servers": {
                "email": {
                    "tools": [
                        {
                            "name": "send_email",
                            "description": "Send an external email message.",
                            "input_schema": {
                                "required": ["recipient", "body"],
                                "properties": {
                                    "recipient": {"type": "string"},
                                    "body": {"type": "string"},
                                },
                            },
                            "authorized": False,
                            "read_only": False,
                        }
                    ]
                }
            }
        }
    )

    result = graph.invoke(
        {
            "input": "Send email to ops@example.com saying deploy now.",
            "mcp_client": client,
        }
    )

    assert result["final_output"]["status"] == "needs_review"
    assert result["needs_human_review"] is True
    assert result["selected_capability"]["name"] == "send_email"
    assert result["capability_validation"]["authorization"] == "denied"
    assert client.invoke_calls == []


def test_opaque_mcp_result_routes_to_review(monkeypatch):
    patch_model(
        monkeypatch,
        "The MCP server returned an opaque PDF, so human review is required.",
    )
    client = FakeMCPClient(
        {
            "servers": {
                "docs": {
                    "resources": [
                        {
                            "name": "quarterly_report",
                            "uri": "mcp://docs/quarterly_report",
                            "description": "Readable quarterly_report document.",
                            "content_type": "text/plain",
                        }
                    ]
                }
            }
        },
        [
            {
                "success": True,
                "content": b"%PDF",
                "content_type": "application/pdf",
            }
        ],
    )

    result = graph.invoke({"input": "Read quarterly_report", "mcp_client": client})

    assert result["final_output"]["status"] == "needs_review"
    assert result["needs_human_review"] is True
    assert client.invoke_calls[0]["type"] == "resource"
    assert any("opaque" in error for error in result["errors"])


def test_recoverable_failure_tries_next_candidate(monkeypatch):
    patch_model(monkeypatch, "The backup filesystem server returned the folder list.")
    client = FakeMCPClient(
        {
            "servers": {
                "filesystem": {
                    "tools": [
                        {
                            "name": "list_directory_primary",
                            "description": "List files in a managed folder.",
                            "input_schema": {"required": ["path"]},
                            "default_arguments": {"path": "managed"},
                            "output_content_type": "application/json",
                            "read_only": True,
                        },
                        {
                            "name": "list_directory_backup",
                            "description": "List files in a managed folder.",
                            "input_schema": {"required": ["path"]},
                            "default_arguments": {"path": "managed"},
                            "output_content_type": "application/json",
                            "read_only": True,
                        },
                    ]
                }
            }
        },
        [
            {
                "success": False,
                "error": "primary transport failed",
                "error_type": "transport",
                "recoverable": True,
            },
            {
                "success": True,
                "content": {"items": ["sample.txt"]},
                "content_type": "application/json",
            },
        ],
    )

    result = graph.invoke(
        {"input": "List files in the managed folder.", "mcp_client": client}
    )

    assert result["final_output"]["status"] == "ok"
    assert [call["name"] for call in client.invoke_calls] == [
        "list_directory_primary",
        "list_directory_backup",
    ]
    assert result["selected_capability"]["name"] == "list_directory_backup"
    assert any("primary transport failed" in error for error in result["errors"])


def test_repeated_transport_failure_stops_after_attempt_limit(monkeypatch):
    patch_model(monkeypatch, "Both MCP transports failed, so I stopped safely.")
    client = FakeMCPClient(
        {
            "servers": {
                "filesystem": {
                    "tools": [
                        {
                            "name": "list_directory_primary",
                            "description": "List files in a managed folder.",
                            "input_schema": {"required": ["path"]},
                            "default_arguments": {"path": "managed"},
                            "output_content_type": "application/json",
                            "read_only": True,
                        },
                        {
                            "name": "list_directory_backup",
                            "description": "List files in a managed folder.",
                            "input_schema": {"required": ["path"]},
                            "default_arguments": {"path": "managed"},
                            "output_content_type": "application/json",
                            "read_only": True,
                        },
                    ]
                }
            }
        },
        [
            {
                "success": False,
                "error": "primary transport failed",
                "error_type": "transport",
                "recoverable": True,
            },
            {
                "success": False,
                "error": "backup transport failed",
                "error_type": "transport",
                "recoverable": True,
            },
        ],
    )

    result = graph.invoke(
        {"input": "List files in the managed folder.", "mcp_client": client}
    )

    assert result["final_output"]["status"] == "fallback"
    assert [call["name"] for call in client.invoke_calls] == [
        "list_directory_primary",
        "list_directory_backup",
    ]
    assert result["invocation_attempts"] == 2
    assert "backup transport failed" in result["fallback_reason"]
