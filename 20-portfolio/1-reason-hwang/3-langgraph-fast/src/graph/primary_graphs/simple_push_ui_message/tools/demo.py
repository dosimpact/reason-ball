import json

from langchain_core.tools import tool

NOTES = [
    {"title": "매출 집계 기준", "text": "데모 매출은 지역별 확정 거래 금액의 합계입니다."},
    {"title": "매출 해석", "text": "지역 비교 시 거래처 수와 총액을 함께 살펴보세요. 데모 데이터로 실제 전망을 추론하지 마세요."},
]
SALES = [{"region": "서울", "revenue": 120000}, {"region": "서울", "revenue": 80000},
         {"region": "부산", "revenue": 90000}, {"region": "부산", "revenue": 60000}]


@tool
def research_notes(query: str) -> str:
    """Search local demo reference notes about sales. This is not internet research."""
    matches = [note for note in NOTES if any(word in note["title"] + note["text"] for word in query.split())]
    return json.dumps({"source": "로컬 예제 자료", "notes": matches}, ensure_ascii=False)


@tool
def query_sales(region: str = "전체") -> str:
    """Aggregate demo sales records for 서울, 부산, or 전체. No production database."""
    if region not in {"서울", "부산", "전체"}:
        return json.dumps({"error": "지원 지역: 서울, 부산, 전체"}, ensure_ascii=False)
    rows = [row for row in SALES if region == "전체" or row["region"] == region]
    return json.dumps({"source": "고정 예제 매출 데이터", "region": region,
                       "revenue": sum(row["revenue"] for row in rows), "accounts": len(rows)}, ensure_ascii=False)


TOOLS = [research_notes, query_sales]
