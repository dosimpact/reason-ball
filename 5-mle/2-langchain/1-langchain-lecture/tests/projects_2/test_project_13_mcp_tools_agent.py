from __future__ import annotations

from pathlib import Path

from langchain_lecture.projects_2.project_13_mcp_tools_agent import app, main
from langchain_lecture.projects_2.project_13_mcp_tools_agent.agent import (
    build_mcp_agent,
    run_mcp_agent,
)
from langchain_lecture.projects_2.project_13_mcp_tools_agent.graph import graph
from langchain_lecture.projects_2.project_13_mcp_tools_agent.mcp_client import LocalMCPClient


def test_discovers_tool_schema_and_description(tmp_path: Path):
    client = LocalMCPClient(tmp_path)

    descriptions = client.describe_tools()

    assert "filesystem.list_files" in descriptions
    assert "List files under" in descriptions
    assert 'schema={"properties"' in descriptions


def test_agent_uses_discovered_filesystem_tool(tmp_path: Path):
    (tmp_path / "sample.txt").write_text("hello")
    (tmp_path / "__pycache__").mkdir()
    agent = build_mcp_agent(LocalMCPClient(tmp_path))

    result = agent.invoke("파일 목록을 알려줘")

    assert result.tool_name == "filesystem.list_files"
    assert result.tool_result == ["sample.txt"]


def test_unknown_capability_is_explained():
    result = run_mcp_agent("등록되지 않은 브라우저 tool을 써줘")

    assert result["tool_name"] is None
    assert "없어" in result["answer"]


def test_tool_error_is_contained(tmp_path: Path):
    agent = build_mcp_agent(LocalMCPClient(tmp_path))

    result = agent.invoke("path=../secret 파일 읽어줘")

    assert result.error.startswith("PermissionError")
    assert "오류" in result.answer


def test_app_main_prints_discovery_and_tool_use(capsys):
    app.main()

    output = capsys.readouterr().out
    assert "filesystem.list_files" in output
    assert "schema=" in output
    assert "파일 목록" in output


def test_main_entrypoint_delegates_to_app(capsys):
    main.main()

    output = capsys.readouterr().out
    assert "filesystem.read_text" in output
    assert "파일 목록" in output


def test_graph_compiles_and_invokes_without_external_clients():
    assert graph.get_graph().nodes

    result = graph.invoke({"question": "등록되지 않은 브라우저 tool을 써줘"})

    assert result["tool_name"] is None
    assert "없어" in result["answer"]
