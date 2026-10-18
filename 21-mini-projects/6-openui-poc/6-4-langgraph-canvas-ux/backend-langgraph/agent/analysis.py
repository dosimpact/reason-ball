"""합성 분석 데이터, 검증된 조회 등록 및 모델 없는 반복 실행."""

from __future__ import annotations

import fcntl
import hashlib
import json
import os
import subprocess
import sys
import threading
from contextlib import contextmanager
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import duckdb
import sqlglot
from sqlglot import exp

ROOT = Path(__file__).resolve().parents[1]
LOCK = threading.RLock()
TABLES = {"sales_daily", "ad_daily", "monthly_metrics"}
FUNCTIONS = {
    "DATE",
    "AND",
    "OR",
    "CASE",
    "SUM",
    "AVG",
    "COUNT",
    "MIN",
    "MAX",
    "ROUND",
    "ABS",
    "COALESCE",
    "NULLIF",
    "CAST",
    "TRY_CAST",
    "TIME_TO_STR",
    "DATE_TRUNC",
    "TIMESTAMP_TRUNC",
    "EXTRACT",
    "IF",
    "LOWER",
    "UPPER",
}


class AnalysisError(ValueError):
    pass


def runtime_dir():
    p = Path(os.environ.get("CANVAS_DATA_DIR", str(ROOT / "runtime")))
    p.mkdir(parents=True, exist_ok=True)
    return p


@contextmanager
def dataset_lock():
    with LOCK, (runtime_dir() / "dataset.lock").open("a") as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)


def now():
    return datetime.now(UTC).isoformat()


def today():
    return date.fromisoformat(
        os.environ.get("ANALYSIS_TODAY", datetime.now(UTC).date().isoformat())
    )


