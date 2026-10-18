from datetime import date

import pytest

from agent.analytics import AnalyticsService, QueryError

SQL = """SELECT CAST(date_trunc('month', day) AS DATE) AS period, SUM(revenue) AS value
FROM sales_daily WHERE day >= $start_date AND day <= $end_date
AND ($region = 'ALL' OR region = $region) GROUP BY 1 ORDER BY 1"""


@pytest.fixture
def analytics(tmp_path):
    svc = AnalyticsService(tmp_path, date(2026, 10, 18))
    yield svc
    svc.close()


def test_real_aggregation_and_filters(analytics):
    all_rows = analytics.execute(SQL, {"months": 3})["rows"]
    kr = analytics.execute(SQL, {"months": 3, "region": "KR"})["rows"]
    us = analytics.execute(SQL, {"months": 3, "region": "US"})["rows"]
    assert len(all_rows) == 3
    assert [x["value"] for x in all_rows] == [
        a["value"] + b["value"] for a, b in zip(kr, us)
    ]
    assert kr[-1]["value"] == sum(1000 + n * 2 for n in range(713, 731))


def test_registered_query_refresh_and_source_correction(analytics):
    saved = analytics.register(SQL, {"months": 3})
    before = saved["snapshot"]
    (analytics.directory / "advance-test.request").write_text("local correction")
    after = analytics.refresh(saved["queryId"], {"months": 3})
    assert after["rows"][-1]["value"] == before["rows"][-1]["value"] + 200
    assert after["dataVersion"] == before["dataVersion"] + 1
    assert after["sourceWatermark"] != before["sourceWatermark"]
    assert after["parametersHash"] == before["parametersHash"]
    assert (
        analytics.refresh(saved["queryId"], {"months": 3})["dataVersion"]
        == after["dataVersion"]
    )


def test_saved_queries_survive_restart(tmp_path):
    first = AnalyticsService(tmp_path, date(2026, 10, 18))
    saved = first.register(SQL, {"months": 3})
    first.close()
    second = AnalyticsService(tmp_path, date(2026, 10, 18))
    try:
        assert (
            second.refresh(saved["queryId"], {"months": 3})["rows"]
            == saved["snapshot"]["rows"]
        )
    finally:
        second.close()


@pytest.mark.parametrize(
    "sql",
    [
        "DROP TABLE sales_daily",
        "SELECT 1; DROP TABLE sales_daily",
        "SELECT * FROM sales_daily",
        "SELECT * FROM read_csv('/etc/passwd')",
        "SELECT read_text('/etc/passwd') FROM sales_daily",
        "SELECT getenv('OPENAI_API_KEY') FROM sales_daily",
        "SELECT * FROM sqlite_scan('x', 'y')",
        "SELECT day FROM information_schema.tables",
        "COPY sales_daily TO '/tmp/leak'",
        "ATTACH 'evil.db' AS evil",
        "INSTALL httpfs",
        "SET enable_external_access=true",
        "WITH x AS (SELECT day FROM sales_daily) SELECT day FROM x",
    ],
)
def test_rejects_unapproved_sql(analytics, sql):
    with pytest.raises(QueryError):
        analytics.validate(sql)


@pytest.mark.parametrize(
    "params",
    [
        {"months": 0},
        {"months": True},
        {"region": "KR' OR 1=1"},
        {"start_date": "2026-10-20", "end_date": "2026-10-01"},
    ],
)
def test_rejects_invalid_parameters(analytics, params):
    with pytest.raises(QueryError):
        analytics.execute(SQL, params)


def test_empty_result_and_unknown_version(analytics):
    saved = analytics.register(
        SQL, {"start_date": "2000-01-01", "end_date": "2000-01-02"}
    )
    assert saved["snapshot"]["rows"] == []
    with pytest.raises(QueryError):
        analytics.refresh(saved["queryId"], {}, 2)


