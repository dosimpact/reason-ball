"""Small OpenAI SDK smoke test for the local proxy.

Run from chatgpt-oauth-proxy after starting the proxy:

    uv run python proxy-server/main.py --serve
    OPENAI_BASE_URL=http://127.0.0.1:18741/v1 \
    OPENAI_API_KEY=chatgpt-oauth-placeholder \
    uv run python examples/sdk.py
"""

from openai import OpenAI


def main() -> None:
    client = OpenAI()
    resp = client.chat.completions.create(
        model="gpt-5.4-mini",
        messages=[{"role": "user", "content": "한 문장으로 인사해줘."}],
    )
    print(resp.choices[0].message.content)


if __name__ == "__main__":
    main()
