"""
ToolNode 헬퍼.

LangGraph prebuilt `ToolNode` 를 그대로 재사용합니다. 별도 래퍼는 필요 없지만,
`from node.tool_node import make_tool_node` 와 같이 일관된 import 경로를 제공하기
위해 얇게 한 번 감쌌습니다.
"""

from __future__ import annotations

from langchain_core.tools import BaseTool
from langgraph.prebuilt import ToolNode


def make_tool_node(tools: list[BaseTool]) -> ToolNode:
    """주어진 tools 를 실행할 ToolNode 인스턴스를 반환합니다."""
    return ToolNode(tools)


__all__ = ["make_tool_node", "ToolNode"]