def test_no_double_counting_join(analytics):
    sql = """SELECT s.period AS period, s.revenue / NULLIF(a.spend, 0) AS value
    FROM (SELECT day AS period, SUM(revenue) AS revenue FROM sales_daily GROUP BY day) s
    JOIN (SELECT day AS period, SUM(spend) AS spend FROM ad_daily GROUP BY day) a ON s.period=a.period
    ORDER BY period"""
    result = analytics.execute(sql, {})
    assert result["truncated"]
    assert all(row["value"] == pytest.approx(5) for row in result["rows"])


def test_fixed_range_and_rolling_range_resolve_at_each_read(analytics):
    fixed = {"start_date": "2026-07-01", "end_date": "2026-09-30", "region": "KR"}
    first = analytics.execute(SQL, fixed)
    assert [row["period"] for row in first["rows"]] == [
        "2026-07-01",
        "2026-08-01",
        "2026-09-01",
    ]
    analytics._today_override = date(2026, 11, 1)
    assert analytics.execute(SQL, fixed)["rows"] == first["rows"]
    rolling = analytics.parameters({"months": 3})
    assert rolling["start_date"] == "2026-09-01"
    assert rolling["end_date"] == "2026-11-01"


def test_zero_denominator_is_missing_not_invented_zero(analytics):
    result = analytics.execute(
        "SELECT day AS period, revenue / NULLIF(0, 0) AS value FROM sales_daily", {}
    )
    assert result["rows"] == []


def test_expensive_query_is_interrupted_and_connection_recovers(analytics):
    import time

    sql = """SELECT 'all' AS period, SUM(a.revenue * b.spend * c.revenue) AS value
    FROM sales_daily a CROSS JOIN ad_daily b CROSS JOIN sales_daily c"""
    started = time.monotonic()
    with pytest.raises(QueryError, match="[Ii]nterrupt"):
        analytics.execute(sql, {})
    assert time.monotonic() - started < 6
    assert analytics.execute(SQL, {"months": 1})["rows"]


def test_definition_is_shared_but_results_are_parameter_specific(analytics):
    kr = analytics.register(SQL, {"months": 3, "region": "KR"}, "Monthly sales", "Synthetic revenue")
    us = analytics.register(SQL, {"months": 6, "region": "US"}, "Different label", "Not overwritten")
    assert kr["queryId"] == us["queryId"]
    assert kr["definition"] == us["definition"]
    assert kr["definition"]["title"] == "Monthly sales"
    assert "rows" not in kr["definition"]
    assert len(kr["snapshot"]["rows"]) == 3
    assert len(us["snapshot"]["rows"]) == 6
    assert analytics.definition(kr["queryId"])["sql"] == SQL
    with pytest.raises(QueryError):
        analytics.definition("missing")


def test_old_registry_migration_preserves_queries(tmp_path):
    import hashlib
    import sqlite3

    query_id = hashlib.sha256(SQL.encode()).hexdigest()[:24]
    with sqlite3.connect(tmp_path / "queries.sqlite") as db:
        db.execute("CREATE TABLE queries(id TEXT PRIMARY KEY, sql TEXT NOT NULL, created_at TEXT NOT NULL)")
        db.execute("INSERT INTO queries VALUES (?, ?, ?)", (query_id, SQL, "2026-10-18"))
    svc = AnalyticsService(tmp_path, date(2026, 10, 18))
    try:
        definition = svc.definition(query_id)
        assert definition["sql"] == SQL
        assert definition["title"] == definition["description"] == ""
        assert svc.refresh(query_id, {"months": 3})["rows"]
        assert svc.register(SQL, {"months": 6})["queryId"] == query_id
    finally:
        svc.close()


def test_refreshable_query_requires_parameter_bindings(analytics):
    with pytest.raises(QueryError, match="must bind"):
        analytics.register("SELECT CAST(day AS VARCHAR) AS period, SUM(revenue) AS value FROM sales_daily WHERE region='KR' GROUP BY day", {})
