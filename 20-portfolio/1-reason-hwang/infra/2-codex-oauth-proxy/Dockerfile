FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    CHATGPT_OAUTH_PROXY_HOST=0.0.0.0 \
    CHATGPT_OAUTH_PROXY_PORT=18741

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY core ./core
COPY proxy-server ./proxy-server
COPY examples ./examples
COPY README.md ./

EXPOSE 18741

CMD ["uv", "run", "python", "proxy-server/main.py", "--serve", "--host", "0.0.0.0", "--port", "18741", "--no-inject-env"]
