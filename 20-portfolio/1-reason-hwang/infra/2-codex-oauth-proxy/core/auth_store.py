"""Read and write the local OAuth credentials file."""

from __future__ import annotations

import json
import os
from typing import Any

from .constants import AUTH_DIR, AUTH_FILE


def load_auth() -> dict[str, Any]:
    """Load OAuth credentials from disk."""
    with AUTH_FILE.open(encoding="utf-8") as auth_file:
        return json.load(auth_file)


def save_auth(auth_data: dict[str, Any]) -> None:
    """Atomically save OAuth credentials with owner-only permissions."""
    AUTH_DIR.mkdir(parents=True, exist_ok=True)
    temp_file = AUTH_FILE.with_suffix(".tmp")
    try:
        with temp_file.open("w", encoding="utf-8") as auth_file:
            json.dump(auth_data, auth_file, indent=2)
        os.chmod(temp_file, 0o600)
        temp_file.replace(AUTH_FILE)
    finally:
        temp_file.unlink(missing_ok=True)
