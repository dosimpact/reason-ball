"""자연어 계획과 위젯별 실행을 분리한 Python LangGraph."""

from __future__ import annotations

import asyncio
import json
import os
import re
from pathlib import Path
from typing import Literal, TypedDict
from uuid import uuid4

from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from agent import analysis

METRICS = {"modelCalls": 0, "queryRuns": 0}


@tool
def describe_dataset() -> dict:
    """Describe the synthetic analytics schema, grain, units and supported SQL."""
    return analysis.describe()


@tool
def validate_analysis_query(sql: str) -> dict:
    """Validate a read-only bounded DuckDB query before execution."""
    return {"validatedSql": analysis.validate_sql(sql)}


@tool
def execute_analysis_query(sql: str, parameters: dict) -> dict:
    """Execute a validated SQL query on synthetic sales and ads data."""
    METRICS["queryRuns"] += 1
    return analysis.execute(sql, parameters)


@tool
def register_analysis_query(sql: str, parameters: dict) -> dict:
    """Validate, execute and persist a versioned query for later model-free refresh."""
    METRICS["queryRuns"] += 1
    return analysis.register(sql, parameters)


class Parameters(BaseModel):
    region: Literal["ALL", "KR", "US", "JP"] = "ALL"
    period: Literal[
        "this_month",
        "last_month",
        "last_3_months",
        "last_6_months",
        "last_12_months",
        "custom",
    ] = "last_3_months"
    startDate: str | None = None
    endDate: str | None = None


class Operation(BaseModel):
    action: Literal[
        "create",
        "update",
        "refresh",
        "policy",
        "create_canvas",
        "rename_canvas",
        "select_canvas",
        "delete_canvas",
        "clear_canvas",
        "reorder_canvas",
        "move",
        "reorder",
        "remove",
    ]
    channel: Literal["chat", "canvas"] = "canvas"
    targetId: str | None = None
    canvasId: str | None = None
    title: str | None = None
    chartType: Literal["bar", "line", "pie", "table", "markdown"] | None = None
    sql: str | None = None
    parameters: Parameters | None = None
    content: str | None = None
    refreshPolicy: Literal["snapshot", "manual", "polling"] | None = None
    index: int | None = None


class Plan(BaseModel):
    message: str = Field(
        description="Korean explanation or clarification. Do not claim success before execution. Cite supplied data only."
    )
    general: bool = Field(
        default=False,
        description="True for non-analytics requests needing the original full OpenUI component library, e.g. calculator, game, form.",
    )
    operations: list[Operation] = Field(default_factory=list, max_length=8)


class CanvasState(TypedDict):
    request: dict
    plan: Plan


def emit(kind, **payload):
    get_stream_writer()({"type": kind, **payload})


def model():
    return ChatOpenAI(
        model=os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"),
        streaming=True,
        use_responses_api=False,
        timeout=90,
        max_retries=1,
    )


PLANNER_PROMPT = """You plan a Korean analytics Chat + Dynamic Canvas app. Return a structured plan.
Never change a canvas merely because the word canvas appears. Explaining or reading an existing chart uses message only, no operations.
Normal analytics requests create independent CHAT previews. Only explicit canvas creation or editing requests change canvas. Multiple charts = separate create operations.
Resolve targetId using the actual widget IDs and canvasId using actual canvas IDs in context. 'this chart' uses selectedWidgetId. If targets are ambiguous or modification is missing, ask a question and emit no operations. Do not silently choose among duplicate titles.
For a new data chart write a single parameterized DuckDB SELECT against the described tables. All $region, $start_date, $end_date placeholders must appear. Use monthly_metrics for monthly sales/ads/comparisons; aggregate SUM values GROUP BY month. Use sales_daily/ad_daily for day/campaign questions. Never invent data. For period/region-only updates leave sql=null and reuse the existing query. For title/type-only updates leave parameters=null to preserve existing filters. For hypothetical value changes, ask for a separate scenario (do not overwrite real data).
SQL result must contain a text category column and numeric value columns. strftime(month,'%Y-%m') AS month is useful. Ratios use NULLIF denominator. No raw joins or external reads.
Default region is ALL unless the user explicitly selected or requested a region. Never infer KR just because the user speaks Korean.
Separate charts should have appropriately different SQL columns (revenue vs spend). If no explicit period, use last_3_months. '지난달' means last_month, '최근 3개월' last_3_months, '한국' KR.
For markdown summary cards use chartType markdown and content grounded in supplied data. For new analysis requiring numbers use a query-backed chart/table, not invented Markdown numbers.
refresh reuses query and parameters. policy can set snapshot, manual, polling (60 seconds). Data refresh never requires regenerating UI.
Canvas management actions require existing valid IDs; create_canvas uses title. move uses targetId widget + canvasId destination; reorder uses index zero-based. For deletion the frontend will request user confirmation.
Use neutral chart titles without embedded period/region unless explicitly requested as a title. Never translate rolling periods to custom dates; use the matching period enum.
Do not claim actions succeeded. Explain requested intent briefly, actual results are emitted separately. For existing charts explain the visible rows and metadata including synthetic origin; no causal conclusions without evidence.
For non-analytics requests set general=true and operations=[]; a second model stage generates full OpenUI. For ambiguous analytics intent set general=false and ask a concise question.
Example: '채팅에 카운터를 만들어줘. Canvas는 수정하지 마' => general=true, operations=[]. Forms, counters, calculators and games are NOT create operations. Never write OpenUI source in an operation's content field; content is plain Markdown prose only.
"""


