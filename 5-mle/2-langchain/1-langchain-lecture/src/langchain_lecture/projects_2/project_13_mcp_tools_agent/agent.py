"""MCP 형태의 도구 발견과 호출을 에이전트에 연결하는 예제입니다. 도구와 모델을 묶어 에이전트 실행 단위를 구성합니다."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from langchain_lecture.projects_2.project_13_mcp_tools_agent.mcp_client import (
    LocalMCPClient,
    default_client,
)


@dataclass(frozen=True)
class MCPAgentResult:
    answer: str
    tool_name: str | None
    tool_result: Any = None
    error: str = ""


class MCPToolsAgent:
    def __init__(self, client: LocalMCPClient | None = None) -> None:
        self.client = client or default_client()

    def discover(self) -> str:
        return self.client.describe_tools()

    def invoke(self, question: str) -> MCPAgentResult:
        lowered = question.lower()
        try:
            if "browser" in lowered or "브라우저" in question:
                return MCPAgentResult(
                    answer="등록된 MCP browser tool이 없어 사용할 수 없습니다.",
                    tool_name=None,
                )

            if "읽" in question or "read" in lowered:
                path = _extract_path(question)
                result = self.client.call_tool("filesystem.read_text", {"path": path})
                return MCPAgentResult(
                    answer=f"{path} 파일 내용입니다: {result}",
                    tool_name="filesystem.read_text",
                    tool_result=result,
                )

            if "목록" in question or "list" in lowered or "files" in lowered:
                path = _extract_path(question, default=".")
                result = self.client.call_tool("filesystem.list_files", {"path": path})
                return MCPAgentResult(
                    answer=f"{path} 경로의 파일 목록: {', '.join(result) if result else '(empty)'}",
                    tool_name="filesystem.list_files",
                    tool_result=result,
                )

            return MCPAgentResult(
                answer="사용 가능한 MCP tool은 filesystem.list_files와 filesystem.read_text입니다.",
                tool_name=None,
            )
        except Exception as exc:
            return MCPAgentResult(
                answer=f"MCP tool 호출 중 오류가 발생했습니다: {exc}",
                tool_name=None,
                error=f"{type(exc).__name__}: {exc}",
            )


def _extract_path(text: str, *, default: str = "README.md") -> str:
    for marker in ["path=", "file="]:
        if marker in text:
            return text.split(marker, 1)[1].strip().strip("'\"")
    return default


def build_mcp_agent(client: LocalMCPClient | None = None) -> MCPToolsAgent:
    return MCPToolsAgent(client=client)


def run_mcp_agent(question: str, client: LocalMCPClient | None = None) -> dict[str, Any]:
    result = build_mcp_agent(client=client).invoke(question)
    return {
        "answer": result.answer,
        "tool_name": result.tool_name,
        "tool_result": result.tool_result,
        "error": result.error,
    }
