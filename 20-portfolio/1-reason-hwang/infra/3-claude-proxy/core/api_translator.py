"""OpenAI-compatible request/response translation for Claude Code CLI."""

import time
from typing import Any

from .constants import DEFAULT_MODEL


def chat_request_to_prompt(body: dict[str, Any]) -> str:
    """Convert Chat Completions messages into a plain Claude Code prompt."""
    messages = body.get("messages") or []
    if not messages:
        return str(body.get("input") or "")

    parts: list[str] = []
    for message in messages:
        role = message.get("role", "user")
        content = _content_to_text(message.get("content"))
        if not content:
            continue
        parts.append(f"{role.upper()}:\n{content}")

    return "\n\n".join(parts).strip()


def responses_request_to_prompt(body: dict[str, Any]) -> str:
    """Convert a Responses API-ish body into a plain Claude Code prompt."""
    instructions = body.get("instructions")
    input_value = body.get("input", "")

    parts: list[str] = []
    if instructions:
        parts.append(f"SYSTEM:\n{instructions}")

    if isinstance(input_value, str):
        parts.append(f"USER:\n{input_value}")
    elif isinstance(input_value, list):
        for item in input_value:
            if isinstance(item, dict):
                role = item.get("role", "user")
                content = _content_to_text(item.get("content"))
                if content:
                    parts.append(f"{role.upper()}:\n{content}")
            else:
                parts.append(str(item))
    elif input_value:
        parts.append(str(input_value))

    return "\n\n".join(parts).strip()


def _content_to_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts: list[str] = []
        for part in content:
            if isinstance(part, dict):
                if part.get("type") in {"text", "input_text", "output_text"}:
                    text_parts.append(str(part.get("text", "")))
                elif "content" in part:
                    text_parts.append(_content_to_text(part.get("content")))
            else:
                text_parts.append(str(part))
        return "\n".join(p for p in text_parts if p)
    return str(content)


def make_chat_completion(text: str, model: str | None) -> dict[str, Any]:
    created = int(time.time())
    completion_tokens = max(1, len(text.split()))
    return {
        "id": f"chatcmpl-claude-code-{created}",
        "object": "chat.completion",
        "created": created,
        "model": model or DEFAULT_MODEL,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": text},
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 0,
            "completion_tokens": completion_tokens,
            "total_tokens": completion_tokens,
        },
    }


def make_response(text: str, model: str | None) -> dict[str, Any]:
    created = int(time.time())
    return {
        "id": f"resp_claude_code_{created}",
        "object": "response",
        "created_at": created,
        "status": "completed",
        "model": model or DEFAULT_MODEL,
        "output": [
            {
                "type": "message",
                "role": "assistant",
                "content": [{"type": "output_text", "text": text}],
            }
        ],
        "usage": {
            "input_tokens": 0,
            "output_tokens": max(1, len(text.split())),
            "total_tokens": max(1, len(text.split())),
        },
    }
