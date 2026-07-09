"""Standalone CLI for the Claude Code proxy."""

from __future__ import annotations

import argparse
import asyncio
import logging
import signal
import sys
from pathlib import Path

from aiohttp import web

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.constants import DEFAULT_PROXY_HOST, DEFAULT_PROXY_PORT  # noqa: E402
from core.proxy_server import create_app  # noqa: E402


async def _serve(host: str, port: int) -> int:
    app = create_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop_event.set)
        except NotImplementedError:
            pass

    display_host = "127.0.0.1" if host == "0.0.0.0" else host
    print(f"Claude Code proxy listening at http://{display_host}:{port}/v1")
    print(f"Health check: http://{display_host}:{port}/health")
    print("Press Ctrl+C to stop.")

    try:
        await stop_event.wait()
    finally:
        await runner.cleanup()

    return 0


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run the Claude Code proxy as a standalone local server.",
    )
    parser.add_argument("--serve", action="store_true", help="Start the proxy.")
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PROXY_PORT,
        help=f"Proxy port (default: {DEFAULT_PROXY_PORT}).",
    )
    parser.add_argument(
        "--host",
        default=DEFAULT_PROXY_HOST,
        help=f"Proxy bind host (default: {DEFAULT_PROXY_HOST}).",
    )
    return parser


def main() -> int:
    parser = _build_parser()
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")

    if not args.serve:
        parser.print_help()
        return 2

    return asyncio.run(_serve(host=args.host, port=args.port))


if __name__ == "__main__":
    raise SystemExit(main())
