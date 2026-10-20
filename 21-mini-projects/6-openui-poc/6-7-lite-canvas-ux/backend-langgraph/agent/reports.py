"""Backend-owned source catalog and durable, one-report-per-thread repository."""

import json
import os
import re
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

DATA_PATH = Path(__file__).parent / "data" / "vendors"


# 백엔드에 패키징된 원문만 조회하여 프런트엔드나 형제 프로젝트의 파일에 의존하지 않습니다.
def vendor_catalog() -> list[dict]:
    catalog = []
    for path in sorted(DATA_PATH.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        match = re.search(r"공급업체\s*(\d+)", text)
        if match:
            catalog.append({"id": path.name.split("_")[0],
                            "name": f"공급업체{match[1]}", "file": path.name})
    return sorted(catalog, key=lambda item: item["name"])


def read_vendor(name: str) -> dict:
    normalized = re.sub(r"\s+", "", name).removeprefix("V_")
    for item in vendor_catalog():
        if normalized in (item["name"], item["id"]):
            return {**item, "text": (DATA_PATH / item["file"]).read_text(encoding="utf-8")}
    raise ValueError("공급업체를 찾지 못했습니다. 공급업체1~8 또는 공급업체 ID를 입력해 주세요.")


# HTTP와 스트림에 전달할 때 원문 전체와 내부 thread ID를 제외합니다.
def public_report(report: dict) -> dict:
    return {key: value for key, value in report.items()
            if key not in {"source_text", "thread_id"}}


class ReportRepository:
    def __init__(self, path: Path | None = None):
        self.path = path or Path(os.environ.get(
            "REPORT_DB_PATH", str(Path(__file__).parent.parent / ".data" / "reports.sqlite3")))

    @contextmanager
    def connect(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.path, timeout=15)
        conn.execute("CREATE TABLE IF NOT EXISTS reports ("
                     "id TEXT PRIMARY KEY, thread_id TEXT NOT NULL UNIQUE, body TEXT NOT NULL)")
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def current(self, thread_id: str) -> dict | None:
        with self.connect() as conn:
            row = conn.execute("SELECT body FROM reports WHERE thread_id=?", (thread_id,)).fetchone()
            return json.loads(row[0]) if row else None

    def get(self, report_id: str) -> dict | None:
        with self.connect() as conn:
            row = conn.execute("SELECT body FROM reports WHERE id=?", (report_id,)).fetchone()
            return json.loads(row[0]) if row else None

    # 삭제와 삽입을 한 트랜잭션으로 처리하여 thread당 하나의 리포트만 유지합니다. 이전 공유 ID도 사라집니다.
    def replace(self, thread_id: str, source: dict, report_mode: str = "interactive") -> dict:
        if report_mode not in {"interactive", "pdf"}:
            raise ValueError("Invalid report mode")
        report = {"id": str(uuid4()), "thread_id": thread_id,
                  "title": f"{source['name']} 성과 리포트", "vendor": source["name"],
                  "source_file": source["file"], "source_text": source["text"],
                  "report_mode": report_mode, "program": "", "status": "generating", "published": False,
                  "created_at": datetime.now(UTC).isoformat()}
        with self.connect() as conn:
            conn.execute("DELETE FROM reports WHERE thread_id=?", (thread_id,))
            conn.execute("INSERT INTO reports VALUES (?, ?, ?)",
                         (report["id"], thread_id, json.dumps(report, ensure_ascii=False)))
        return report

    # 교체 전 생성 작업이 늦게 끝나도 현재 리포트를 덮어쓰지 못하도록 리포트와 thread ID를 함께 검사합니다.
    def save(self, report: dict) -> None:
        with self.connect() as conn:
            changed = conn.execute("UPDATE reports SET body=? WHERE id=? AND thread_id=?",
                                   (json.dumps(report, ensure_ascii=False), report["id"], report["thread_id"]))
            if changed.rowcount != 1:
                raise ValueError("이미 교체된 리포트입니다.")

    # 쓰기 잠금을 확보한 뒤 완료 여부를 확인하고 발행하여 조회와 상태 변경 사이의 경쟁을 줄입니다.
    def publish(self, report_id: str) -> dict:
        with self.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute("SELECT body FROM reports WHERE id=?", (report_id,)).fetchone()
            if not row:
                raise ValueError("리포트를 찾지 못했습니다.")
            report = json.loads(row[0])
            if report["status"] != "ready":
                raise ValueError("완료된 리포트만 발행할 수 있습니다.")
            report["published"] = True
            conn.execute("UPDATE reports SET body=? WHERE id=?",
                         (json.dumps(report, ensure_ascii=False), report_id))
            return public_report(report)


repository = ReportRepository()


# 원문의 증감 주장과 W1/W2 직접 계산을 함께 보존하며 모순된 원문 수치를 임의로 정정하지 않습니다.
def kpi_comparisons(source: str) -> list[dict]:
    """Direct arithmetic alongside source claims, without silently rewriting source data."""
    rows = []
    started = False
    for line in source.splitlines():
        if not line.startswith("|"):
            if started:
                break
            continue
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if len(cells) != 4:
            continue
        left = re.match(r"^([+−-]?[\d,]+(?:\.\d+)?)", cells[1])
        right = re.match(r"^([+−-]?[\d,]+(?:\.\d+)?)", cells[2])
        if not left or not right:
            continue
        started = True
        w1, w2 = [float(m[1].replace(",", "").replace("−", "-")) for m in (left, right)]
        rows.append({"metric": cells[0], "w1": cells[1], "w2": cells[2],
                     "source_claim": cells[3], "calculated_difference": round(w2 - w1, 4),
                     "calculated_percent": round((w2 - w1) / w1 * 100, 2) if w1 else None})
    return rows


# 이스케이프된 파이프는 셀 내용으로 보존하고 연속된 Markdown 표를 헤더와 행으로 나눕니다.
def source_tables(source: str) -> list[dict]:
    """Read Markdown tables without treating escaped pipes as cell separators."""
    tables = []
    current = None
    for line in source.splitlines():
        if not line.startswith("|"):
            current = None
            continue
        cells = [cell.strip().replace(r"\|", "|") for cell in re.split(r"(?<!\\)\|", line.strip("|"))]
        if all(re.fullmatch(r"[:\s-]+", cell) for cell in cells):
            continue
        if current is None:
            current = {"headers": cells, "rows": []}
            tables.append(current)
        else:
            current["rows"].append(cells)
    return tables


def source_number(value: str) -> float | None:
    text = value.replace("**", "").replace(",", "").replace("−", "-")
    match = re.match(r"[+\-]?[\d]+(?:\.\d+)?", text)
    return float(match[0]) if match else None


# 표의 헤더 구조로 KPI·캠페인·리스크·조치를 추출하며 원문 문자열과 계산용 숫자를 함께 유지합니다.
def report_facts(source: str) -> dict:
    """Immutable source-backed data; the AI designs views over these arrays."""
    kpis, campaigns, risks, actions = [], [], [], []
    for table in source_tables(source):
        headers = table["headers"]
        if len(headers) == 4 and "지표" in headers[0] and not kpis:
            for row in table["rows"]:
                if len(row) != 4:
                    continue
                w1, w2 = source_number(row[1]), source_number(row[2])
                kpis.append({"label": row[0], "w1Text": row[1], "w2Text": row[2],
                             "claim": row[3], "w1": w1, "w2": w2,
                             "delta": round(w2 - w1, 4) if w1 is not None and w2 is not None else None,
                             "percent": round((w2 - w1) / w1 * 100, 2) if w1 and w2 is not None else None})
        if len(headers) == 11 and "캠페인" in headers[0] and "캠페인" in headers[1]:
            for row in table["rows"]:
                if len(row) == 11:
                    campaigns.append({"label": row[0], "id": row[1], "kind": row[2],
                                      "w1": source_number(row[3]), "w2": source_number(row[4]),
                                      "claim": row[5], "contribution": source_number(row[6]),
                                      "spend": source_number(row[7]), "roas": source_number(row[8]),
                                      "target": source_number(row[9]), "attainment": source_number(row[10])})
        if len(headers) == 11 and "VID" in headers[1]:
            for row in table["rows"]:
                if len(row) != 11:
                    continue
                hours = re.search(r"([\d.]+)\s*(?:h|시간)", row[6])
                risks.append({"id": row[1], "label": row[2], "revenue": source_number(row[3]),
                              "share": source_number(row[4]), "issue": row[5], "period": row[6],
                              "hours": float(hours[1]) if hours else None, "campaign": row[7],
                              "risk": source_number(row[8]), "riskText": row[8], "action": row[10]})
        if len(headers) == 5 and "출처" in headers[1]:
            for row in table["rows"]:
                if len(row) == 5:
                    actions.append({"rank": row[0], "source": row[1], "action": row[2], "impact": row[3], "evidence": row[4]})
    return {"sourceKpis": kpis, "sourceCampaigns": campaigns, "sourceRisks": risks, "sourceActions": actions}


# root와 원문 배열을 OpenUI 선언으로 먼저 만들고 경계 표시 뒤에 모델의 뷰를 이어 붙입니다.
def facts_program(source: str, view_name: str = "report") -> str:
    lines = [f"root = Col([{view_name}])"]
    for name, value in report_facts(source).items():
        lines.append(f"{name} = {json.dumps(value, ensure_ascii=False)}")
    return "\n".join(lines) + "\n// GENERATED VIEW\n"
