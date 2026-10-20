"""Synthetic analytics and a shared, bounded SQL service for agents and refresh APIs."""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import threading
import time
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import duckdb
import sqlglot
from sqlglot import exp


class QueryError(ValueError):
    pass


def utc_now():
    return datetime.now(UTC).isoformat()


class AnalyticsService:
    def __init__(self, directory: Path, today: date | None = None):
        directory.mkdir(parents=True, exist_ok=True)
        self._today_override = today or (
            date.fromisoformat(os.environ["ANALYTICS_TODAY"])
            if os.getenv("ANALYTICS_TODAY")
            else None
        )
        self.directory = directory
        self.lock = threading.RLock()
        self.db = duckdb.connect(str(directory / "analytics.duckdb"))
        self.db.execute("SET enable_external_access=false")
        self.db.execute("SET autoinstall_known_extensions=false")
        self.db.execute("SET autoload_known_extensions=false")
        self.db.execute("SET memory_limit='128MB'")
        self.db.execute("SET threads=2")
        self.db.execute("SET lock_configuration=true")
        self.registry = sqlite3.connect(
            directory / "queries.sqlite", check_same_thread=False
        )
        self.registry.execute(
            "CREATE TABLE IF NOT EXISTS queries(id TEXT PRIMARY KEY, sql TEXT NOT NULL, created_at TEXT NOT NULL)"
        )
        columns = {row[1] for row in self.registry.execute("PRAGMA table_info(queries)")}
        for name in ("title", "description"):
            if name not in columns:
                self.registry.execute(f"ALTER TABLE queries ADD COLUMN {name} TEXT NOT NULL DEFAULT ''")
        self.registry.commit()
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS dataset_meta(revision INTEGER, updated_at VARCHAR)"
        )
        if not self.db.execute("SELECT count(*) FROM dataset_meta").fetchone()[0]:
            self.seed()

    @property
    def today(self):
        return self._today_override or datetime.now(UTC).date()

    def seed(self):
        with self.lock:
            for name, value in [("sales_daily", "revenue"), ("ad_daily", "spend")]:
                self.db.execute(
                    f"CREATE TABLE IF NOT EXISTS {name}(day DATE, region VARCHAR, campaign VARCHAR, {value} DOUBLE, impressions INTEGER, clicks INTEGER)"
                )
                self.db.execute(f"DELETE FROM {name}")
                rows = []
                start = self.today - timedelta(days=730)
                for n in range(731):
                    for i, region in enumerate(["KR", "US"]):
                        amount = round(
                            (1000 + n * 2 + i * 200)
                            * (1 if value == "revenue" else 0.2),
                            2,
                        )
                        rows.append(
                            (
                                start + timedelta(days=n),
                                region,
                                "search",
                                amount,
                                1000 + n,
                                50 + n % 20,
                            )
                        )
                self.db.executemany(
                    f"INSERT INTO {name} VALUES (?, ?, ?, ?, ?, ?)", rows
                )
            self.db.execute("DELETE FROM dataset_meta")
            self.db.execute("INSERT INTO dataset_meta VALUES (1, ?)", [utc_now()])

    def describe(self):
        return {
            "synthetic": True,
            "today": str(self.today),
            "timezone": "UTC",
            "currency": "USD",
            "tables": {
                "sales_daily": "day DATE, region KR|US, campaign, revenue USD, impressions, clicks",
                "ad_daily": "day DATE, region KR|US, campaign, spend USD, impressions, clicks",
            },
            "grain": "one row per day, region, campaign; aggregate each fact before joining",
            "parameters": "$start_date, $end_date, $region (ALL|KR|US)",
            "result": "exact columns period (date/category) and value (finite number); aggregate and ORDER BY period",
        }

    def validate(self, sql: str):
        if len(sql) > 12000:
            raise QueryError("Query too long")
        try:
            statements = sqlglot.parse(sql, read="duckdb")
        except sqlglot.errors.ParseError as exc:
            raise QueryError("Invalid SQL syntax") from exc
        if len(statements) != 1 or not isinstance(statements[0], exp.Select):
            raise QueryError("Only one SELECT is supported")
        tree = statements[0]
        if tree.args.get("with_"):
            raise QueryError(
                "CTEs are not supported in this PoC; use aggregate subqueries"
            )
        tables = list(tree.find_all(exp.Table))
        if not tables or any(
            t.name not in {"sales_daily", "ad_daily"} or t.db or t.catalog
            for t in tables
        ):
            raise QueryError(
                "Only synthetic sales_daily and ad_daily tables are allowed"
            )
        allowed_functions = {
            "SUM",
            "AVG",
            "COUNT",
            "MIN",
            "MAX",
            "COALESCE",
            "NULLIF",
            "ROUND",
            "CAST",
            "TRY_CAST",
            "DATE_TRUNC",
            "TIMESTAMP_TRUNC",
            "CASE",
            "IF",
            "AND",
            "OR",
        }
        for node in tree.walk():
            if isinstance(node, exp.Func):
                name = (
                    node.name.upper()
                    if isinstance(node, exp.Anonymous)
                    else node.sql_name()
                )
                if name not in allowed_functions:
                    raise QueryError(f"Function not allowed: {name}")
            if isinstance(node, (exp.Command, exp.Into, exp.Star)):
                raise QueryError(
                    "Commands, output targets and wildcard columns are not supported"
                )
        return sql

    def parameters(self, raw: dict):
        region = raw.get("region", "ALL")
        if region not in {"ALL", "KR", "US"}:
            raise QueryError("Unsupported region")
        months = raw.get("months", 3)
        if (
            isinstance(months, bool)
            or not isinstance(months, int)
            or not 1 <= months <= 24
        ):
            raise QueryError("months must be 1..24")
        end = date.fromisoformat(raw["end_date"]) if raw.get("end_date") else self.today
        start = (
            date.fromisoformat(raw["start_date"])
            if raw.get("start_date")
            else date(
                (end.year * 12 + end.month - months) // 12,
                (end.year * 12 + end.month - months) % 12 + 1,
                1,
            )
        )
        if start > end or (end - start).days > 1096:
            raise QueryError("Invalid date range")
        return {"start_date": str(start), "end_date": str(end), "region": region}

    def execute(self, sql: str, parameters: dict):
        self.validate(sql)
        params = self.parameters(parameters)
        # Only bind referenced placeholders; values never become SQL text.
        requested = {
            str(n.this)
            for n in sqlglot.parse_one(sql, read="duckdb").find_all(exp.Placeholder)
        }
        if requested - params.keys():
            raise QueryError("Unknown parameter")
        bound = {k: params[k] for k in requested}
        started = time.monotonic()
        with self.lock:
            timer = threading.Timer(2, self.db.interrupt)
            timer.start()
            try:
                cursor = self.db.execute(
                    f"SELECT * FROM ({sql.rstrip().rstrip(';')}) AS bounded_result LIMIT 501",
                    bound,
                )
                names = [c[0] for c in cursor.description]
                if names != ["period", "value"]:
                    raise QueryError("Result must have period and value columns")
                raw_rows = cursor.fetchall()
            except duckdb.Error as exc:
                raise QueryError(
                    "SQL execution failed: " + str(exc).splitlines()[0][:250]
                ) from exc
            finally:
                timer.cancel()
                timer.join()
            revision, watermark = self.db.execute(
                "SELECT revision, updated_at FROM dataset_meta"
            ).fetchone()
        import math

        rows = []
        for period, value in raw_rows[:500]:
            if value is None:
                continue
            if not isinstance(value, (int, float)) or not math.isfinite(float(value)):
                raise QueryError("Value must be a finite number")
            rows.append({"period": str(period), "value": float(value)})
        return {
            "rows": rows,
            "rowCount": len(rows),
            "truncated": len(raw_rows) > 500,
            "columns": [
                {"name": "period", "type": "string"},
                {"name": "value", "type": "number"},
            ],
            "parameters": params,
            "parametersHash": hashlib.sha256(
                json.dumps(params, sort_keys=True).encode()
            ).hexdigest(),
            "dataVersion": revision,
            "sourceWatermark": watermark,
            "fetchedAt": utc_now(),
            "elapsedMs": round((time.monotonic() - started) * 1000),
            "provenance": "synthetic",
            "resultSchemaVersion": 1,
        }

    def register(self, sql: str, parameters: dict, title: str = "", description: str = ""):
        self.validate(sql)
        tree = sqlglot.parse_one(sql, read="duckdb")
        bindings = {node.name for node in tree.find_all(exp.Placeholder)}
        if not {"start_date", "end_date", "region"}.issubset(bindings):
            raise QueryError("Refreshable queries must bind $start_date, $end_date and $region; do not hardcode filters")
        result = self.execute(sql, parameters)
        query_id = hashlib.sha256(sql.encode()).hexdigest()[:24]
        with self.lock:
            self.registry.execute(
                "INSERT OR IGNORE INTO queries(id, sql, created_at, title, description) VALUES (?, ?, ?, ?, ?)",
                (query_id, sql, utc_now(), title[:200], description[:2000]),
            )
            self.registry.commit()
        return {"queryId": query_id, "queryVersion": 1, "snapshot": result, "definition": self.definition(query_id)}

    def definition(self, query_id: str):
        with self.lock:
            row = self.registry.execute(
                "SELECT sql, created_at, title, description FROM queries WHERE id=?", (query_id,)
            ).fetchone()
        if row is None:
            raise QueryError("Unknown saved query")
        return {
            "schemaVersion": 1, "queryId": query_id, "queryVersion": 1,
            "sql": row[0], "createdAt": row[1], "title": row[2], "description": row[3],
            "parameterSchema": {
                "months": {"type": "integer", "minimum": 1, "maximum": 24},
                "region": {"enum": ["ALL", "KR", "US"]},
                "start_date": {"type": "string", "format": "date", "optional": True},
                "end_date": {"type": "string", "format": "date", "optional": True},
            },
            "resultSchema": {"version": 1, "columns": [
                {"name": "period", "type": "string"}, {"name": "value", "type": "number"}
            ]},
        }

    def refresh(self, query_id: str, parameters: dict, version: int = 1):
        # A local CLI queues fixture corrections; only the DB-owning service writes.
        with self.lock:
            for command in self.directory.glob("advance-*.request"):
                self.advance()
                command.unlink()
        if version != 1:
            raise QueryError("Unsupported query version")
        with self.lock:
            row = self.registry.execute(
                "SELECT sql FROM queries WHERE id=?", (query_id,)
            ).fetchone()
        if not row:
            raise QueryError("Unknown saved query")
        return {
            "queryId": query_id,
            "queryVersion": 1,
            **self.execute(row[0], parameters),
        }

    def advance(self):
        """Local fixture owner command, never exposed to agent or public data API."""
        with self.lock:
            self.db.execute(
                "UPDATE sales_daily SET revenue=revenue+100 WHERE day=?", [self.today]
            )
            self.db.execute(
                "UPDATE dataset_meta SET revision=revision+1, updated_at=?", [utc_now()]
            )

    def close(self):
        self.db.close()
        self.registry.close()


_service = None
_service_lock = threading.Lock()


def service():
    global _service
    with _service_lock:
        if _service is None:
            _service = AnalyticsService(
                Path(os.getenv("CANVAS_DATA_DIR", "data/canvas"))
            )
    return _service
