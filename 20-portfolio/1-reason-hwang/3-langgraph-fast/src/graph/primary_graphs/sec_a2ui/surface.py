"""Server-authored SEC UI. Stable IDs let action results update one surface."""
from copilotkit import a2ui

from graph.primary_graphs.a2ui_demo.contract import MANIFEST, ContractError

from .report_surface import report_components


class SurfaceBuilder:
    def __init__(self, revision: int):
        self.components = []
        self.revision = revision

    def add(self, id, kind, **props):
        self.components.append({"id": id, "component": kind, **props})

    def button(self, id, label, name, context=None, disabled=False):
        self.add(id, "Button", label=label, disabled=disabled, action={"event": {"name": name, "context": {"revision": self.revision, **(context or {})}}})


def render_surface(surface_id: str, state: dict, *, create: bool) -> list[dict]:
    ui = SurfaceBuilder(state.get("revision", 0))
    companies = state.get("companies", {}).get("items", [])
    filings = state.get("filings", {}).get("items", [])
    company, filing = state.get("company") or {}, state.get("filing") or {}
    visible = ["notice", "search"]
    ui.add("root", "Column", children=visible)
    _add_search(ui, state)
    if "companies" in state and not company:
        visible.append("companies" if companies else "companies-empty")
        _add_companies(ui, state, companies)
    if company:
        visible.extend(["selected-company", "filings"])
        ui.add("selected-company", "Text", text=f"선택 회사: {company['name']} ({company.get('ticker') or '-'}) · CIK {company['cik']}")
        _add_filings(ui, state, company, filings, filing)
    if state.get("report"):
        visible.append("report")
        ui.components.extend(report_components(state))
    data = {"query": state.get("query", ""), "companyChoice": company.get("cik") or (companies[0]["cik"] if companies else ""), "filingChoice": filing.get("accessionNo") or (filings[0]["accessionNo"] if filings else "")}
    data["reportRequest"] = state.get("report_request", "")
    data.update({f"{key}Filter": state.get("filters", {}).get(key, "") for key in ("status", "form", "since")})
    operations = [a2ui.create_surface(surface_id, MANIFEST["catalogs"]["sec"]["catalogId"])] if create else []
    return [*operations, a2ui.update_components(surface_id, ui.components), a2ui.update_data_model(surface_id, data)]


def _add_search(ui: SurfaceBuilder, state: dict):
    ui.add("notice", "Alert", title="SEC 공시 분석", text=state.get("notice", "회사를 검색하고 공시를 선택해 주세요."))
    ui.add("search", "Card", title="회사 검색", child="search-fields")
    ui.add("search-fields", "Column", children=["query", "search-button"])
    ui.add("query", "Input", label="회사명 또는 티커", value={"path": "/query"})
    ui.button("search-button", "회사 검색", "sec_search", {"query": {"path": "/query"}, "page": 1})


def _add_companies(ui: SurfaceBuilder, state: dict, companies: list):
    if not companies:
        ui.add("companies-empty", "Alert", title="회사 검색 결과", text="검색 결과가 없습니다. 검색어를 바꿔 주세요.")
        return
    ui.add("companies", "Card", title="회사 검색 결과", child="company-fields")
    ui.add("company-fields", "Column", children=["company-table", "company-choice", "company-select", "company-pages", "company-status"])
    ui.add("company-table", "Table", title="회사 목록", columns=[{"key": key, "label": label} for key, label in [("name", "회사명"), ("ticker", "티커"), ("cik", "CIK")]], rows=[{key: row.get(key) or "" for key in ("name", "ticker", "cik")} for row in companies])
    ui.add("company-choice", "Select", label="조회할 회사", value={"path": "/companyChoice"}, disabled=not companies, options=[{"value": row["cik"], "label": f"{row['name']} ({row.get('ticker') or '-'})"} for row in companies] or [{"value": "", "label": "검색 결과 없음"}])
    ui.button("company-select", "공시 조회", "sec_company", {"cik": {"path": "/companyChoice"}}, not companies)
    ui.add("company-pages", "Row", children=["company-prev", "company-next"])
    company_page = state.get("companies", {}).get("pagination", {})
    page = company_page.get("page", 1)
    ui.button("company-prev", "회사 이전 페이지", "sec_search", {"query": state.get("query", ""), "page": page - 1}, page <= 1)
    ui.button("company-next", "회사 다음 페이지", "sec_search", {"query": state.get("query", ""), "page": page + 1}, not company_page.get("hasNextPage"))
    ui.add("company-status", "Text", text=f"{company_page.get('totalItems', 0)}개 회사 · {page}페이지")


