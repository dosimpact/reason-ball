"""Reusable ChatGPT OAuth proxy core."""

import logging
import os

from aiohttp import web

from .constants import DEFAULT_PROXY_HOST, DEFAULT_PROXY_PORT
from .proxy_server import create_app
from .token_manager import TokenManager

logger = logging.getLogger(__name__)

_runner: web.AppRunner | None = None
_site: web.TCPSite | None = None


def inject_env(port: int | None = None) -> None:
    """Point OpenAI SDK clients in this process at the local proxy."""
    proxy_port = DEFAULT_PROXY_PORT if port is None else port
    os.environ["OPENAI_BASE_URL"] = f"http://localhost:{proxy_port}/v1"
    os.environ["OPENAI_API_KEY"] = "chatgpt-oauth-placeholder"
    logger.info("OPENAI_BASE_URL=http://localhost:%d/v1", proxy_port)


def clear_env() -> None:
    """Remove local proxy OpenAI SDK environment variables."""
    os.environ.pop("OPENAI_BASE_URL", None)
    os.environ.pop("OPENAI_API_KEY", None)


async def start_proxy(port: int | None = None, host: str | None = None) -> bool:
    """Start the ChatGPT OAuth proxy server."""
    global _runner, _site

    if _runner is not None:
        logger.info("Proxy already running")
        return True

    proxy_host = DEFAULT_PROXY_HOST if host is None else host
    proxy_port = DEFAULT_PROXY_PORT if port is None else port

    try:
        token_manager = TokenManager()
        try:
            token_manager.validate_or_fail()
        except Exception as e:
            logger.warning("Proxy starting without valid auth file: %s", e)

        app = create_app(token_manager)
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, proxy_host, proxy_port)
        await site.start()
        _runner = runner
        _site = site

        logger.info("ChatGPT OAuth proxy started on %s:%d", proxy_host, proxy_port)
        return True
    except Exception as e:
        logger.error("Failed to start proxy: %s", e)
        _runner = None
        _site = None
        return False


async def stop_proxy() -> None:
    """Gracefully stop the proxy server."""
    global _runner, _site

    if _runner is not None:
        await _runner.cleanup()
        logger.info("ChatGPT OAuth proxy stopped")

    _runner = None
    _site = None
