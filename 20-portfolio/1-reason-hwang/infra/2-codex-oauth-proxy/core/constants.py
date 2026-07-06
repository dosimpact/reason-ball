"""ChatGPT OAuth Proxy - Constants and configuration."""

import os
from pathlib import Path

# OAuth Constants (official Codex CLI values)
OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
OAUTH_AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize"
OAUTH_TOKEN_URL = "https://auth.openai.com/oauth/token"
OAUTH_SCOPE = "openid profile email offline_access"
OAUTH_CALLBACK_PORT = 1455
OAUTH_REDIRECT_URI = f"http://localhost:{OAUTH_CALLBACK_PORT}/auth/callback"

# ChatGPT API
CHATGPT_API_BASE = "https://chatgpt.com/backend-api/codex"
CHATGPT_RESPONSES_URL = f"{CHATGPT_API_BASE}/responses"

# Project root and token storage
PROJECT_ROOT = Path(__file__).resolve().parents[1]
AUTH_DIR = PROJECT_ROOT / ".config"
AUTH_FILE = AUTH_DIR / "chatgpt_auth.json"

# Proxy
DEFAULT_PROXY_HOST = os.getenv("CHATGPT_OAUTH_PROXY_HOST", "127.0.0.1")
DEFAULT_PROXY_PORT = int(os.getenv("CHATGPT_OAUTH_PROXY_PORT", "18741"))

# Token refresh buffer (seconds)
TOKEN_REFRESH_BUFFER = 300  # 5 minutes
