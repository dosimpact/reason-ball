"""OpenAI-compatible local proxy backed by Claude Code CLI."""

import json
import logging
import time

from aiohttp import web

from . import api_translator
from .claude_runner import check_claude_available, run_claude_prompt
from .constants import DEFAULT_MODEL

logger = logging.getLogger(__name__)


def create_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/health", handle_health)
    app.router.add_get("/v1/models", handle_models)
    app.router.add_post("/v1/chat/completions", handle_chat_completions)
    app.router.add_post("/v1/responses", handle_responses)
    return app


async def handle_health(request: web.Request) -> web.Response:
    return web.json_response(
        {
            "status": "ok",
            "claude_cli_available": await check_claude_available(),
        }
    )


async def handle_models(request: web.Request) -> web.Response:
    return web.json_response(
        {
            "object": "list",
            "data": [
                {
                    "id": DEFAULT_MODEL,
                    "object": "model",
                    "created": int(time.time()),
                    "owned_by": "local-claude-code",
                }
            ],
        }
    )


async def handle_chat_completions(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except json.JSONDecodeError:
        return _error("Invalid JSON body", "invalid_request_error", 400)

    prompt = api_translator.chat_request_to_prompt(body)
    if not prompt:
        return _error("No prompt content found", "invalid_request_error", 400)

    try:
        text = await run_claude_prompt(prompt, model=body.get("model"))
    except TimeoutError as exc:
        return _error(str(exc), "timeout_error", 504)
    except Exception as exc:
        logger.warning("Claude Code request failed: %s", exc)
        return _error(str(exc), "server_error", 502)

    return web.json_response(
        api_translator.make_chat_completion(text, body.get("model"))
    )


async def handle_responses(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except json.JSONDecodeError:
        return _error("Invalid JSON body", "invalid_request_error", 400)

    prompt = api_translator.responses_request_to_prompt(body)
    if not prompt:
        return _error("No prompt content found", "invalid_request_error", 400)

    try:
        text = await run_claude_prompt(prompt, model=body.get("model"))
    except TimeoutError as exc:
        return _error(str(exc), "timeout_error", 504)
    except Exception as exc:
        logger.warning("Claude Code request failed: %s", exc)
        return _error(str(exc), "server_error", 502)

    return web.json_response(api_translator.make_response(text, body.get("model")))


def _error(message: str, error_type: str, status: int) -> web.Response:
    return web.json_response(
        {"error": {"message": message, "type": error_type}},
        status=status,
    )
