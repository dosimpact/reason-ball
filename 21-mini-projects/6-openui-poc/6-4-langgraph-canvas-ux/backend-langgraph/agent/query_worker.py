"""제한된 subprocess: 제한 시간 초과 시 실제 쿼리 프로세스가 종료된다."""

import json
import sys
import time

import duckdb


def main():
    request = json.load(sys.stdin)
    start = time.monotonic()
    con = duckdb.connect(
        request["path"],
        read_only=True,
        config={
            "enable_external_access": "false",
            "allow_unsigned_extensions": "false",
            "threads": "1",
            "memory_limit": "128MB",
            "max_temp_directory_size": "0B",
        },
    )
    try:
        meta = con.execute(
            "SELECT revision, ingested_at, through_date FROM dataset_meta"
        ).fetchone()
        # 필터를 사실 행에 먼저 적용한다. 부분 월도 누락/과대 집계되지 않는다.
        # TEMP 객체만 생성하므로 원본 DuckDB 파일은 계속 read-only다.
        database = con.execute("SELECT current_database()").fetchone()[0]
        quoted_database = '"' + database.replace('"', '""') + '"'
        for table in ("sales_daily", "ad_daily"):
            con.execute(
                f"CREATE TEMP TABLE {table} AS SELECT * FROM {quoted_database}.main.{table} "
                "WHERE ($region='ALL' OR region=$region) "
                "AND day BETWEEN CAST($start_date AS DATE) AND CAST($end_date AS DATE)",
                request["parameters"],
            )
        con.execute("""CREATE TEMP VIEW monthly_metrics AS
        WITH s AS (SELECT date_trunc('month',day)::DATE AS month, region, SUM(revenue) revenue, SUM(orders) orders FROM temp.main.sales_daily GROUP BY 1,2),
        a AS (SELECT date_trunc('month',day)::DATE AS month, region, SUM(spend) spend, SUM(impressions) impressions, SUM(clicks) clicks FROM temp.main.ad_daily GROUP BY 1,2)
        SELECT s.*, a.spend, a.impressions, a.clicks FROM s JOIN a USING(month,region)""")
        parameters = dict(request["parameters"])
        if request.get("monthly"):
            # month는 월초 날짜지만 원천 행은 위의 정확한 일자 범위로 제한된다.
            parameters["start_date"] = parameters["start_date"][:8] + "01"
        cursor = con.execute(
            "SELECT * FROM (" + request["sql"] + ") AS bounded_query LIMIT 501",
            parameters,
        )
        columns = [
            {"name": item[0], "type": str(item[1])} for item in cursor.description
        ]
        rows = cursor.fetchall()
        print(
            json.dumps(
                {
                    "columns": columns,
                    "rows": [
                        dict(zip([c["name"] for c in columns], row))
                        for row in rows[:500]
                    ],
                    "rowCount": min(len(rows), 500),
                    "truncated": len(rows) > 500,
                    "elapsedMs": round((time.monotonic() - start) * 1000),
                    "sourceWatermark": {
                        "revision": meta[0],
                        "ingestedAt": meta[1],
                        "throughDate": str(meta[2]),
                    },
                },
                default=str,
                allow_nan=False,
            )
        )
    except (duckdb.Error, ValueError):
        print(
            json.dumps(
                {"error": "SQL execution failed; check columns, types and grouping"}
            )
        )
    finally:
        con.close()


if __name__ == "__main__":
    main()
