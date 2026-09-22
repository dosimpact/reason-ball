"""Stage-led SEC screens with direct result actions and progressive disclosure."""
from copilotkit import a2ui

from graph.primary_graphs.a2ui_demo.contract import MANIFEST, ContractError

from .financial_surface import add_financial_surface
from .report_surface import report_components


class SurfaceBuilder:
    def __init__(self, revision: int):
        self.components = []
        self.revision = revision

    def add(self, id: str, component: str, **props):
        self.components.append({"id": id, "component": component, **props})

    def button(self, id: str, label: str, name: str, context: dict | None = None, disabled: bool = False, variant: str = "default"):
        self.add(id, "Button", label=label, disabled=disabled, variant=variant,
                 action={"event": {"name": name, "context": {"revision": self.revision, **(context or {})}}})


def render_surface(surface_id: str, state: dict, *, create: bool) -> list[dict]:
    ui = SurfaceBuilder(state.get("revision", 0))
    company, filing = state.get("company") or {}, state.get("filing") or {}
    companies = state.get("companies", {}).get("items", [])
    visible = ["stage"]
    ui.add("root", "Column", children=visible)
    stage = "분석 결과" if state.get("report") or state.get("financial_plan") else "3 · 분석할 내용 선택" if filing else "2 · 공시 선택" if company else "1 · 회사 선택"
    ui.add("stage", "Text", text=stage, variant="heading")
    if state.get("error_notice"):
        visible.append("notice")
        ui.add("notice", "Alert", title="다시 시도해 주세요", text=state["error_notice"], variant="destructive")
    if company:
        visible.append("selected-company")
        ui.add("selected-company", "Text", text=f"{company['name']} · {company.get('ticker') or company['cik']}")
    if state.get("report"):
        if filing:
            visible.append("report-document")
            ui.add("report-document", "Text", text=f"{filing['formType']} · 보고기간 {filing.get('reportDate') or '정보 없음'} · 제출 {filing.get('filingDate') or '-'}", variant="caption")
        visible.append("report")
        ui.components.extend(report_components(state))
    if company:
        visible.append("filings")
        _add_filings(ui, state, filing)
        visible.append("search")
        _add_search(ui, collapsed=True)
    else:
        visible.append("search")
        _add_search(ui)
        if "companies" in state:
            visible.append("companies" if companies else "companies-empty")
            _add_companies(ui, state, companies)
    data = {"query": state.get("query", ""), "reportRequest": state.get("report_request", "")}
    data.update({f"{key}Filter": state.get("filters", {}).get(key, "") for key in ("status", "form", "since")})
    if state.get("financial_plan") and state.get("financial_dataset"):
        add_financial_surface(ui, state, visible, data)
        visible.remove("financial-result")
        visible.insert(2, "financial-result")
    operations = [a2ui.create_surface(surface_id, MANIFEST["catalogs"]["sec"]["catalogId"])] if create else []
    return [*operations, a2ui.update_components(surface_id, ui.components), a2ui.update_data_model(surface_id, data)]


def _add_search(ui: SurfaceBuilder, collapsed: bool = False):
    # Keep the component type stable across same-ID updates.
    ui.add("search", "Column", children=["change-company"] if collapsed else ["search-fields"])
    if collapsed:
        ui.add("change-company", "Collapsible", title="다른 회사 찾기", child="search-fields")
    ui.add("search-fields", "Column", children=["query", "search-button"], gap=8)
    ui.add("query", "Input", label="회사명 또는 티커", value={"path": "/query"}, placeholder="예: CPNG, AAPL")
    ui.button("search-button", "회사 검색", "sec_search", {"query": {"path": "/query"}, "page": 1}, variant="outline")


def _add_companies(ui: SurfaceBuilder, state: dict, companies: list):
    if not companies:
        ui.add("companies-empty", "Alert", title="일치하는 회사가 없습니다", text="영문 회사명이나 티커로 다시 검색해 주세요. 예: Coupang 또는 CPNG")
        return
    children = ["company-status"]
    ui.add("companies", "Column", children=children)
    ui.add("company-status", "Text", text="회사를 고르면 분석 가능한 연간보고서를 보여드립니다.", variant="caption")
    for index, row in enumerate(companies):
        id = f"company-row-{index}"
        button = "company-select" if index == 0 else f"company-select-{index}"
        children.append(id)
        ui.add(id, "Card", title=row["name"], description=row.get("ticker") or f"CIK {row['cik']}", child=button)
        ui.button(button, f"{row.get('ticker') or row['name']} 공시 보기", "sec_company", {"cik": row["cik"]})
    _add_pages(ui, children, "company", state.get("companies", {}).get("pagination", {}), "sec_search", {"query": state.get("query", "")})


