import json
from functools import lru_cache
from typing import Any, TypedDict

from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph

from app.config import Settings, get_settings
from app.schemas import (
    CanvasPatch,
    ChatStreamRequest,
    GenerativeResponse,
    GraphArtifact,
    GraphArtifactProps,
    MarkdownArtifact,
    MarkdownArtifactProps,
    ToolCallEvent,
)
from app.tools.analytics_data import select_analytics_context


class GraphState(TypedDict):
    request: ChatStreamRequest
    tool_calls: list[ToolCallEvent]
    analytics_data: list[dict[str, Any]]
    response: GenerativeResponse | None


def _wants_markdown(message: str) -> bool:
    text = message.lower()
    return any(term in text for term in ["markdown", "note", "summary", "memo", "요약", "메모", "노트"])


def _wants_chart(message: str) -> bool:
    text = message.lower()
    return any(
        term in text
        for term in [
            "chart",
            "graph",
            "bar",
            "line",
            "pie",
            "revenue",
            "sales",
            "product",
            "kpi",
            "차트",
            "그래프",
            "매출",
        ]
    )


def _wants_canvas_patch(message: str) -> bool:
    text = message.lower()
    return any(
        term in text
        for term in ["update", "change", "rename", "reorder", "patch", "수정", "변경", "이름", "정렬"]
    )


def _has_artifact(response: GenerativeResponse, component: str) -> bool:
    return any(artifact.component == component for artifact in response.artifacts)


def _fallback_response(request: ChatStreamRequest, analytics_data: list[dict[str, Any]]) -> GenerativeResponse:
    message = request.message
    labels: list[str]
    values: list[float]
    title = "Generated Analytics"

    if analytics_data and "month" in analytics_data[0]:
        labels = [str(row["month"]) for row in analytics_data]
        metric = "active" if "active" in analytics_data[0] else "revenue"
        values = [float(row[metric]) for row in analytics_data]
        title = "Monthly Active Users" if metric == "active" else "Monthly Revenue"
    elif analytics_data and "name" in analytics_data[0]:
        labels = [str(row["name"]) for row in analytics_data[:8]]
        metric = "revenue" if "revenue" in analytics_data[0] else "value"
        values = [float(row[metric]) for row in analytics_data[:8]]
        title = "Top Products" if metric == "revenue" else "KPI Overview"
    else:
        labels = ["Jan", "Feb", "Mar", "Apr"]
        values = [42, 55, 49, 68]

    if _wants_markdown(message):
        artifacts = [
            MarkdownArtifact(
                component="Markdown",
                props=MarkdownArtifactProps(
                    title="Generated Summary",
                    content=(
                        "### Analytics summary\n\n"
                        f"- Request: {message}\n"
                        f"- Rows reviewed: {len(analytics_data)}\n"
                        "- The dashboard can store this note next to generated charts."
                    ),
                    variant="callout",
                ),
            )
        ]
    else:
        chart_type = "line" if any(term in message.lower() for term in ["trend", "line", "추이"]) else "bar"
        artifacts = [
            GraphArtifact(
                component="Graph",
                props=GraphArtifactProps(
                    title=title,
                    data={
                        "type": chart_type,
                        "labels": labels,
                        "datasets": [
                            {
                                "label": title,
                                "data": values,
                                "color": "hsl(220, 100%, 62%)",
                            }
                        ],
                    },
                    showLegend=True,
                    variant="bordered",
                    size="sm",
                ),
            )
        ]

    canvas_patch = None
    active_components = request.canvas.activeCanvas.components if request.canvas and request.canvas.activeCanvas else []
    if active_components and _wants_canvas_patch(message):
        canvas_patch = CanvasPatch(
            components=[
                {
                    "componentType": component.componentType,
                    "id": component.id,
                    "title": f"{component.title or 'Dashboard item'} (AI updated)",
                    **({"chartType": "line"} if component.componentType == "Graph" else {}),
                    **(
                        {"content": f"{component.contentPreview}\n\n> Updated by LangGraph."}
                        if component.componentType == "Markdown"
                        else {}
                    ),
                }
                for component in active_components
            ]
        )

    return GenerativeResponse(
        message="I generated a dashboard-ready component from your request.",
        artifacts=artifacts,
        canvas_patch=canvas_patch,
    )


