"""Verify that the proxy can return an OpenAI SDK chat response."""

from __future__ import annotations

import os
import sys

from openai import OpenAI

DEFAULT_BASE_URL = "http://127.0.0.1:2890/v1"
DEFAULT_API_KEY = "chatgpt-oauth-placeholder"
DEFAULT_MODEL = "gpt-5.6-luna"
DEFAULT_TIMEOUT_SECONDS = 10.0


def main() -> int:
    client = OpenAI(
        base_url=os.environ.get("OPENAI_BASE_URL", DEFAULT_BASE_URL),
        api_key=os.environ.get("OPENAI_API_KEY", DEFAULT_API_KEY),
        timeout=DEFAULT_TIMEOUT_SECONDS,
        max_retries=0,
    )

    try:
        response = client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=[{"role": "user", "content": "한 문장으로 인사해줘."}],
        )
        content = response.choices[0].message.content
    except Exception as exc:
        print(f"Health check failed: {exc}", file=sys.stderr)
        return 1

    if not content or not content.strip():
        print("Health check failed: the proxy returned no content.", file=sys.stderr)
        return 1

    print(content)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
