# 기본 데모 에이전트의 진입점입니다. OpenAI 모델·mock 도구·패키지에 포함된 OpenUI 프롬프트를 연결합니다.
"""LangGraph Platform entry point; the browser and Next.js proxy stay unchanged."""

import os
from pathlib import Path

from deepagents import create_deep_agent
from langchain_openai import ChatOpenAI

from agent.streaming import OpenUIStreamTransformer
from agent.tools import get_stock_price, get_weather, search_web

PROMPT_PATH = Path(__file__).with_name("system-prompt.txt")

if not PROMPT_PATH.is_file():
    raise RuntimeError("Missing packaged OpenUI prompt: agent/system-prompt.txt")

model = ChatOpenAI(
    model=os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"),
    streaming=True,
    use_responses_api=False,
)
graph = create_deep_agent(
    model=model,
    tools=[get_weather, get_stock_price, search_web],
    system_prompt=PROMPT_PATH.read_text(encoding="utf-8")
    + "\n"
    + (
        "You are an OpenUI assistant with weather, finance, and research tools. "
        "Use the tools when they help answer the user's request, then answer only in OpenUI Lang. "
        "Weather, stock and search tools return demo data; do not present it as live data. "
        "Dashboard numbers invented for examples must be clearly labeled as sample data, never live data."
    ),
)


# LangGraph 서버가 실행마다 새 OpenUI 변환기를 만들 수 있도록 클래스를 반환합니다.
def stream_transformers():
    """LangGraph API creates a fresh transformer per run (protocol v2)."""
    return [OpenUIStreamTransformer]
