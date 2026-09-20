"""Server-authored SEC UI. Stable IDs let action results update one surface."""
from copilotkit import a2ui

from graph.primary_graphs.a2ui_demo.contract import MANIFEST, ContractError


def render_surface(surface_id: str, state: dict, *, create: bool) -> list[dict]:
    companies = state.get("companies", {}).get("items", [])
    filings = state.get("filings", {}).get("items", [])
    company = state.get("company") or {}
    filing = state.get("filing") or {}
    revision = state.get("revision", 0)
    components = []

    def add(id, kind, **props):
        components.append({"id": id, "component": kind, **props})

    def button(id, label, name, context=None, disabled=False):
        add(id, "Button", label=label, disabled=disabled, action={"event": {"name": name, "context": {"revision": revision, **(context or {})}}})

    add("root", "Column", children=["notice", "search", "companies", "filings", "report"])
    add("notice", "Alert", title="SEC 공시 분석", text=state.get("notice", "회사를 검색하고 공시를 선택해 주세요."))
    add("search", "Card", title="회사 검색", child="search-fields")
    add("search-fields", "Column", children=["query", "search-button"])
    add("query", "Input", label="회사명 또는 티커", value={"path": "/query"})
    button("search-button", "회사 검색", "sec_search", {"query": {"path": "/query"}, "page": 1})

    add("companies", "Card", title="회사 검색 결과", child="company-fields")
    add("company-fields", "Column", children=["company-table", "company-choice", "company-select", "company-pages", "company-status"])
    add("company-table", "Table", title="회사 목록", columns=[{"key": key, "label": label} for key, label in [("name", "회사명"), ("ticker", "티커"), ("cik", "CIK")]], rows=[{key: row.get(key) or "" for key in ("name", "ticker", "cik")} for row in companies])
    add("company-choice", "Select", label="조회할 회사", value={"path": "/companyChoice"}, disabled=not companies, options=[{"value": row["cik"], "label": f"{row['name']} ({row.get('ticker') or '-'})"} for row in companies] or [{"value": "", "label": "검색 결과 없음"}])
    button("company-select", "공시 조회", "sec_company", {"cik": {"path": "/companyChoice"}}, not companies)
    add("company-pages", "Row", children=["company-prev", "company-next"])
    company_page = state.get("companies", {}).get("pagination", {})
    page = company_page.get("page", 1)
    button("company-prev", "회사 이전 페이지", "sec_search", {"query": state.get("query", ""), "page": page - 1}, page <= 1)
    button("company-next", "회사 다음 페이지", "sec_search", {"query": state.get("query", ""), "page": page + 1}, not company_page.get("hasNextPage"))
    add("company-status", "Text", text=f"{company_page.get('totalItems', 0)}개 회사 · {page}페이지")

    add("filings", "Card", title=f"{company.get('name', '회사 선택 후')} 공시", child="filing-fields")
    add("filing-fields", "Column", children=["filter-status", "filter-form", "filter-since", "filter-button", "filing-table", "filing-choice", "filing-select", "filing-pages", "filing-status", "filing-detail", "report-button"])
    add("filter-status", "Select", label="원문 저장 상태", value={"path": "/statusFilter"}, options=[{"value": key, "label": label} for key, label in [("", "전체"), ("downloaded", "원문 저장됨"), ("pending", "저장 대기"), ("failed", "저장 실패")]])
    add("filter-form", "Select", label="공시 종류", value={"path": "/formFilter"}, options=[{"value": key, "label": key or "전체"} for key in ["", "10-K", "10-K/A", "10-Q", "10-Q/A", "8-K", "8-K/A"]])
    add("filter-since", "Input", label="제출 시작일 (선택)", value={"path": "/sinceFilter"}, placeholder="YYYY-MM-DD")
    button("filter-button", "공시 필터 적용", "sec_filings_filter", {"status": {"path": "/statusFilter"}, "form": {"path": "/formFilter"}, "since": {"path": "/sinceFilter"}}, not company)
    columns = [("formType", "종류"), ("filingDate", "제출일"), ("reportDate", "보고기간"), ("accessionNo", "접수번호"), ("status", "원문 상태")]
    add("filing-table", "Table", title="원본과 수정본을 별도로 표시합니다", columns=[{"key": key, "label": label} for key, label in columns], rows=[{key: row.get(key) or "" for key, _ in columns} for row in filings])
    add("filing-choice", "Select", label="분석할 공시", value={"path": "/filingChoice"}, disabled=not filings, options=[{"value": row["accessionNo"], "label": f"{row['formType']} · {row.get('filingDate') or '-'} · {row['accessionNo']}"} for row in filings] or [{"value": "", "label": "조회 결과 없음"}])
    button("filing-select", "공시 선택", "sec_filing", {"accession": {"path": "/filingChoice"}}, not filings)
    add("filing-pages", "Row", children=["filing-prev", "filing-next"])
    filing_page = state.get("filings", {}).get("pagination", {})
    page = filing_page.get("page", 1)
    button("filing-prev", "공시 이전 페이지", "sec_filings_page", {"page": page - 1}, not company or page <= 1)
    button("filing-next", "공시 다음 페이지", "sec_filings_page", {"page": page + 1}, not filing_page.get("hasNextPage"))
    add("filing-status", "Text", text=f"{filing_page.get('totalItems', 0)}개 공시 · {page}페이지")
    related = [item.get("accessionNo", "") for item in filing.get("amendments", [])]
    original = (filing.get("original") or {}).get("accessionNo", "없음")
    add("filing-detail", "Text", text=f"선택: {filing.get('accessionNo', '없음')} · 원본: {original} · 수정본: {', '.join(related) or '없음'} · 연결 상태: {filing.get('amendmentLinkStatus', '-')} · 선택한 문서 한 건만 분석합니다.")
    button("report-button", "분석·요약 보고서 생성", "sec_report", disabled=not filing or filing.get("status") != "downloaded")

    report = state.get("report") or {}
    add("report", "Card", title="선택 공시 분석 보고서", child="report-fields")
    add("report-fields", "Column", children=["report-source", "report-sections", "report-limits"])
    add("report-source", "Text", text=state.get("report_source_label", "아직 생성된 보고서가 없습니다."))
    sections = []
    for key, title in [("summary", "핵심 요약"), ("business", "사업 분석"), ("financials", "재무 분석"), ("risks", "위험 요인")]:
        claims = report.get(key, [])
        paragraphs = [claim["analysis"] + "\n" + "\n".join(f"[{citation['evidence_id']}] {citation['quote']}" for citation in claim["citations"]) for claim in claims]
        sections.append({"title": title, "text": "\n\n".join(paragraphs) or "제공된 발췌에서 확인된 정보가 없습니다."})
    add("report-sections", "Accordion", items=sections)
    add("report-limits", "Text", text="선택 공시의 제한된 발췌를 분석합니다. 수정본 자동 병합과 전체 문서 검토는 수행하지 않습니다. 인용은 원문과 대조되지만 모델 해석은 별도 확인이 필요합니다.")
    data = {"query": state.get("query", ""), "companyChoice": company.get("cik") or (companies[0]["cik"] if companies else ""), "filingChoice": filing.get("accessionNo") or (filings[0]["accessionNo"] if filings else "")}
    data.update({f"{key}Filter": state.get("filters", {}).get(key, "") for key in ("status", "form", "since")})
    operations = [a2ui.create_surface(surface_id, MANIFEST["catalogs"]["sec"]["catalogId"])] if create else []
    return [*operations, a2ui.update_components(surface_id, components), a2ui.update_data_model(surface_id, data)]


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
            if not isinstance(context[key], str) or len(context[key]) > 120:
                raise ContractError("Invalid SEC action input")
        elif type(context[key]) is not type(value) or context[key] != value:
            raise ContractError("Stale or altered SEC action; use the current selection")
    return context