async def plan_node(state):
    request = state["request"]
    if request.get("retryOperations"):
        return {
            "plan": Plan(
                message="실패한 위젯만 다시 처리합니다.",
                operations=request["retryOperations"],
            )
        }
    emit("progress", message="요청과 Canvas 맥락을 확인하고 있습니다.")
    schema = await asyncio.to_thread(describe_dataset.invoke, {})
    emit("tool", name="describe_dataset", status="complete")
    context = {
        "canvases": request.get("canvases", []),
        "activeCanvasId": request.get("activeCanvasId"),
        "selectedWidgetId": request.get("selectedWidgetId"),
        "widgets": request.get("widgets", []),
        "chatArtifacts": request.get("chatArtifacts", [])[-8:],
    }
    messages = [
        (
            "system",
            PLANNER_PROMPT + "\nDATASET:\n" + json.dumps(schema, ensure_ascii=False),
        ),
        (
            "user",
            json.dumps(
                {
                    "request": request["message"],
                    "history": request.get("history", [])[-12:],
                    "context": context,
                },
                ensure_ascii=False,
            ),
        ),
    ]
    # 모델이 제안한 SQL을 실행 전에 검사하고, 제한된 횟수로 오류를 돌려준다.
    for attempt in range(3):
        METRICS["modelCalls"] += 1
        result = await model().with_structured_output(Plan).ainvoke(messages)
        # 같은 제목은 모델의 추정만으로 한 개를 고르지 않는다.
        by_id = {widget["id"]: widget for widget in request.get("widgets", [])}
        for operation in result.operations:
            target = by_id.get(operation.targetId)
            if not target or operation.action == "create":
                continue
            same_title = [
                widget
                for widget in by_id.values()
                if widget.get("title") == target.get("title")
                and widget.get("canvasId") == target.get("canvasId")
            ]
            explicit_target = (
                request.get("selectedWidgetId") == operation.targetId
                or operation.targetId in request["message"]
            )
            bulk = re.search(
                r"모두|둘\s*다|전체|\b(all|both|each)\b",
                request["message"],
                re.IGNORECASE,
            )
            if len(same_title) > 1 and not explicit_target and not bulk:
                return {
                    "plan": Plan(
                        message=f'"{target["title"]}" 이름의 위젯이 {len(same_title)}개 있습니다. 변경할 위젯을 먼저 선택해 주세요.'
                    )
                }
        failures = []
        for op in result.operations:
            if op.action == "create" and not op.sql and op.chartType != "markdown":
                failures.append(
                    "A new data chart needs SQL. For a counter/form/calculator/game use general=true and operations=[] instead. The full OpenUI generator will handle it."
                )
            if op.sql:
                try:
                    await asyncio.to_thread(
                        validate_analysis_query.invoke, {"sql": op.sql}
                    )
                except analysis.AnalysisError as error:
                    failures.append(str(error))
        if not failures or attempt == 2:
            return {"plan": result}
        emit("progress", message="조회 조건과 SQL을 검증하고 있습니다.")
        messages.extend(
            [
                ("assistant", result.model_dump_json()),
                (
                    "user",
                    "Correct the proposed plan using these plan validator errors: "
                    + json.dumps(failures)
                    + ". Required placeholders must be unquoted SQL parameters: $region, $start_date, $end_date. Do not replace them with literal dates or regions. Reuse exampleSql shape from the dataset, changing only select columns as needed.",
                ),
            ]
        )
    raise RuntimeError("Unreachable plan state")


