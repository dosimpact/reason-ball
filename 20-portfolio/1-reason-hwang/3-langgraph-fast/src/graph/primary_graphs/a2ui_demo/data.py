"""Fictional, deterministic datasets. No live sales or flight prices."""

SALES = [
    {"account": "Han River Retail", "region": "seoul", "rep": "지민", "revenue": 120000, "quota": 100000, "risk": "healthy", "month": "2026-07"},
    {"account": "Seoul Studio", "region": "seoul", "rep": "지민", "revenue": 90000, "quota": 100000, "risk": "at-risk", "month": "2026-08"},
    {"account": "Metro Apparel", "region": "seoul", "rep": "민수", "revenue": 150000, "quota": 120000, "risk": "healthy", "month": "2026-09"},
    {"account": "Harbor Threads", "region": "busan", "rep": "서연", "revenue": 80000, "quota": 90000, "risk": "at-risk", "month": "2026-07"},
    {"account": "Busan Collective", "region": "busan", "rep": "서연", "revenue": 110000, "quota": 100000, "risk": "healthy", "month": "2026-08"},
    {"account": "Ocean Outfitters", "region": "busan", "rep": "준호", "revenue": 130000, "quota": 120000, "risk": "healthy", "month": "2026-09"},
]
FLIGHTS = {
    "demo-icn-nrt": {"origin": "ICN", "destination": "NRT", "airline": "Demo Air", "price": "$289"},
    "demo-nrt-icn": {"origin": "NRT", "destination": "ICN", "airline": "Demo Air", "price": "$279"},
    "demo-icn-kix": {"origin": "ICN", "destination": "KIX", "airline": "Sample Airlines", "price": "$239"},
    "demo-kix-icn": {"origin": "KIX", "destination": "ICN", "airline": "Sample Airlines", "price": "$229"},
    "demo-kix-pus": {"origin": "KIX", "destination": "PUS", "airline": "Sample Airlines", "price": "$209"},
    "demo-icn-bkk": {"origin": "ICN", "destination": "BKK", "airline": "Demo Air", "price": "$359"},
    "demo-bkk-icn": {"origin": "BKK", "destination": "ICN", "airline": "Demo Air", "price": "$349"},
    "demo-icn-sin": {"origin": "ICN", "destination": "SIN", "airline": "Demo Air", "price": "$399"},
    "demo-sin-icn": {"origin": "SIN", "destination": "ICN", "airline": "Demo Air", "price": "$389"},
    "demo-pus-kix": {"origin": "PUS", "destination": "KIX", "airline": "Sample Airlines", "price": "$219"},
}


def sales_summary(region: str = "all") -> dict:
    if region not in {"all", "seoul", "busan"}:
        raise ValueError("region must be all, seoul or busan")
    selected = [row for row in SALES if region == "all" or row["region"] == region]
    total = sum(row["revenue"] for row in selected)
    return {
        "filters": {"region": region},
        "revenue": f"${total:,}",
        "accounts": str(len(selected)),
        "status": f"조회 완료 · {region}",
        "rows": selected,
    }
