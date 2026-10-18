"""Playwright MCP용 합성 fixture. 실제 DuckDB 등록 조회와 OpenUI 입력을 사용한다."""

import json

from agent import analysis

SQL = "SELECT strftime(month,'%Y-%m') AS month, SUM(revenue) AS revenue FROM monthly_metrics WHERE ($region='ALL' OR region=$region) AND month BETWEEN CAST($start_date AS DATE) AND CAST($end_date AS DATE) GROUP BY 1 ORDER BY 1"
params = {"region": "KR", "period": "last_3_months"}
widgets = {}
for name, title, sql in [
    ("sales", "월별 매출", SQL),
    ("ads", "광고비", SQL.replace("revenue", "spend")),
]:
    binding = "b-" + name
    program = (
        f'root = Col([Title({json.dumps(title, ensure_ascii=False)}, "sm"), '
        + ('Input($memo, "메모를 입력하세요"), ' if name == "sales" else "")
        + f'CanvasData("{binding}", "bar")])'
    )
    if name == "sales":
        program += '\n$memo = "첫 메모"'
    widgets[name] = {
        "id": name,
        "canvasId": "default",
        "title": title,
        "program": program,
        "chartType": "bar",
        "definitionRevision": 1,
        "rendererContractVersion": 1,
        "catalogVersion": 1,
        "refreshPolicy": "manual",
        "parameters": params,
        "bindingId": binding,
        "layout": {"w": 6, "h": 10},
        "uiState": {},
        **analysis.register(sql, params),
    }
preview = {
    **widgets["sales"],
    "id": "preview-sales",
    "title": "채팅 매출",
    "canvasId": None,
}
preview.pop("canvasId")
print(
    json.dumps(
        {
            "doc": {
                "schemaVersion": 2,
                "revision": 1,
                "canvases": [
                    {
                        "id": "default",
                        "title": "내 대시보드",
                        "widgetIds": ["sales", "ads"],
                    }
                ],
                "widgets": widgets,
                "activeCanvasId": "default",
                "selectedWidgetId": None,
            },
            "threads": [
                {
                    "id": "fixture-thread",
                    "title": "합성 데이터 UX 검증",
                    "messages": [
                        {
                            "id": "fixture-assistant",
                            "role": "assistant",
                            "content": "합성 데이터 분석 결과입니다.",
                            "artifacts": [preview],
                            "status": "complete",
                        }
                    ],
                }
            ],
        },
        ensure_ascii=False,
    )
)
