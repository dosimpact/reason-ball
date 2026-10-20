# 기본 데모 에이전트의 진입점입니다. OpenAI 모델·mock 도구·패키지에 포함된 OpenUI 프롬프트를 연결합니다.
"""LangGraph Platform entry point; the browser and Next.js proxy stay unchanged."""

import os
from pathlib import Path

from deepagents import create_deep_agent
from langchain_openai import ChatOpenAI

from agent.canvas_graph import (
    describe_dataset,
    execute_analysis_query,
    publish_analysis_chart,
    validate_analysis_query,
)
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
    tools=[
        get_weather,
        get_stock_price,
        search_web,
        describe_dataset,
        publish_analysis_chart,
        validate_analysis_query,
        execute_analysis_query,
    ],
    system_prompt=PROMPT_PATH.read_text(encoding="utf-8")
    + "\n"
    + (
        "You build interactive Intelligent UI pages with the provided component library. "
        "For sales or advertising analytics charts, first describe_dataset, then publish_analysis_chart for EACH chart. Label data synthetic. "
        "Render each published chart as AnalysisChart(\"artifactId returned by the tool\"). Never invent IDs. "
        "Do not redraw its data with ordinary Chart: AnalysisChart supplies a working Add to Canvas button. "
        "For tables only, execute_analysis_query remains available. If publish fails, explain rather than invent a chart. "
        "Only query sales_daily or ad_daily. Use monthly SUM(revenue) or SUM(spend), "
        "CAST(date_trunc('month', day) AS DATE) AS period and SUM(revenue) AS value. "
        "Filter day >= $start_date AND day <= $end_date AND ($region = 'ALL' OR region = $region), GROUP BY 1 ORDER BY 1. "
        "Pass months and the requested region to publish_analysis_chart (or execute_analysis_query parameters for tables). "
        "For rolling recent N months set months=N and leave BOTH start_date/end_date empty. Only explicit fixed dates use BOTH dates. "
        "Never hardcode dates/regions in SQL; always use $start_date, $end_date, $region. Do not invent table names. "
        "When a tool returns an error, correct the query using its dataset schema before drawing a chart. "
        "Use the tools when they help answer the user's request, then answer only in OpenUI Lang. "
        "Weather, stock and search tools return demo data; do not present it as live data. Do not use filesystem, planning or subagent tools. "
        "When tools are needed, emit no text before or between tool calls. "
        "After all results arrive, emit exactly one complete OpenUI program, with one root. "
        "Copy tool result values into ordinary literal data declarations (data = {...}); "
        "do not invent or alter tool values. Reserve $variables for user-editable state, "
        "and always include the $ prefix when reading or writing that state. "
        "Every referenced identifier must be declared. Text size is xs, sm, md or lg; "
        "larger heading sizes belong only to Title. Follow each component signature exactly."
    ),
)


# LangGraph 서버가 실행마다 새 OpenUI 변환기를 만들 수 있도록 클래스를 반환합니다.
def stream_transformers():
    """LangGraph API creates a fresh transformer per run (protocol v2)."""
    return [OpenUIStreamTransformer]