def chart_program(binding_id, chart_type, title, content=None):
    q = lambda s: json.dumps(s, ensure_ascii=False)
    if chart_type == "markdown":
        return f'root = Col([Title({q(title)}, "sm"), Markdown({q(content or "설명을 입력하세요.")} )])'
    return f'root = Col([Title({q(title)}, "sm"), CanvasData({q(binding_id)}, {q(chart_type or "bar")})])'


async def execute_node(state):
    request, plan = state["request"], state["plan"]
    if plan.message:
        emit(
            "message",
            text=plan.message
            if not plan.operations
            else "요청하신 분석과 Canvas 작업을 진행합니다.",
        )
    if plan.general:
        METRICS["modelCalls"] += 1
        prompt = Path(__file__).with_name("system-prompt.txt").read_text()
        wid = str(uuid4())
        emit("start", channel="chat", widgetId=wid, baseRevision=0, title="OpenUI 응답")
        program = ""
        async for chunk in model().astream(
            [
                (
                    "system",
                    prompt
                    + "\nRespond with exactly one complete OpenUI program. No code fences. Use root Col. Use Text sizes xs/sm/md/lg. Every identifier must be declared. Never present invented analytics as real data.",
                ),
                *[
                    (m["role"], m["content"])
                    for m in request.get("history", [])[-8:]
                    if m.get("role") in {"user", "assistant"}
                ],
                ("user", request["message"]),
            ]
        ):
            if isinstance(chunk.content, str) and chunk.content:
                program += chunk.content
                emit("delta", channel="chat", widgetId=wid, delta=chunk.content)
        emit(
            "complete",
            channel="chat",
            widgetId=wid,
            widget={
                "id": wid,
                "title": "OpenUI 응답",
                "program": program,
                "chartType": "custom",
                "definitionRevision": 1,
                "rendererContractVersion": 1,
                "catalogVersion": 1,
                "refreshPolicy": "snapshot",
                "uiState": {},
                "layout": {"w": 6, "h": 9},
            },
        )
        return {}
    widgets = {w["id"]: w for w in request.get("widgets", [])}
    canvas_ids = {c["id"] for c in request.get("canvases", [])}
    for op in plan.operations:
        # 기존 Canvas 위젯 수정은 모델이 제안한 출력 채널과 무관하게 그 위젯에 적용한다.
        if op.action in {"update", "refresh"}:
            op = op.model_copy(update={"channel": "canvas"})
        wid = str(uuid4()) if op.action == "create" else op.targetId
        current = widgets.get(wid, {})
        base = current.get("definitionRevision", 0)
        try:
            if op.action not in {"create", "create_canvas"}:
                target = (
                    op.canvasId or op.targetId
                    if op.action.endswith("canvas")
                    else op.targetId
                )
                if target not in (
                    canvas_ids if op.action.endswith("canvas") else widgets
                ):
                    raise analysis.AnalysisError(
                        "대상을 찾을 수 없습니다. 차트 또는 Canvas를 선택해 주세요."
                    )
            if op.action not in {"create", "update", "refresh"}:
                emit("command", operation=op.model_dump(exclude_none=True))
                continue
            canvas_id = (
                op.canvasId or current.get("canvasId") or request.get("activeCanvasId")
            )
            if op.channel == "canvas" and canvas_id not in canvas_ids:
                raise analysis.AnalysisError("대상 Canvas를 선택해 주세요.")
            emit(
                "start",
                channel=op.channel,
                widgetId=wid,
                baseRevision=base,
                title=op.title or current.get("title", "분석 차트"),
                canvasId=canvas_id,
            )
            params = (
                op.parameters.model_dump(exclude_none=True)
                if op.parameters
                else current.get(
                    "parameters", {"region": "ALL", "period": "last_3_months"}
                )
            )
            # 명시적인 상대 기간은 서버 시계 기준 rolling 조건으로 보존한다.
            # 출력 채널/변경 의도는 LangGraph 계획이 결정하고, 여기서는 파라미터만 정규화한다.
            relative = re.search(
                r"최근\s*(3|6|12)\s*개월|last\s*(3|6|12)\s*months",
                request["message"],
                re.IGNORECASE,
            )
            if op.parameters or op.action == "create":
                if relative:
                    params = {
                        **params,
                        "period": f"last_{relative.group(1) or relative.group(2)}_months",
                    }
                elif re.search(
                    r"지난\s*달|last month", request["message"], re.IGNORECASE
                ):
                    params = {**params, "period": "last_month"}
                elif re.search(
                    r"이번\s*달|this month", request["message"], re.IGNORECASE
                ):
                    params = {**params, "period": "this_month"}
            chart_type = op.chartType or current.get("chartType", "bar")
            result = None
            if op.sql:
                emit(
                    "tool",
                    name="validate_analysis_query",
                    status="running",
                    widgetId=wid,
                )
                await asyncio.to_thread(validate_analysis_query.invoke, {"sql": op.sql})
                result = await asyncio.to_thread(
                    register_analysis_query.invoke,
                    {"sql": op.sql, "parameters": params},
                )
                emit(
                    "tool",
                    name="register_analysis_query",
                    status="complete",
                    widgetId=wid,
                )
            elif current.get("queryId") and (op.parameters or op.action == "refresh"):
                METRICS["queryRuns"] += 1
                snapshot = await asyncio.to_thread(
                    analysis.run_saved_query,
                    current["queryId"],
                    current["queryVersion"],
                    params,
                )
                result = {
                    "queryId": current["queryId"],
                    "queryVersion": current["queryVersion"],
                    "resultSchemaVersion": 1,
                    "snapshot": snapshot,
                }
            elif op.action == "create" and chart_type != "markdown":
                raise analysis.AnalysisError(
                    "조회 SQL이 없어 차트를 만들지 않았습니다. 다시 요청해 주세요."
                )
            binding_id = current.get("bindingId") or str(uuid4())
            title = op.title or current.get("title", "분석 결과")
            content = op.content if op.content is not None else current.get("content")
            program = (
                current.get("program")
                if op.action == "refresh"
                else chart_program(binding_id, chart_type, title, content)
            )
            widget = {
                **current,
                "id": wid,
                "canvasId": canvas_id,
                "title": title,
                "program": program,
                "chartType": chart_type,
                **({"content": content} if content is not None else {}),
                "parameters": params,
                "bindingId": binding_id,
                "definitionRevision": base + (0 if op.action == "refresh" else 1),
                "rendererContractVersion": 1,
                "catalogVersion": 1,
                "refreshPolicy": current.get("refreshPolicy", "manual"),
                "uiState": current.get("uiState", {}),
                "layout": current.get("layout", {"w": 6, "h": 9}),
            }
            if result:
                widget.update(result)
                widget["parameters"] = result["snapshot"]["parameters"]
            if op.action == "refresh":
                emit(
                    "refreshed",
                    channel=op.channel,
                    widgetId=wid,
                    baseRevision=base,
                    widget=widget,
                )
            else:
                for offset in range(0, len(program), 64):
                    emit(
                        "delta",
                        channel=op.channel,
                        widgetId=wid,
                        delta=program[offset : offset + 64],
                    )
                    await asyncio.sleep(0)
                emit(
                    "complete",
                    channel=op.channel,
                    widgetId=wid,
                    baseRevision=base,
                    widget=widget,
                )
            snapshot = widget.get("snapshot")
            if snapshot:
                scope = snapshot["resolvedRange"]
                emit(
                    "message",
                    text=f"\n{title}: {scope['region']} · {scope['start_date']}~{scope['end_date']} · {snapshot['rowCount']}행의 합성 데이터를 표시했습니다.",
                )
        except (analysis.AnalysisError, ValueError) as e:
            emit(
                "failed",
                channel=op.channel,
                widgetId=wid,
                message=str(e),
                retryOperation=op.model_dump(exclude_none=True),
            )
    return {}


builder = StateGraph(CanvasState)
builder.add_node("plan", plan_node)
builder.add_node("execute", execute_node)
builder.add_edge(START, "plan")
builder.add_edge("plan", "execute")
builder.add_edge("execute", END)
canvas_graph = builder.compile()
