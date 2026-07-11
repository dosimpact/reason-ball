"""ChatGPT OAuth Proxy Server.

Lightweight aiohttp web server that translates Chat Completions API
requests to ChatGPT Responses API format and back.
"""

import asyncio
import json
import logging
from collections.abc import AsyncIterator

import aiohttp
from aiohttp import web

from . import api_translator
from .constants import CHATGPT_RESPONSES_URL
from .models import SUPPORTED_CODEX_MODELS
from .token_manager import TokenManager

logger = logging.getLogger(__name__)

TOKEN_MANAGER_KEY = web.AppKey("token_manager", TokenManager)
HTTP_SESSION_KEY = web.AppKey("http_session", aiohttp.ClientSession)


def _error_response(message: str, error_type: str, status: int) -> web.Response:
    return web.json_response(
        {"error": {"message": message, "type": error_type}},
        status=status,
    )


async def _http_client_context(app: web.Application) -> AsyncIterator[None]:
    app[HTTP_SESSION_KEY] = aiohttp.ClientSession(
        timeout=aiohttp.ClientTimeout(total=300),
    )
    yield
    await app[HTTP_SESSION_KEY].close()


def create_app(token_manager: TokenManager) -> web.Application:
    """Create the aiohttp proxy application."""
    app = web.Application()
    app[TOKEN_MANAGER_KEY] = token_manager
    app.cleanup_ctx.append(_http_client_context)
    app.router.add_post("/v1/chat/completions", handle_chat_completions)
    app.router.add_post("/v1/responses", handle_responses)
    app.router.add_get("/v1/models", handle_models)
    app.router.add_get("/health", handle_health)
    return app


async def handle_health(request: web.Request) -> web.Response:
    """Health check endpoint."""
    try:
        await request.app[TOKEN_MANAGER_KEY].get_token()
        token_valid = True
    except Exception as exc:
        logger.debug("Health check token validation failed: %s", exc)
        token_valid = False

    return web.json_response({"status": "ok", "token_valid": token_valid})


async def handle_models(request: web.Request) -> web.Response:
    """Return Codex models verified as available to this proxy."""
    return web.json_response({
        "object": "list",
        "data": [
            {
                "id": model,
                "object": "model",
                "created": 0,
                "owned_by": "openai",
            }
            for model in SUPPORTED_CODEX_MODELS
        ],
    })


async def _forward_to_codex(
    request: web.Request,
    translated_request: dict,
) -> "tuple[dict | None, web.Response | None]":
    """Forward a pre-translated Responses API request to the Codex upstream.

    Handles token retrieval, HTTP POST, SSE/JSON parsing, and error translation.

    Returns:
        (api_response, None)  on success — api_response is a Responses API dict.
        (None, error_response) on any failure — error_response is a web.Response.
    """
    token_manager = request.app[TOKEN_MANAGER_KEY]
    try:
        token = await token_manager.get_token()
        account_id = await token_manager.get_account_id()
    except Exception as e:
        logger.error("Token retrieval failed: %s", e)
        return None, _error_response(str(e), "authentication_error", 401)

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "OpenAI-Beta": "responses=experimental",
        "accept": "text/event-stream",
    }
    if account_id:
        headers["chatgpt-account-id"] = account_id

    try:
        session = request.app[HTTP_SESSION_KEY]
        async with session.post(
            CHATGPT_RESPONSES_URL,
            json=translated_request,
            headers=headers,
        ) as resp:
            raw_body = await resp.text()

            if resp.status != 200:
                try:
                    error_body = json.loads(raw_body)
                except json.JSONDecodeError:
                    error_body = {"error": {"message": raw_body}}

                translated_error, status = api_translator.translate_error(error_body, resp.status)
                logger.warning("ChatGPT API error (%d): %s", resp.status, raw_body[:200])
                return None, web.json_response(translated_error, status=status)

            content_type = resp.headers.get("Content-Type", "")
            is_sse = "text/event-stream" in content_type or raw_body.lstrip().startswith("event:")
            try:
                api_response = (
                    api_translator.collect_sse_to_response(raw_body)
                    if is_sse
                    else json.loads(raw_body)
                )
                if not isinstance(api_response, dict):
                    raise ValueError("Upstream response must be a JSON object")
            except (ValueError, json.JSONDecodeError) as exc:
                logger.error(
                    "Invalid upstream response (Content-Type: %s, body[:200]: %s): %s",
                    content_type,
                    raw_body[:200],
                    exc,
                )
                return None, _error_response("Invalid response from upstream", "server_error", 502)

            logger.debug(
                "Upstream response parsed: output_items=%s status=%s",
                [item.get("type") for item in api_response.get("output", [])],
                api_response.get("status"),
            )

    except aiohttp.ClientError as e:
        logger.error("Connection to ChatGPT failed: %s", e)
        return None, _error_response(f"Upstream connection error: {e}", "server_error", 502)
    except asyncio.TimeoutError:
        logger.error("Connection to ChatGPT timed out")
        return None, _error_response("Upstream request timed out", "server_error", 504)

    return api_response, None


async def handle_chat_completions(request: web.Request) -> web.Response:
    """Translate and proxy a Chat Completions request to ChatGPT Responses API."""
    try:
        body = await request.json()
        if not isinstance(body, dict):
            raise ValueError("JSON body must be an object")
    except (json.JSONDecodeError, ValueError) as exc:
        return _error_response(str(exc) or "Invalid JSON body", "invalid_request_error", 400)

    original_model = body.get("model", "gpt-4o")

    # Translate request
    try:
        translated_request = api_translator.translate_request(body)
    except (AttributeError, TypeError, ValueError) as e:
        logger.info("Request translation failed: %s", e)
        return _error_response(f"Request translation error: {e}", "invalid_request_error", 400)

    logger.debug("Proxy request: model=%s -> %s, tools=%d, messages=%d",
                 original_model, translated_request.get("model"),
                 len(body.get("tools") or []), len(body.get("messages") or []))

    api_response, err = await _forward_to_codex(request, translated_request)
    if err is not None:
        return err

    # Translate response back to Chat Completions format
    try:
        result = api_translator.translate_response(api_response, original_model)
    except Exception as e:
        logger.error("Response translation failed: %s", e)
        return _error_response(f"Response translation error: {e}", "server_error", 500)

    return web.json_response(result)


async def handle_responses(request: web.Request) -> web.Response:
    """Proxy a Responses API request directly to the ChatGPT Codex backend.

    The openai-agents Runner already emits a Responses-shaped body, so no
    format translation is needed.  The response is returned to the caller
    as-is (no back-translation to Chat Completions format).
    """
    try:
        body = await request.json()
        if not isinstance(body, dict):
            raise ValueError("JSON body must be an object")
    except (json.JSONDecodeError, ValueError) as exc:
        return _error_response(str(exc) or "Invalid JSON body", "invalid_request_error", 400)

    translated = api_translator.prepare_responses_passthrough(body)

    logger.debug("Responses passthrough: model=%s -> %s, tools=%d",
                 body.get("model"), translated.get("model"),
                 len(body.get("tools") or []))

    api_response, err = await _forward_to_codex(request, translated)
    if err is not None:
        return err

    return web.json_response(api_response)