def digest(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()[:24]


def seed(reset=False):
    """단일 서비스가 쓰기를 소유한다. HTTP/LLM에 공개하지 않는 관리 명령."""
    with dataset_lock():
        path = runtime_dir() / "analytics.duckdb"
        if path.exists() and not reset:
            return
        con = duckdb.connect(str(path))
        try:
            con.execute("DROP VIEW IF EXISTS monthly_metrics")
            for table in ("sales_daily", "ad_daily", "dataset_meta"):
                con.execute(f"DROP TABLE IF EXISTS {table}")
            con.execute(
                "CREATE TABLE sales_daily(day DATE, region VARCHAR, revenue DOUBLE, orders INTEGER, PRIMARY KEY(day, region))"
            )
            con.execute(
                "CREATE TABLE ad_daily(day DATE, region VARCHAR, campaign VARCHAR, spend DOUBLE, impressions BIGINT, clicks BIGINT, PRIMARY KEY(day, region, campaign))"
            )
            con.execute(
                "CREATE TABLE dataset_meta(revision INTEGER, ingested_at VARCHAR, through_date DATE)"
            )
            anchor = today()
            start = date(anchor.year - 1, 1, 1)
            sales, ads = [], []
            for offset in range((anchor - start).days + 1):
                day = start + timedelta(days=offset)
                for i, region in enumerate(("KR", "US", "JP")):
                    revenue = round(
                        (1000 + day.month * 90 + day.day * 7) * (1 + i * 0.45), 2
                    )
                    sales.append((day, region, revenue, 20 + day.day + i))
                    for j, campaign in enumerate(("search", "display")):
                        ads.append(
                            (
                                day,
                                region,
                                campaign,
                                round(revenue * (0.1 + j * 0.04), 2),
                                5000 + offset * 5 + i * 100,
                                100 + day.day * 2 + j * 10,
                            )
                        )
            con.executemany("INSERT INTO sales_daily VALUES (?,?,?,?)", sales)
            con.executemany("INSERT INTO ad_daily VALUES (?,?,?,?,?,?)", ads)
            # 먼저 같은 grain으로 집계해서 JOIN 중복 합산을 방지한다.
            con.execute("""CREATE VIEW monthly_metrics AS
            WITH s AS (SELECT date_trunc('month',day)::DATE AS month, region, SUM(revenue) revenue, SUM(orders) orders FROM sales_daily GROUP BY 1,2),
            a AS (SELECT date_trunc('month',day)::DATE AS month, region, SUM(spend) spend, SUM(impressions) impressions, SUM(clicks) clicks FROM ad_daily GROUP BY 1,2)
            SELECT s.*, a.spend, a.impressions, a.clicks FROM s JOIN a USING(month,region)""")
            con.execute("INSERT INTO dataset_meta VALUES (1,?,?)", [now(), anchor])
        finally:
            con.close()


def correct_fixture(delta=1000):
    """로컬 관리 명령만 사용. 과거 행 정정도 revision을 올린다."""
    seed()
    with dataset_lock():
        con = duckdb.connect(str(runtime_dir() / "analytics.duckdb"))
        try:
            con.execute(
                "UPDATE sales_daily SET revenue=revenue+? WHERE day=(SELECT MAX(day) FROM sales_daily) AND region='KR'",
                [delta],
            )
            con.execute(
                "UPDATE dataset_meta SET revision=revision+1, ingested_at=?", [now()]
            )
        finally:
            con.close()


def describe():
    return {
        "datasetId": "synthetic-analytics",
        "datasetSchemaVersion": 1,
        "synthetic": True,
        "currency": "USD",
        "timezone": "UTC",
        "today": today().isoformat(),
        "tables": {
            "sales_daily": "day DATE, region (KR/US/JP), revenue DOUBLE USD, orders INTEGER; grain day+region",
            "ad_daily": "day DATE, region, campaign (search/display), spend DOUBLE USD, impressions BIGINT, clicks BIGINT; grain day+region+campaign",
            "monthly_metrics": "month DATE (month start), region, revenue, orders, spend, impressions, clicks; grain month+region; safe join after exact day/region filters, including partial months",
        },
        "parameters": "$region (ALL/KR/US/JP), $start_date, $end_date (inclusive ISO dates). All three must be used.",
        "exampleSql": "SELECT strftime(month, '%Y-%m') AS month, SUM(revenue) AS revenue, SUM(spend) AS spend FROM monthly_metrics WHERE ($region = 'ALL' OR region = $region) AND month BETWEEN CAST($start_date AS DATE) AND CAST($end_date AS DATE) GROUP BY 1 ORDER BY 1",
        "rules": "Single SELECT. No external sources, writes, recursive CTE, arbitrary functions or raw fact joins. ROAS=SUM(revenue)/NULLIF(SUM(spend),0), CTR=100.0*SUM(clicks)/NULLIF(SUM(impressions),0). null stays null; empty stays empty.",
    }


def validate_sql(sql):
    if not isinstance(sql, str) or len(sql) > 12000:
        raise AnalysisError("SQL must be at most 12000 characters")
    try:
        statements = sqlglot.parse(sql, read="duckdb")
    except (sqlglot.errors.ParseError, sqlglot.errors.TokenError) as e:
        raise AnalysisError("Invalid SQL syntax") from e
    if len(statements) != 1 or not isinstance(statements[0], exp.Select):
        raise AnalysisError("Only one SELECT is supported")
    tree = statements[0]
    if any(node.args.get("recursive") for node in tree.find_all(exp.With)):
        raise AnalysisError("Recursive queries are not supported")
    ctes = {node.alias for node in tree.find_all(exp.CTE)}
    tables = set()
    for node in tree.find_all(exp.Table):
        if (
            not isinstance(node.this, exp.Identifier)
            or node.db
            or node.catalog
            or node.name not in TABLES | ctes
        ):
            raise AnalysisError("Table or external source is not allowed")
        if node.name in TABLES:
            tables.add(node.name)
    if not tables:
        raise AnalysisError("A supported dataset table is required")
    if {"sales_daily", "ad_daily"} <= tables:
        raise AnalysisError(
            "Use monthly_metrics for sales/ad joins to avoid double counting"
        )
    if list(tree.find_all(exp.Join)):
        raise AnalysisError(
            "JOINs are supported through the preaggregated monthly_metrics view"
        )
    for node in tree.walk():
        if isinstance(node, exp.Func) and node.sql_name() not in FUNCTIONS:
            raise AnalysisError(f"Unsupported SQL function: {node.sql_name()}")
        if type(node).__name__ in {
            "Into",
            "Command",
            "Pragma",
            "Attach",
            "Copy",
            "Insert",
            "Delete",
            "Update",
            "Create",
            "Drop",
            "Set",
            "Union",
            "Intersect",
            "Except",
        }:
            raise AnalysisError("Unsupported SQL operation")
    params = {p.name for p in tree.find_all(exp.Placeholder)}
    if params != {"region", "start_date", "end_date"}:
        raise AnalysisError("Use exactly $region, $start_date, $end_date")
    return tree.sql(dialect="duckdb")


def resolve_parameters(parameters):
    p = dict(parameters or {})
    if set(p) - {"region", "period", "startDate", "endDate"}:
        raise AnalysisError("Unknown query parameter")
    region = p.get("region", "ALL")
    if region not in {"ALL", "KR", "US", "JP"}:
        raise AnalysisError("Unsupported region")
    period = p.get("period", "last_3_months")
    anchor = today()
    first = anchor.replace(day=1)
    if period == "custom":
        try:
            start, end = (
                date.fromisoformat(p["startDate"]),
                date.fromisoformat(p["endDate"]),
            )
        except (KeyError, TypeError, ValueError) as e:
            raise AnalysisError("Custom range requires ISO startDate/endDate") from e
    elif period == "last_month":
        end = first - timedelta(days=1)
        start = end.replace(day=1)
    elif period in {"this_month", "last_3_months", "last_6_months", "last_12_months"}:
        months = {
            "this_month": 1,
            "last_3_months": 3,
            "last_6_months": 6,
            "last_12_months": 12,
        }[period]
        m = first.year * 12 + first.month - months
        start, end = date(m // 12, m % 12 + 1, 1), anchor
    else:
        raise AnalysisError("Unsupported period")
    if start > end or (end - start).days > 730:
        raise AnalysisError("Date range must be 0–730 days")
    return {
        "region": region,
        "period": period,
        **(
            {"startDate": start.isoformat(), "endDate": end.isoformat()}
            if period == "custom"
            else {}
        ),
    }, {"region": region, "start_date": start.isoformat(), "end_date": end.isoformat()}


def execute(sql, parameters, timeout=5):
    sql = validate_sql(sql)
    canonical, resolved = resolve_parameters(parameters)
    seed()
    with dataset_lock():
        try:
            proc = subprocess.run(
                [sys.executable, "-m", "agent.query_worker"],
                input=json.dumps(
                    {
                        "path": str(runtime_dir() / "analytics.duckdb"),
                        "sql": sql,
                        "parameters": resolved,
                        "monthly": any(
                            table.name == "monthly_metrics"
                            for table in sqlglot.parse_one(sql, read="duckdb").find_all(
                                exp.Table
                            )
                        ),
                    }
                ),
                text=True,
                capture_output=True,
                timeout=timeout,
                cwd=ROOT,
                check=False,
            )
        except subprocess.TimeoutExpired as e:
            raise AnalysisError("Query timed out; worker terminated") from e
    if proc.returncode:
        raise AnalysisError("Query could not be executed against the dataset")
    result = json.loads(proc.stdout)
    if "error" in result:
        raise AnalysisError(result["error"])
    return {
        **result,
        "parameters": canonical,
        "parametersHash": digest(canonical),
        "resolvedRange": resolved,
        "fetchedAt": now(),
        "expiresAt": (datetime.now(UTC) + timedelta(seconds=60)).isoformat(),
        "dataVersion": digest([result["sourceWatermark"], resolved, sql]),
        "provenance": "synthetic",
        "currency": "USD",
        "timezone": "UTC",
    }


def register(sql, parameters):
    sql = validate_sql(sql)
    snapshot = execute(sql, parameters)
    qid = "q_" + digest(sql)
    definition = {
        "queryId": qid,
        "queryVersion": 1,
        "validatedSql": sql,
        "datasetId": "synthetic-analytics",
        "datasetSchemaVersion": 1,
        "resultSchemaVersion": 1,
        "resultSchema": snapshot["columns"],
        "rowLimit": 500,
        "timeout": 5,
    }
    with dataset_lock():
        target = runtime_dir() / f"{qid}.json"
        if not target.exists():
            temp = target.with_suffix(".tmp")
            temp.write_text(json.dumps(definition))
            temp.replace(target)
    return {
        "queryId": qid,
        "queryVersion": 1,
        "resultSchemaVersion": 1,
        "snapshot": {**snapshot, "queryVersion": 1},
    }


def run_saved_query(query_id, query_version, parameters):
    if (
        not isinstance(query_id, str)
        or not __import__("re").fullmatch(r"q_[a-f0-9]{24}", query_id)
        or query_version != 1
    ):
        raise AnalysisError("Unknown query or unsupported version")
    target = runtime_dir() / f"{query_id}.json"
    if not target.exists():
        raise AnalysisError("Saved query is unavailable")
    definition = json.loads(target.read_text())
    result = execute(definition["validatedSql"], parameters)
    if result["columns"] != definition["resultSchema"]:
        raise AnalysisError("Result schema changed; existing snapshot was preserved")
    return {**result, "queryVersion": query_version}
