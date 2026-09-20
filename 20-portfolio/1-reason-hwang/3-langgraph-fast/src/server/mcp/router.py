from __future__ import annotations

import asyncio
import os
from typing import Any

from fastapi import APIRouter, Header, Request, Response
from fastapi.responses import JSONResponse
from mcp.types import JSONRPCMessage, Tool
from pydantic import ValidationError

router = APIRouter(prefix="/mcp", tags=["MCP"])
_run_slots = asyncio.Semaphore(max(1, int(os.getenv("MAX_CONCURRENT_RUNS", "10"))))

TOOLS = [
    Tool(name="main_graph", description="Run the main conversational graph", inputSchema={"type": "object", "properties": {"message": {"type": "string"}, "provider": {"type": "string"}}, "required": ["message"]}).model_dump(by_alias=True, exclude_none=True),
    Tool(name="tenk_subgraph", description="Query the 10-K retrieval graph", inputSchema={"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}).model_dump(by_alias=True, exclude_none=True),
    Tool(name="starter_graph", description="Run the starter tool-using graph", inputSchema={"type": "object", "properties": {"message": {"type": "string"}}, "required": ["message"]}).model_dump(by_alias=True, exclude_none=True),
]


def _rpc(request_id: Any, *, result: Any = None, error: dict[str, Any] | None = None) -> dict[str, Any]:
    envelope: dict[str, Any] = {"jsonrpc": "2.0", "id": request_id}
    envelope["error" if error else "result"] = error if error else result
    return envelope


async def _call_tool(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    async with _run_slots:
        if name == "main_graph":
            from graph.primary_graphs.main_graph.workflow import run_graph

            result = await run_graph(arguments.get("message", ""), arguments.get("provider", "openai"))
        elif name == "tenk_subgraph":
            from graph.subgraph.tenk.workflow import run_tenk_graph

            result = await run_tenk_graph(arguments.get("query", ""), arguments.get("selected_filing"))
        elif name == "starter_graph":
            from graph.subgraph.starter_graph.workflow import get_last_ai_message, run_starter_graph

            result = {"response": get_last_ai_message(await run_starter_graph(arguments.get("message", "")))}
        else:
            raise KeyError(name)
    return {"content": [{"type": "text", "text": str(result)}], "structuredContent": result}


@router.post("/", operation_id="post_mcp")
async def post_mcp(request: Request, accept: str | None = Header(default=None)) -> Response:
    if accept is None or "application/json" not in accept or "text/event-stream" not in accept:
        return JSONResponse(status_code=400, content={"error": "Accept must include application/json and text/event-stream"})
    try:
        message = await request.json()
    except ValueError:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON"})
    if not isinstance(message, dict) or message.get("jsonrpc") != "2.0":
        return JSONResponse(status_code=400, content={"error": "Invalid JSON-RPC message"})
    try:
        JSONRPCMessage.model_validate(message)
    except ValidationError:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON-RPC message"})
    if "method" not in message and "id" in message and ("result" in message or "error" in message):
        return Response(status_code=202)
    if not isinstance(message.get("method"), str):
        return JSONResponse(status_code=400, content={"error": "Invalid JSON-RPC message"})
    if "id" not in message:
        return Response(status_code=202)
    request_id, method, params = message["id"], message["method"], message.get("params") or {}
    if method == "initialize":
        result = {"protocolVersion": params.get("protocolVersion", "2024-11-05"), "capabilities": {"tools": {}}, "serverInfo": {"name": "reason-langgraph-fast", "version": "0.1.0"}}
    elif method == "ping":
        result = {}
    elif method == "tools/list":
        result = {"tools": TOOLS}
    elif method == "tools/call":
        try:
            result = await _call_tool(params.get("name", ""), params.get("arguments") or {})
        except KeyError:
            return JSONResponse(content=_rpc(request_id, error={"code": -32602, "message": "Unknown tool"}))
        except Exception as exc:
            return JSONResponse(content=_rpc(request_id, error={"code": -32603, "message": str(exc)}))
    else:
        return JSONResponse(content=_rpc(request_id, error={"code": -32601, "message": "Method not found"}))
    return JSONResponse(content=_rpc(request_id, result=result))


@router.get("/", operation_id="get_mcp")
async def get_mcp() -> Response:
    return Response(status_code=405)


@router.delete("/", operation_id="delete_mcp")
async def delete_mcp() -> Response:
    return Response(status_code=404)
