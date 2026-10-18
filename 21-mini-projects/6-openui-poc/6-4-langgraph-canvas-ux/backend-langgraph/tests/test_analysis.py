import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import duckdb
import pytest
from starlette.testclient import TestClient

from agent import analysis
from agent.api import app
from agent.canvas_graph import METRICS


@pytest.fixture(autouse=True)
def dataset(tmp_path, monkeypatch):
    monkeypatch.setenv("CANVAS_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("ANALYSIS_TODAY", "2026-10-18")


SQL = "SELECT strftime(month,'%Y-%m') AS month, SUM(revenue) AS revenue, SUM(spend) AS spend FROM monthly_metrics WHERE ($region='ALL' OR region=$region) AND month BETWEEN CAST($start_date AS DATE) AND CAST($end_date AS DATE) GROUP BY 1 ORDER BY 1"
PARAMS = {"region": "KR", "period": "last_3_months"}


@pytest.mark.parametrize(
    "sql",
    [
        "DROP TABLE sales_daily",
        "SELECT 1; SELECT 2",
        "COPY sales_daily TO '/tmp/leak'",
        "ATTACH '/tmp/other' AS other",
        "INSTALL httpfs",
        "SELECT * FROM read_csv('/etc/passwd')",
        "SELECT * FROM read_parquet('https://example.com/x')",
        "SELECT * FROM information_schema.tables",
        "SELECT getenv('HOME') FROM sales_daily",
        "SELECT * FROM range(1000000000)",
        "WITH RECURSIVE t AS (SELECT 1 UNION ALL SELECT * FROM t) SELECT * FROM t",
        "SELECT * FROM sales_daily s JOIN ad_daily a USING(day,region)",
    ],
)
def test_forbidden_queries(sql):
    with pytest.raises(analysis.AnalysisError):
        analysis.validate_sql(sql)


def test_real_query_matches_independent_aggregation():
    result = analysis.register(SQL, PARAMS)
    snapshot = result["snapshot"]
    assert [r["month"] for r in snapshot["rows"]] == ["2026-08", "2026-09", "2026-10"]
    with duckdb.connect(
        str(analysis.runtime_dir() / "analytics.duckdb"), read_only=True
    ) as con:
        sales = con.execute(
            "SELECT SUM(revenue) FROM sales_daily WHERE region='KR' AND day>='2026-08-01'"
        ).fetchone()[0]
        ads = con.execute(
            "SELECT SUM(spend) FROM ad_daily WHERE region='KR' AND day>='2026-08-01'"
        ).fetchone()[0]
    assert sum(r["revenue"] for r in snapshot["rows"]) == pytest.approx(sales)
    assert sum(r["spend"] for r in snapshot["rows"]) == pytest.approx(ads)
    assert snapshot["provenance"] == "synthetic"


def test_registered_query_is_persistent_and_refresh_has_no_model():
    registered = analysis.register(SQL, PARAMS)
    before = registered["snapshot"]
    model_count = METRICS["modelCalls"]
    analysis.correct_fixture(1000)
    after = analysis.run_saved_query(registered["queryId"], 1, PARAMS)
    assert after["rows"][-1]["revenue"] == before["rows"][-1]["revenue"] + 1000
    assert after["sourceWatermark"]["revision"] == 2
    assert after["dataVersion"] != before["dataVersion"]
    assert after["parametersHash"] == before["parametersHash"]
    assert METRICS["modelCalls"] == model_count
    saved = json.loads(
        (analysis.runtime_dir() / (registered["queryId"] + ".json")).read_text()
    )
    assert saved["queryVersion"] == 1
    assert saved["validatedSql"] == analysis.validate_sql(SQL)


def test_zero_denominator_null_and_empty_result():
    result = analysis.execute(
        SQL.replace("SUM(revenue) AS revenue", "SUM(revenue)/NULLIF(0,0) AS revenue"),
        PARAMS,
    )
    assert result["rows"][0]["revenue"] is None
    empty = analysis.execute(
        SQL,
        {
            "region": "KR",
            "period": "custom",
            "startDate": "2001-01-01",
            "endDate": "2001-01-31",
        },
    )
    assert empty["rows"] == [] and empty["rowCount"] == 0


@pytest.mark.parametrize(
    "parameters",
    [
        {"region": "KR' OR 1=1"},
        {"period": "bad"},
        {"period": "custom", "startDate": "2026-12-01", "endDate": "2026-01-01"},
        {"secret": "x"},
    ],
)
def test_parameter_validation(parameters):
    with pytest.raises(analysis.AnalysisError):
        analysis.resolve_parameters(parameters)


def test_rolling_and_fixed_ranges(monkeypatch):
    _, first = analysis.resolve_parameters(PARAMS)
    monkeypatch.setenv("ANALYSIS_TODAY", "2026-11-02")
    _, second = analysis.resolve_parameters(PARAMS)
    _, fixed = analysis.resolve_parameters(
        {"period": "custom", "startDate": "2026-08-01", "endDate": "2026-10-18"}
    )
    assert first["start_date"] == fixed["start_date"] == "2026-08-01"
    assert second["start_date"] == "2026-09-01"


def test_row_limit_and_real_timeout():
    sql = "SELECT day, revenue FROM sales_daily WHERE ($region='ALL' OR region=$region) AND day BETWEEN DATE($start_date) AND DATE($end_date) ORDER BY day"
    result = analysis.execute(sql, {"region": "ALL", "period": "last_12_months"})
    assert result["rowCount"] == 500 and result["truncated"]
    with pytest.raises(analysis.AnalysisError, match="terminated"):
        analysis.execute(SQL, PARAMS, timeout=0.001)
    assert analysis.execute(SQL, PARAMS)["rowCount"] == 3


def test_correction_and_query_serialization():
    analysis.seed()
    with ThreadPoolExecutor(max_workers=2) as pool:
        correction = pool.submit(analysis.correct_fixture, 30)
        query = pool.submit(analysis.execute, SQL, PARAMS)
        correction.result()
        assert query.result()["rowCount"] == 3


def test_api_query_echoes_revision_and_has_no_model():
    result = analysis.register(SQL, PARAMS)
    count = METRICS["modelCalls"]
    with TestClient(app) as client:
        response = client.post(
            "/canvas/query",
            json={
                "queryId": result["queryId"],
                "queryVersion": 1,
                "parameters": PARAMS,
                "definitionRevision": 7,
                "requestId": "req-7",
            },
        )
        assert response.status_code == 200
        assert response.json()["requestId"] == "req-7"
        assert response.json()["definitionRevision"] == 7
        assert (
            client.post(
                "/canvas/query", json={"queryId": "../../.env", "queryVersion": 1}
            ).status_code
            == 400
        )
        assert client.post("/canvas/chat", json={"message": ""}).status_code == 400
    assert METRICS["modelCalls"] == count


def test_unknown_query_version():
    with pytest.raises(analysis.AnalysisError):
        analysis.run_saved_query("q_" + "a" * 24, 2, PARAMS)


def test_no_untracked_fixture_in_source():
    assert analysis.runtime_dir() != Path(__file__).parent


def test_partial_month_range_is_filtered_before_aggregation():
    params = {
        "region": "KR",
        "period": "custom",
        "startDate": "2026-08-15",
        "endDate": "2026-09-08",
    }
    result = analysis.execute(SQL, params)
    assert [row["month"] for row in result["rows"]] == ["2026-08", "2026-09"]
    with duckdb.connect(
        str(analysis.runtime_dir() / "analytics.duckdb"), read_only=True
    ) as con:
        expected = con.execute(
            "SELECT SUM(revenue) FROM sales_daily WHERE region='KR' AND day BETWEEN '2026-08-15' AND '2026-09-08'"
        ).fetchone()[0]
    assert sum(row["revenue"] for row in result["rows"]) == pytest.approx(expected)
    assert result["resolvedRange"]["start_date"] == "2026-08-15"


def test_host_filters_cannot_be_bypassed_by_model_sql():
    sql = "SELECT day, region, revenue FROM sales_daily WHERE ($region = $region) AND ($start_date = $start_date) AND ($end_date = $end_date) ORDER BY day"
    result = analysis.execute(
        sql,
        {
            "region": "JP",
            "period": "custom",
            "startDate": "2026-09-02",
            "endDate": "2026-09-04",
        },
    )
    assert result["rowCount"] == 3
    assert {row["region"] for row in result["rows"]} == {"JP"}


@pytest.mark.parametrize(
    "body",
    [
        [],
        None,
        {"message": "x", "widgets": [5]},
        {"message": "x", "retryOperations": [{"action": "unsafe"}]},
    ],
)
def test_malformed_chat_is_rejected_before_model(body):
    count = METRICS["modelCalls"]
    with TestClient(app) as client:
        assert client.post("/canvas/chat", content=json.dumps(body)).status_code == 400
    assert METRICS["modelCalls"] == count


def test_malformed_sql_token_is_a_controlled_error():
    with pytest.raises(analysis.AnalysisError, match="syntax"):
        analysis.validate_sql('SELECT "unterminated')
