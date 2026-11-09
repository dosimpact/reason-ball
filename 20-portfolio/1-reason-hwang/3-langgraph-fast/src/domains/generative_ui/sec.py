"""SEC business actions, independent of the UI wire protocol."""
from copy import deepcopy
from datetime import UTC, datetime
from typing import Any

from domains.tenk.a2ui_report import generate_report, prepare_report_source
from domains.tenk.a2ui_report_plan import default_report_plan, plan_report
from domains.tenk.sec_client import SecClient
from graph.provider.ui_model import ModelSettings
from .contracts import ActionError

async def execute_action(state: dict, name: str, context: dict, client: SecClient, model: Any = None) -> dict:
    next_state = deepcopy(state)
    if name == "sec_search":
        result = await client.companies(context["query"], context["page"])
        next_state = {"query": context["query"], "companies": result}
        next_state["notice"] = "회사를 선택해 주세요." if result["items"] else "검색 결과가 없습니다. 검색어를 바꿔 주세요."
    elif name == "sec_company":
        company = next((row for row in state.get("companies", {}).get("items", []) if row["cik"] == context["cik"]), None)
        if company is None:
            raise ActionError("현재 검색 결과에 없는 회사입니다.")
        result = await client.filings(company["cik"])
        next_state = {key: value for key, value in state.items() if key in {"query", "companies"}}
        next_state.update(company=company, filings=result, notice="분석할 공시를 선택해 주세요." if result["items"] else "저장된 공시가 없습니다.")
    elif name in {"sec_filings_page", "sec_filings_filter"}:
        if not state.get("company"):
            raise ActionError("먼저 회사를 선택해 주세요.")
        filters = {key: context[key] for key in ("status", "form", "since")} if name == "sec_filings_filter" else state.get("filters", {})
        next_state["filings"] = await client.filings(state["company"]["cik"], context.get("page", 1), **filters)
        next_state["filters"] = filters
        for key in ("filing", "report", "report_source_label", "report_plan", "report_request"):
            next_state.pop(key, None)
        next_state["notice"] = "분석할 공시를 선택해 주세요." if next_state["filings"]["items"] else "조건에 맞는 공시가 없습니다. 필터를 변경해 주세요."
    elif name == "sec_filing":
        filing = next((row for row in state.get("filings", {}).get("items", []) if row["accessionNo"] == context["accession"]), None)
        if filing is None or filing["cik"] != state.get("company", {}).get("cik"):
            raise ActionError("현재 회사의 공시 목록에 없는 문서입니다.")
        next_state["filing"] = filing
        next_state.pop("report", None)
        next_state.pop("report_source_label", None)
        next_state.pop("report_plan", None)
        next_state.pop("report_request", None)
        next_state["notice"] = "선택한 공시로 보고서를 생성할 수 있습니다." if filing.get("status") == "downloaded" else "원문이 저장되지 않아 보고서를 생성할 수 없습니다."
    elif name == "sec_report":
        request = context.get("request", "")
        if not isinstance(request, str) or len(request) > 500:
            raise ActionError("분석 요청은 500자 이내로 입력해 주세요.")
        request = request.strip()
        filing = state.get("filing") or {}
        if not filing or filing.get("cik") != state.get("company", {}).get("cik"):
            raise ActionError("먼저 현재 회사의 공시를 선택해 주세요.")
        if filing.get("status") != "downloaded":
            raise ActionError("원문이 저장되지 않아 보고서를 생성할 수 없습니다.")
        content = await client.content(filing["cik"], filing["accessionNo"])
        retrieved_at = datetime.now(UTC).isoformat()
        source = prepare_report_source(content, filing["formType"])
        report_model = model or ModelSettings.from_env().build()
        plan = await plan_report(report_model, request) if request else default_report_plan()
        report = await generate_report(report_model, source, request=request, sections=[item.section for item in plan.sections]) if request else await generate_report(report_model, source)
        next_state["report"] = report.model_dump()
        next_state["report_plan"] = plan.model_dump()
        next_state["report_request"] = request
        next_state["report_source_label"] = (
            f"{state['company']['name']} · CIK {filing['cik']} · {filing['formType']} · {filing['accessionNo']} · "
            f"원문 조회 {retrieved_at} · 정규화 {source.normalized_characters:,}자 중 {source.included_characters:,}자 발췌 · "
            f"SHA-256 {source.sha256} · " + "; ".join(f"{item.id}: {item.section}" for item in source.evidence)
        )
        next_state["notice"] = "분석 보고서를 생성했습니다. 인용 근거와 분석 한계를 함께 확인해 주세요."
    else:
        raise ActionError("지원하지 않는 SEC action입니다.")
    return next_state

