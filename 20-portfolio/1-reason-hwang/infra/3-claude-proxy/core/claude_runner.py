"""Claude Code CLI subprocess runner."""

import asyncio
import json
import logging
import shutil

from .constants import DEFAULT_CLAUDE_CWD, DEFAULT_CLAUDE_MODEL, DEFAULT_TIMEOUT_SECONDS

logger = logging.getLogger(__name__)


class ClaudeCodeUnavailableError(RuntimeError):
    """Raised when the Claude Code CLI cannot be executed."""


async def check_claude_available() -> bool:
    return shutil.which("claude") is not None


def resolve_cli_model(model: str | None) -> str | None:
    if model == "claude-code":
        return DEFAULT_CLAUDE_MODEL
    return model


async def run_claude_prompt(
    prompt: str,
    *,
    model: str | None = DEFAULT_CLAUDE_MODEL,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
    cwd: str | None = DEFAULT_CLAUDE_CWD,
) -> str:
    """Run Claude Code in print mode and return the text result."""
    if not await check_claude_available():
        raise ClaudeCodeUnavailableError("Claude Code CLI not found in PATH.")

    args = [
        "claude",
        "--bare",
        "-p",
        prompt,
        "--output-format",
        "json",
    ]
    cli_model = resolve_cli_model(model)
    if cli_model:
        args.extend(["--model", cli_model])

    process = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=cwd,
    )

    try:
        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=timeout_seconds,
        )
    except asyncio.TimeoutError as exc:
        process.kill()
        await process.wait()
        raise TimeoutError(f"Claude Code timed out after {timeout_seconds}s") from exc

    stdout_text = stdout.decode("utf-8", errors="replace")
    stderr_text = stderr.decode("utf-8", errors="replace")
    try:
        payload = json.loads(stdout_text)
    except json.JSONDecodeError:
        if process.returncode != 0:
            logger.warning("Claude Code failed: %s", stderr_text[:500])
            raise RuntimeError(stderr_text.strip() or stdout_text.strip() or "Claude Code failed")
        return stdout_text.strip()

    if isinstance(payload, dict):
        if payload.get("is_error"):
            raise RuntimeError(str(payload.get("result") or "Claude Code returned an error"))
        result = payload.get("result")
        if isinstance(result, str):
            return result
        structured = payload.get("structured_output")
        if structured is not None:
            return json.dumps(structured, ensure_ascii=False)

    if process.returncode != 0:
        logger.warning("Claude Code failed: %s", stderr_text[:500])
        raise RuntimeError(stderr_text.strip() or stdout_text.strip() or "Claude Code failed")

    return stdout_text.strip()
