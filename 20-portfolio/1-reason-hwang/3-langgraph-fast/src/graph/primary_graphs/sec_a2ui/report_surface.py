"""Compile an allowlisted model plan into cited A2UI components."""
from domains.tenk.a2ui_report_plan import SECTION_TITLES, ReportPlan

REPORT_LIMITS = "선택 공시의 제한된 발췌를 분석합니다. 수정본 자동 병합과 전체 문서 검토는 수행하지 않습니다. 인용은 원문과 대조되지만 모델 해석은 별도 확인이 필요합니다."


def report_components(state: dict) -> list[dict]:
    plan = ReportPlan.model_validate(state["report_plan"])
    components = [
        {"id": "report", "component": "Card", "title": "선택 공시 분석 보고서", "child": "report-fields"},
        {"id": "report-source", "component": "Accordion", "items": [{"title": "출처 · 조회 시각 · 분석 범위", "text": state["report_source_label"]}]},
        {"id": "report-request-label", "component": "Text", "text": "분석 요청: " + (state.get("report_request") or "전체 공시 분석")},
        {"id": "report-limits", "component": "Text", "text": REPORT_LIMITS},
    ]
    section_ids = []
    for item in plan.sections:
        section_id = f"report-{item.section}-{item.presentation}"
        section_ids.append(section_id)
        title = SECTION_TITLES[item.section]
        claims = state["report"].get(item.section, [])
        rows = [{"analysis": claim["analysis"], "evidence": "\n".join(
            f"[{citation['evidence_id']}] {citation['quote']}" for citation in claim["citations"]
        )} for claim in claims]
        if not rows:
            components.append({"id": section_id, "component": "Alert", "title": title, "text": "제공된 발췌에서 확인된 정보가 없습니다."})
        elif item.presentation == "table":
            components.append({"id": section_id, "component": "Table", "title": title,
                               "columns": [{"key": "analysis", "label": "분석"}, {"key": "evidence", "label": "원문 근거"}], "rows": rows})
        elif item.presentation == "accordion":
            components.append({"id": section_id, "component": "Accordion", "items": [
                {"title": title, "text": "\n\n".join(row["analysis"] + "\n" + row["evidence"] for row in rows)},
            ]})
        else:
            children = []
            for index, row in enumerate(rows):
                claim_id = f"{section_id}-{index}"
                children.append(claim_id)
                components.extend([
                    {"id": claim_id, "component": "Card", "title": title, "child": f"{claim_id}-text"},
                    {"id": f"{claim_id}-text", "component": "Text", "text": row["analysis"] + "\n" + row["evidence"]},
                ])
            components.append({"id": section_id, "component": "Column", "children": children})
    components.append({"id": "report-fields", "component": "Column", "children": ["report-request-label", *section_ids, "report-limits", "report-source"]})
    return components