def _normalize_response(
    request: ChatStreamRequest,
    analytics_data: list[dict[str, Any]],
    response: GenerativeResponse,
) -> GenerativeResponse:
    fallback = _fallback_response(request, analytics_data)

    if not response.message.strip():
        response.message = fallback.message

    if _wants_markdown(request.message) and not _has_artifact(response, "Markdown"):
        response.artifacts.extend(fallback.artifacts)

    if _wants_chart(request.message) and not _has_artifact(response, "Graph"):
        response.artifacts.extend(fallback.artifacts)

    if (
        _wants_canvas_patch(request.message)
        and fallback.canvas_patch
        and not response.canvas_patch
    ):
        response.canvas_patch = fallback.canvas_patch

    if not response.artifacts and not response.canvas_patch:
        response.artifacts = fallback.artifacts

    return response


def _build_prompt(request: ChatStreamRequest, analytics_data: list[dict[str, Any]]) -> list[tuple[str, str]]:
    canvas_json = request.canvas.model_dump_json() if request.canvas else "null"
    history_json = json.dumps([message.model_dump() for message in request.history[-8:]], ensure_ascii=False)
    analytics_json = json.dumps(analytics_data, ensure_ascii=False)

    system = (
        "You are a UI generative backend replacing Tambo for an analytics dashboard. "
        "Return a concise assistant message and zero or more dashboard artifacts. "
        "Supported artifact components are Graph and Markdown only. "
        "Graph props must use chart data with type bar, line, or pie. "
        "If the user asks to edit existing dashboard items, include a canvas_patch that targets only ids present in the canvas snapshot. "
        "Do not invent component ids for patches. Generate artifacts for new visual output."
    )
    human = (
        f"User message:\n{request.message}\n\n"
        f"Recent history JSON:\n{history_json}\n\n"
        f"Analytics data JSON:\n{analytics_json}\n\n"
        f"Canvas snapshot JSON:\n{canvas_json}"
    )
    return [("system", system), ("human", human)]


async def _call_structured_llm(
    settings: Settings,
    request: ChatStreamRequest,
    analytics_data: list[dict[str, Any]],
) -> GenerativeResponse:
    if not settings.openai_api_key:
        return _fallback_response(request, analytics_data)

    messages = _build_prompt(request, analytics_data)
    errors: list[Exception] = []

    for model in [settings.openai_model, settings.openai_fallback_model]:
        try:
            llm = ChatOpenAI(
                api_key=settings.openai_api_key,
                model=model,
                timeout=45,
            ).with_structured_output(GenerativeResponse, method="function_calling")
            response = await llm.ainvoke(messages)
            if isinstance(response, GenerativeResponse):
                return _normalize_response(request, analytics_data, response)
            return _normalize_response(
                request,
                analytics_data,
                GenerativeResponse.model_validate(response),
            )
        except Exception as exc:  # pragma: no cover - covered through monkeypatched fallback tests
            errors.append(exc)

    if errors:
        return _fallback_response(request, analytics_data)

    return _fallback_response(request, analytics_data)


def _prepare_context(state: GraphState) -> dict[str, Any]:
    tool_name, tool_input, analytics_data = select_analytics_context(state["request"].message)
    return {
        "tool_calls": [ToolCallEvent(name=tool_name, input=tool_input)],
        "analytics_data": analytics_data,
    }


async def _generate(state: GraphState) -> dict[str, Any]:
    settings = get_settings()
    response = await _call_structured_llm(settings, state["request"], state["analytics_data"])
    response.tool_calls = state["tool_calls"]
    return {"response": response}


def build_graph():
    graph = StateGraph(GraphState)
    graph.add_node("prepare_context", _prepare_context)
    graph.add_node("generate", _generate)
    graph.add_edge(START, "prepare_context")
    graph.add_edge("prepare_context", "generate")
    graph.add_edge("generate", END)
    return graph.compile()


@lru_cache
def get_compiled_graph():
    return build_graph()


async def run_graph(request: ChatStreamRequest) -> GenerativeResponse:
    compiled = get_compiled_graph()
    result = await compiled.ainvoke(
        {
            "request": request,
            "tool_calls": [],
            "analytics_data": [],
            "response": None,
        }
    )
    response = result["response"]
    if response is None:
        raise RuntimeError("LangGraph did not return a response")
    return response