def _add_pages(ui: SurfaceBuilder, children: list, prefix: str, pagination: dict, action: str, context: dict):
    page = pagination.get("page", 1)
    if page <= 1 and not pagination.get("hasNextPage"):
        return
    children.append(f"{prefix}-pages")
    ids = [f"{prefix}-page-label"]
    ui.add(f"{prefix}-pages", "Row", children=ids)
    ui.add(f"{prefix}-page-label", "Text", text=f"{page}페이지", variant="caption")
    for direction, offset, show in [("prev", -1, page > 1), ("next", 1, pagination.get("hasNextPage"))]:
        if show:
            id = f"{prefix}-{direction}"
            ids.append(id)
            ui.button(id, "이전 페이지" if offset < 0 else "다음 페이지", action, {**context, "page": page + offset}, variant="outline")


def _add_filings(ui: SurfaceBuilder, state: dict, filing: dict):
    if filing:
        ui.add("filings", "Column", children=["analysis-options"])
        ui.add("analysis-options", "Column", children=["analysis-more"] if state.get("report") or state.get("financial_plan") else ["filing-fields"])
        if state.get("report") or state.get("financial_plan"):
            ui.add("analysis-more", "Collapsible", title="다른 분석 요청 / 공시 변경", child="filing-fields")
        _add_analysis_request(ui, state, filing)
        return
    children = ["filing-status", "filing-shortcuts", "filters"]
    ui.add("filings", "Column", children=children)
    filters = state.get("filters", {})
    status = {"downloaded": "분석 가능", "pending": "저장 대기", "failed": "저장 실패"}.get(filters.get("status", ""), "저장 상태 전체")
    forms = {"10-K": "연간보고서 (10-K)", "10-Q": "분기보고서 (10-Q)"}.get(filters.get("form", ""), filters.get("form") or "모든 공시")
    result = state.get("filings", {})
    ui.add("filing-status", "Text", text=f"{forms} · {status} · {result.get('pagination', {}).get('totalItems', 0)}건", variant="caption")
    ui.add("filing-shortcuts", "Row", children=["annual-filings", "quarterly-filings", "all-filings"], gap=8)
    for id, label, form, saved in [("annual-filings", "연간보고서", "10-K", "downloaded"), ("quarterly-filings", "분기보고서", "10-Q", "downloaded"), ("all-filings", "전체 공시", "", "")]:
        ui.button(id, label, "sec_filings_filter", {"form": form, "status": saved, "since": ""}, variant="secondary" if filters.get("form", "") == form and filters.get("status", "") == saved else "outline")
    _add_filters(ui)
    filings = result.get("items", [])
    if not filings:
        children.append("filings-empty")
        ui.add("filings-empty", "Alert", title="현재 조건에 맞는 공시가 없습니다", text="전체 공시에서 저장되지 않은 문서도 확인하거나, 추가 조건을 변경해 보세요.")
    for index, row in enumerate(filings):
        id = f"filing-row-{index}"
        button = "filing-select" if index == 0 else f"filing-select-{index}"
        children.append(id)
        form_type = str(row["formType"])
        title = {"10-K": "연간보고서", "10-Q": "분기보고서", "8-K": "주요사항 보고서"}.get(form_type.removesuffix("/A"), form_type)
        if form_type.endswith("/A"):
            title += " · 수정본"
        ready = "분석 가능" if row.get("status") == "downloaded" else "원문 미저장 · 조회만 가능"
        ui.add(id, "Card", title=f"{title} · {row.get('reportDate') or row.get('filingDate') or '-'}",
               description=f"{row['formType']} · 제출 {row.get('filingDate') or '-'} · {ready}", child=button)
        ui.button(button, f"{row['formType']} · {row.get('filingDate') or '-'} 선택", "sec_filing", {"accession": row["accessionNo"]}, variant="outline")
    _add_pages(ui, children, "filing", result.get("pagination", {}), "sec_filings_page", {})


