"""Claude Code proxy configuration."""

import os

DEFAULT_PROXY_HOST = os.getenv("CLAUDE_PROXY_HOST", "127.0.0.1")
DEFAULT_PROXY_PORT = int(os.getenv("CLAUDE_PROXY_PORT", "18742"))
DEFAULT_TIMEOUT_SECONDS = int(os.getenv("CLAUDE_PROXY_TIMEOUT_SECONDS", "300"))
DEFAULT_CLAUDE_CWD = os.getenv("CLAUDE_PROXY_CWD") or None
DEFAULT_CLAUDE_MODEL = os.getenv("CLAUDE_CODE_MODEL") or None
DEFAULT_MODEL = "claude-code"