def _add_filings(ui: SurfaceBuilder, state: dict, company: dict, filings: list, filing: dict):
    ui.add("filings", "Card", title=f"{company.get('name', '회사 선택 후')} 공시", child="filing-fields")
    if filing:
        ui.add("filing-fields", "Column", children=["filing-detail", "report-request", "report-button", "change-filing"])
        _add_analysis_request(ui, filing)
        ui.button("change-filing", "공시 다시 선택", "sec_filings_page", {"page": state.get("filings", {}).get("pagination", {}).get("page", 1)})
        return
    filing_children = ["filter-status", "filter-form", "filter-since", "filter-button", "filing-status"]
    ui.add("filing-fields", "Column", children=filing_children)
    ui.add("filter-status", "Select", label="원문 저장 상태", value={"path": "/statusFilter"}, options=[{"value": key, "label": label} for key, label in [("", "전체"), ("downloaded", "원문 저장됨"), ("pending", "저장 대기"), ("failed", "저장 실패")]])
    ui.add("filter-form", "Select", label="공시 종류", value={"path": "/formFilter"}, options=[{"value": key, "label": key or "전체"} for key in ["", "10-K", "10-K/A", "10-Q", "10-Q/A", "8-K", "8-K/A"]])
    ui.add("filter-since", "Input", label="제출 시작일 (선택)", value={"path": "/sinceFilter"}, placeholder="YYYY-MM-DD")
    ui.button("filter-button", "공시 필터 적용", "sec_filings_filter", {"status": {"path": "/statusFilter"}, "form": {"path": "/formFilter"}, "since": {"path": "/sinceFilter"}}, not company)
    if filings:
        filing_children.extend(["filing-table", "filing-choice", "filing-select", "filing-pages"])
        columns = [("formType", "종류"), ("filingDate", "제출일"), ("reportDate", "보고기간"), ("accessionNo", "접수번호"), ("status", "원문 상태")]
        ui.add("filing-table", "Table", title="원본과 수정본을 별도로 표시합니다", columns=[{"key": key, "label": label} for key, label in columns], rows=[{key: row.get(key) or "" for key, _ in columns} for row in filings])
        ui.add("filing-choice", "Select", label="분석할 공시", value={"path": "/filingChoice"}, disabled=not filings, options=[{"value": row["accessionNo"], "label": f"{row['formType']} · {row.get('filingDate') or '-'} · {row['accessionNo']}"} for row in filings] or [{"value": "", "label": "조회 결과 없음"}])
        ui.button("filing-select", "공시 선택", "sec_filing", {"accession": {"path": "/filingChoice"}}, not filings)
        ui.add("filing-pages", "Row", children=["filing-prev", "filing-next"])
        filing_page = state.get("filings", {}).get("pagination", {})
        page = filing_page.get("page", 1)
        ui.button("filing-prev", "공시 이전 페이지", "sec_filings_page", {"page": page - 1}, not company or page <= 1)
        ui.button("filing-next", "공시 다음 페이지", "sec_filings_page", {"page": page + 1}, not filing_page.get("hasNextPage"))
    filing_page = state.get("filings", {}).get("pagination", {})
    ui.add("filing-status", "Text", text=f"{filing_page.get('totalItems', 0)}개 공시 · {filing_page.get('page', 1)}페이지" if filings else "조건에 맞는 공시가 없습니다. 필터를 변경해 주세요.")


def _add_analysis_request(ui: SurfaceBuilder, filing: dict):
    related = [item.get("accessionNo", "") for item in filing.get("amendments", [])]
    original = (filing.get("original") or {}).get("accessionNo", "없음")
    ui.add("filing-detail", "Text", text=f"선택: {filing.get('accessionNo', '없음')} · 원본: {original} · 수정본: {', '.join(related) or '없음'} · 연결 상태: {filing.get('amendmentLinkStatus', '-')} · 선택한 문서 한 건만 분석합니다.")
    ui.add("report-request", "Input", label="어떤 내용을 분석할까요?", value={"path": "/reportRequest"}, placeholder="예: 위험 요인만 카드로 정리해줘", disabled=filing.get("status") != "downloaded")
    ui.button("report-button", "분석·요약 보고서 생성", "sec_report", {"request": {"path": "/reportRequest"}}, disabled=filing.get("status") != "downloaded")


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
