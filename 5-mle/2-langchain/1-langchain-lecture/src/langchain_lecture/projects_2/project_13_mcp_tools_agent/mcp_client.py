"""MCP 형태의 도구 발견과 호출을 에이전트에 연결하는 예제입니다. 실제 MCP 서버 대신 사용할 수 있는 로컬 MCP 형태 클라이언트입니다."""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class MCPToolSpec:
    name: str
    description: str
    input_schema: dict[str, Any]
    server: str


@dataclass(frozen=True)
class MCPTool:
    spec: MCPToolSpec
    handler: Callable[[dict[str, Any]], Any]

    @property
    def name(self) -> str:
        return self.spec.name

    @property
    def description(self) -> str:
        return self.spec.description

    @property
    def input_schema(self) -> dict[str, Any]:
        return self.spec.input_schema

    def invoke(self, args: dict[str, Any]) -> Any:
        return self.handler(args)


class LocalMCPClient:
    """A deterministic MCP-shaped client used when real adapters are unavailable."""

    def __init__(self, root: str | Path, config: dict[str, Any] | None = None) -> None:
        self.root = Path(root).resolve()
        self.config = config or {"filesystem": {"command": "mock-filesystem", "args": ["."]}}
        self._tools = self._build_tools()

    @classmethod
    def from_config_file(cls, config_path: str | Path, *, root: str | Path | None = None):
        path = Path(config_path)
        config = json.loads(path.read_text())
        return cls(root=root or path.parent, config=config)

    def discover_tools(self) -> list[MCPToolSpec]:
        return [tool.spec for tool in self._tools.values()]

    def as_langchain_tools(self) -> list[MCPTool]:
        return list(self._tools.values())

    def call_tool(self, name: str, args: dict[str, Any] | None = None) -> Any:
        if name not in self._tools:
            raise KeyError(f"MCP tool {name!r} is not available.")
        return self._tools[name].invoke(args or {})

    def describe_tools(self) -> str:
        lines = []
        for spec in self.discover_tools():
            schema = json.dumps(spec.input_schema, ensure_ascii=False, sort_keys=True)
            lines.append(f"{spec.name}: {spec.description} schema={schema}")
        return "\n".join(lines)

    def _build_tools(self) -> dict[str, MCPTool]:
        return {
            "filesystem.list_files": MCPTool(
                spec=MCPToolSpec(
                    name="filesystem.list_files",
                    description="List files under the configured MCP filesystem root.",
                    input_schema={
                        "type": "object",
                        "properties": {"path": {"type": "string", "default": "."}},
                    },
                    server="filesystem",
                ),
                handler=self._list_files,
            ),
            "filesystem.read_text": MCPTool(
                spec=MCPToolSpec(
                    name="filesystem.read_text",
                    description="Read a UTF-8 text file under the configured MCP filesystem root.",
                    input_schema={
                        "type": "object",
                        "properties": {"path": {"type": "string"}},
                        "required": ["path"],
                    },
                    server="filesystem",
                ),
                handler=self._read_text,
            ),
        }

    def _resolve_safe_path(self, requested: str | None) -> Path:
        relative = requested or "."
        candidate = (self.root / relative).resolve()
        if self.root != candidate and self.root not in candidate.parents:
            raise PermissionError(f"Path {relative!r} is outside the MCP root.")
        return candidate

    def _list_files(self, args: dict[str, Any]) -> list[str]:
        target = self._resolve_safe_path(str(args.get("path") or "."))
        if not target.exists():
            raise FileNotFoundError(str(target))
        if target.is_file():
            return [target.relative_to(self.root).as_posix()]
        return sorted(
            path.relative_to(self.root).as_posix()
            for path in target.iterdir()
            if path.name != "__pycache__" and path.suffix != ".pyc"
        )

    def _read_text(self, args: dict[str, Any]) -> str:
        target = self._resolve_safe_path(str(args.get("path") or ""))
        if not target.is_file():
            raise FileNotFoundError(str(target))
        return target.read_text()


def default_client() -> LocalMCPClient:
    config_path = Path(__file__).with_name("mcp_config.json")
    return LocalMCPClient.from_config_file(config_path, root=Path(__file__).parent)