def _add_filters(ui: SurfaceBuilder):
    ui.add("filters", "Collapsible", title="추가 조건", child="filter-fields")
    ui.add("filter-fields", "Column", children=["filter-status", "filter-form", "filter-since", "filter-button"], gap=8)
    ui.add("filter-status", "Select", label="원문 저장 상태", value={"path": "/statusFilter"}, options=[{"value": key, "label": label} for key, label in [("", "전체"), ("downloaded", "분석 가능"), ("pending", "저장 대기"), ("failed", "저장 실패")]])
    ui.add("filter-form", "Select", label="공시 종류", value={"path": "/formFilter"}, options=[{"value": key, "label": key or "전체"} for key in ["", "10-K", "10-K/A", "10-Q", "10-Q/A", "8-K", "8-K/A"]])
    ui.add("filter-since", "Input", label="제출 시작일 (선택)", value={"path": "/sinceFilter"}, placeholder="YYYY-MM-DD")
    ui.button("filter-button", "조건 적용", "sec_filings_filter", {"status": {"path": "/statusFilter"}, "form": {"path": "/formFilter"}, "since": {"path": "/sinceFilter"}})


def _add_analysis_request(ui: SurfaceBuilder, state: dict, filing: dict):
    ready = filing.get("status") == "downloaded"
    children = ["document-title", "document-period", "document-details", "analysis-guide", "report-presets", "custom-analysis", "change-filing"]
    ui.add("filing-fields", "Column", children=children)
    ui.add("document-title", "Text", text=f"{filing['formType']} · 제출 {filing.get('filingDate') or '-'}", variant="heading")
    ui.add("document-period", "Text", text=f"보고기간 {filing.get('reportDate') or '정보 없음'} · 선택한 문서 한 건을 분석합니다.", variant="caption")
    related = [item.get("accessionNo", "") for item in filing.get("amendments", [])]
    original = (filing.get("original") or {}).get("accessionNo", "없음")
    ui.add("document-details", "Accordion", items=[{"title": "접수번호 · 원본/수정본 정보", "text": f"접수번호: {filing['accessionNo']} · 원본: {original} · 수정본: {', '.join(related) or '없음'} · 연결 상태: {filing.get('amendmentLinkStatus', '-')}"}])
    ui.add("analysis-guide", "Text", text="궁금한 내용을 골라 바로 분석하세요." if ready else "원문이 저장되지 않아 분석할 수 없습니다. 다른 공시를 선택해 주세요.")
    ui.add("report-presets", "Row", children=["summary-report", "risks-report", "full-report"], gap=8)
    for id, label, request in [("summary-report", "핵심 요약", "핵심 요약만 카드로 정리해줘"), ("risks-report", "위험 요인", "위험 요인만 표로 정리해줘"), ("full-report", "전체 분석", "")]:
        ui.button(id, label, "sec_report", {"request": request}, disabled=not ready, variant="default" if id == "summary-report" else "outline")
    ui.add("custom-analysis", "Collapsible", title="직접 분석 요청하기", child="custom-fields")
    ui.add("custom-fields", "Column", children=["report-request", "report-button"], gap=8)
    ui.add("report-request", "Input", label="어떤 내용을 분석할까요?", value={"path": "/reportRequest"}, placeholder="예: 매출과 수익성만 비교해줘", disabled=not ready)
    ui.button("report-button", "분석 요청", "sec_report", {"request": {"path": "/reportRequest"}}, disabled=not ready)
    ui.button("change-filing", "다른 공시 선택", "sec_filings_page", {"page": state.get("filings", {}).get("pagination", {}).get("page", 1)}, variant="ghost")


def validate_action(action: dict, surfaces: dict) -> dict:
    if not isinstance(action, dict):
        raise ContractError("Invalid SEC action")
    surface_id, source_id = action.get("surfaceId"), action.get("sourceComponentId")
    if not isinstance(surface_id, str) or not isinstance(source_id, str):
        raise ContractError("Missing SEC surface or source")
    component = surfaces.get(surface_id, {}).get("components", {}).get(source_id, {})
    declared = component.get("action", {}).get("event", {})
    context = action.get("context")
    expected = declared.get("context", {})
    if component.get("disabled") or not declared or action.get("name") != declared.get("name") or not isinstance(context, dict) or set(context) != set(expected):
        raise ContractError("SEC action is unavailable in the current surface")
    for key, value in expected.items():
        if isinstance(value, dict) and "path" in value:
            if not isinstance(context[key], str) or len(context[key]) > (500 if key == "request" else 120):
                raise ContractError("Invalid SEC action input")
        elif type(context[key]) is not type(value) or context[key] != value:
            raise ContractError("Stale or altered SEC action; use the current selection")
    return context
