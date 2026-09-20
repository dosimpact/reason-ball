"""Company → filing → cited report; queries and actions share one isolated thread."""
from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from copilotkit import a2ui
from langchain.agents.middleware import AgentState
from langchain.tools import ToolRuntime, tool
from langchain_core.messages import AIMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode

from domains.tenk.a2ui_report import ReportError, generate_report, prepare_report_source
from domains.tenk.sec_client import SecClient, SecReadError
from graph.primary_graphs.a2ui_demo.contract import ContractError, validate_operations
from graph.primary_graphs.a2ui_demo.model import ModelSettings

from .surface import render_surface, validate_action


class SecState(AgentState, total=False):
    surfaces: dict
    sec: dict
    a2ui_action: dict | None
    pending_operations: list[dict]


async def execute_action(state: dict, name: str, context: dict, client: SecClient, model: Any = None) -> dict:
    next_state = deepcopy(state)
    if name == "sec_search":
        result = await client.companies(context["query"], context["page"])
        next_state = {"query": context["query"], "companies": result}
        next_state["notice"] = "회사를 선택해 주세요." if result["items"] else "검색 결과가 없습니다. 검색어를 바꿔 주세요."
    elif name == "sec_company":
        company = next((row for row in state.get("companies", {}).get("items", []) if row["cik"] == context["cik"]), None)
        if company is None:
            raise ContractError("현재 검색 결과에 없는 회사입니다.")
        result = await client.filings(company["cik"])
        next_state = {key: value for key, value in state.items() if key in {"query", "companies"}}
        next_state.update(company=company, filings=result, notice="분석할 공시를 선택해 주세요." if result["items"] else "저장된 공시가 없습니다.")
    elif name in {"sec_filings_page", "sec_filings_filter"}:
        if not state.get("company"):
            raise ContractError("먼저 회사를 선택해 주세요.")
        filters = {key: context[key] for key in ("status", "form", "since")} if name == "sec_filings_filter" else state.get("filters", {})
        next_state["filings"] = await client.filings(state["company"]["cik"], context.get("page", 1), **filters)
        next_state["filters"] = filters
        for key in ("filing", "report", "report_source_label"):
            next_state.pop(key, None)
        next_state["notice"] = "분석할 공시를 선택해 주세요."
    elif name == "sec_filing":
        filing = next((row for row in state.get("filings", {}).get("items", []) if row["accessionNo"] == context["accession"]), None)
        if filing is None or filing["cik"] != state.get("company", {}).get("cik"):
            raise ContractError("현재 회사의 공시 목록에 없는 문서입니다.")
        next_state["filing"] = filing
        next_state.pop("report", None)
        next_state.pop("report_source_label", None)
        next_state["notice"] = "선택한 공시로 보고서를 생성할 수 있습니다." if filing.get("status") == "downloaded" else "원문이 저장되지 않아 보고서를 생성할 수 없습니다."
    elif name == "sec_report":
        filing = state.get("filing") or {}
        if not filing or filing.get("cik") != state.get("company", {}).get("cik"):
            raise ContractError("먼저 현재 회사의 공시를 선택해 주세요.")
        content = await client.content(filing["cik"], filing["accessionNo"])
        retrieved_at = datetime.now(UTC).isoformat()
        source = prepare_report_source(content, filing["formType"])
        report = await generate_report(model or ModelSettings.from_env().build(), source)
        next_state["report"] = report.model_dump()
        next_state["report_source_label"] = (
            f"{state['company']['name']} · CIK {filing['cik']} · {filing['formType']} · {filing['accessionNo']} · "
            f"원문 조회 {retrieved_at} · 정규화 {source.normalized_characters:,}자 중 {source.included_characters:,}자 발췌 · "
            f"SHA-256 {source.sha256} · " + "; ".join(f"{item.id}: {item.section}" for item in source.evidence)
        )
        next_state["notice"] = "분석 보고서를 생성했습니다. 인용 근거와 분석 한계를 함께 확인해 주세요."
    else:
        raise ContractError("지원하지 않는 SEC action입니다.")
    return next_state


def build_sec_graph(client: SecClient | None = None, model: Any = None):
    client = client or SecClient()

    async def run(state: SecState):
        surfaces = state.get("surfaces", {})
        previous = state.get("sec", {})
        current = previous
        action = state.get("a2ui_action")
        surface_id = next(iter(surfaces), f"sec-{uuid4().hex}")
        try:
            if action:
                context = validate_action(action, surfaces)
                current = await execute_action(previous, action["name"], context, client, model)
            else:
                query = next((message.content for message in reversed(state["messages"]) if message.type == "human"), "")
                if isinstance(query, str) and query.strip():
                    current = await execute_action(previous, "sec_search", {"query": query.strip(), "page": 1}, client, model)
        except (SecReadError, ReportError, ContractError) as error:
            current = {**previous, "notice": str(error)}
        current = {**current, "revision": previous.get("revision", 0) + 1}
        operations = render_surface(surface_id, current, create=not surfaces)
        next_surfaces = validate_operations("sec", operations, existing=surfaces)
        call_id = f"sec-{uuid4().hex}"
        return {
            "sec": current, "surfaces": next_surfaces, "a2ui_action": None,
            "pending_operations": operations,
            "messages": [
                AIMessage(content="", tool_calls=[{"id": call_id, "name": "render_sec_surface", "args": {}}]),
            ],
        }

    @tool
    def render_sec_surface(runtime: ToolRuntime) -> str:
        """Publish the already validated SEC surface through an actual tool result."""
        return a2ui.render(runtime.state["pending_operations"])

    def finish(state: SecState):
        return {"pending_operations": [], "messages": [AIMessage(content=state.get("sec", {}).get("notice", "SEC 조회 화면을 준비했습니다."))]}

    graph = StateGraph(SecState)
    graph.add_node("sec", run)
    graph.add_node("render", ToolNode([render_sec_surface]))
    graph.add_node("finish", finish)
    graph.add_edge(START, "sec")
    graph.add_edge("sec", "render")
    graph.add_edge("render", "finish")
    graph.add_edge("finish", END)
    return graph.compile(checkpointer=InMemorySaver())
