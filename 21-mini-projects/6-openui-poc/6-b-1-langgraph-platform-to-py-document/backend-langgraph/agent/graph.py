# 문서 비교 에이전트를 구성합니다. UI 카탈로그 프롬프트와 현재 문서 목록을 결합하고 실제 검색 도구를 연결합니다.
"""LangGraph Platform entry point; the browser and Next.js proxy stay unchanged."""

import os
from pathlib import Path

from deepagents import create_deep_agent
from langchain_openai import ChatOpenAI

from agent.documents import search_documents
from agent.streaming import OpenUIStreamTransformer

PROMPT_PATH = Path(__file__).with_name("system-prompt.txt")
if not PROMPT_PATH.is_file():
    raise RuntimeError("Missing packaged OpenUI prompt: agent/system-prompt.txt")

model = ChatOpenAI(
    model=os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"),
    streaming=True,
    use_responses_api=False,
)


# 현재 문서 목록을 프롬프트에 결합해 요청용 그래프를 만듭니다. 비교 근거 도구는 search_documents입니다.
def build_graph(documents):
    import json

    return create_deep_agent(
        model=model,
        tools=[search_documents],
        system_prompt=PROMPT_PATH.read_text(encoding="utf-8")
        + "\nCompare only these indexed documents: "
        + json.dumps(documents, ensure_ascii=False)
        + "\nUse only search_documents for evidence. Do not use filesystem, planning or subagent tools. "
        "Search once per criterion across all selected documents in one call. "
        "Use descriptive queries such as total net revenue for the latest fiscal year and growth compared to prior year. "
        "If passages do not explicitly contain the requested figure, retry with different wording and 4 passages, even if found=true. "
        "Never derive total revenue from percentages or expenses. Never estimate or invent quotations. "
        "If evidence remains absent, say Not found in retrieved passages, not absent from the report. "
        "Only use returned passages, cite their document/page and exact source URL. "
        "Never invent a missing value, never chart missing values as zero. "
        "Write no text before or between searches. Return the comparison in OpenUI Lang after searches. "
        "On follow-ups preserve earlier documents and criteria. A search error is not evidence of absence.",
    )


graph = build_graph([])


# LangGraph 서버가 실행마다 새 OpenUI 변환기를 만들 수 있도록 클래스를 반환합니다.
def stream_transformers():
    """LangGraph API creates a fresh transformer per run (protocol v2)."""
    return [OpenUIStreamTransformer]
