"""Transactional migration from the legacy JSONB snapshot to normalized rows."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from psycopg.types.json import Jsonb

SNAPSHOT_MIGRATION_VERSION = 1001
SNAPSHOT_MIGRATION_NAME = "legacy_snapshot_to_normalized_v1"
TABLES = (
    "assistants",
    "assistant_versions",
    "threads",
    "runs",
    "crons",
    "store_items",
    "a2a_tasks",
)


@dataclass(frozen=True)
class BackfillReport:
    source_counts: dict[str, int]
    target_counts: dict[str, int]
    id_sets_match: bool
    latest_versions_match: bool
    checksums_match: bool

    @property
    def valid(self) -> bool:
        return (
            self.source_counts == self.target_counts
            and self.id_sets_match
            and self.latest_versions_match
            and self.checksums_match
        )


def _timestamp(value: Any, default: datetime | None = None) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    return default or datetime.now(UTC)


def _json(value: Any, default: Any) -> Any:
    return value if value is not None else default


def snapshot_to_rows(snapshot: Mapping[str, Any]) -> dict[str, list[dict[str, Any]]]:
    """Convert the exact legacy StateBridge payload into normalized row shapes."""

    rows: dict[str, list[dict[str, Any]]] = {table: [] for table in TABLES}
    assistant_state = snapshot.get("assistants") or {}
    versions = assistant_state.get("versions") if isinstance(assistant_state, Mapping) else {}
    latest_value = assistant_state.get("latest") if isinstance(assistant_state, Mapping) else {}
    latest = latest_value if isinstance(latest_value, Mapping) else {}
    if isinstance(versions, Mapping):
        for raw_id, raw_versions in versions.items():
            if not isinstance(raw_versions, list) or not raw_versions:
                continue
            assistant_id = UUID(str(raw_id))
            version_rows: list[dict[str, Any]] = []
            for item in raw_versions:
                if not isinstance(item, Mapping):
                    continue
                version_rows.append(
                    {
                        "assistant_id": assistant_id,
                        "version": int(item.get("version", len(version_rows) + 1)),
                        "graph_id": str(item["graph_id"]),
                        "config": _json(item.get("config"), {}),
                        "context": _json(item.get("context"), {}),
                        "metadata": _json(item.get("metadata"), {}),
                        "name": str(item.get("name", "Untitled")),
                        "description": item.get("description"),
                        "created_at": _timestamp(item.get("created_at")),
                        "updated_at": _timestamp(item.get("updated_at")),
                    }
                )
            if not version_rows:
                continue
            latest_version = int(latest.get(str(raw_id), version_rows[-1]["version"]))
            current = next(
                (row for row in version_rows if row["version"] == latest_version),
                version_rows[-1],
            )
            rows["assistants"].append({**current, "latest_version": latest_version})
            rows["assistants"][-1].pop("version")
            rows["assistant_versions"].extend(version_rows)

    runtime = snapshot.get("runtime") or {}
    runtime_threads = runtime.get("threads") if isinstance(runtime, Mapping) else {}
    if isinstance(runtime_threads, Mapping):
        for raw_id, item in runtime_threads.items():
            if not isinstance(item, Mapping):
                continue
            created = _timestamp(item.get("created_at"))
            rows["threads"].append(
                {
                    "thread_id": UUID(str(raw_id)),
                    "created_at": created,
                    "updated_at": _timestamp(item.get("updated_at"), created),
                    "state_updated_at": _timestamp(item.get("state_updated_at"), created),
                    "metadata": _json(item.get("metadata"), {}),
                    "config": _json(item.get("config"), {}),
                    "values": _json(item.get("values"), {}),
                    "interrupts": _json(item.get("interrupts"), {}),
                    "status": str(item.get("status", "idle")),
                    "ttl": item.get("ttl"),
                }
            )
    runtime_runs = runtime.get("runs") if isinstance(runtime, Mapping) else {}
    results = runtime.get("run_results") if isinstance(runtime, Mapping) else {}
    known_thread_ids = {row["thread_id"] for row in rows["threads"]}
    if isinstance(runtime_runs, Mapping):
        for raw_id, item in runtime_runs.items():
            if not isinstance(item, Mapping):
                continue
            created = _timestamp(item.get("created_at"))
            raw_thread_id = item.get("thread_id")
            thread_id = UUID(str(raw_thread_id)) if raw_thread_id else None
            if thread_id not in known_thread_ids:
                # Old snapshot cleanup could remove a transient thread before its
                # run record. Preserve the run while satisfying the nullable FK.
                thread_id = None
            rows["runs"].append(
                {
                    "run_id": UUID(str(raw_id)),
                    "thread_id": thread_id,
                    "assistant_id": str(item.get("assistant_id", "")),
                    "created_at": created,
                    "updated_at": _timestamp(item.get("updated_at"), created),
                    "status": str(item.get("status", "pending")),
                    "metadata": _json(item.get("metadata"), {}),
                    "kwargs": _json(item.get("kwargs"), {}),
                    "multitask_strategy": item.get("multitask_strategy"),
                    "result": results.get(str(raw_id)) if isinstance(results, Mapping) else None,
                }
            )

    crons = snapshot.get("crons") or {}
    if isinstance(crons, Mapping):
        for raw_id, item in crons.items():
            if not isinstance(item, Mapping):
                continue
            payload = _json(item.get("payload"), {})
            created = _timestamp(item.get("created_at"))
            thread_id = item.get("thread_id")
            rows["crons"].append(
                {
                    "cron_id": UUID(str(raw_id)),
                    "assistant_id": str(item.get("assistant_id", "")),
                    "thread_id": UUID(str(thread_id)) if thread_id else None,
                    "schedule": str(item.get("schedule") or payload.get("schedule") or ""),
                    "timezone": item.get("timezone") or payload.get("timezone"),
                    "enabled": bool(item.get("enabled", payload.get("enabled", True))),
                    "payload": payload,
                    "next_run_date": _timestamp(item["next_run_date"]) if item.get("next_run_date") else None,
                    "end_time": _timestamp(item["end_time"]) if item.get("end_time") else None,
                    "metadata": _json(item.get("metadata"), {}),
                    "created_at": created,
                    "updated_at": _timestamp(item.get("updated_at"), created),
                    "user_id": item.get("user_id"),
                }
            )

    store = snapshot.get("store") or []
    if isinstance(store, list):
        for entry in store:
            if not isinstance(entry, Mapping) or not isinstance(entry.get("item"), Mapping):
                continue
            item = entry["item"]
            created = _timestamp(item.get("created_at"))
            rows["store_items"].append(
                {
                    "namespace": [str(part) for part in entry.get("namespace", [])],
                    "key": str(entry["key"]),
                    "value": _json(item.get("value"), {}),
                    "index_config": item.get("_index") or item.get("index"),
                    "ttl_minutes": item.get("_ttl"),
                    "expires_at": _timestamp(item["_expires_at"]) if item.get("_expires_at") else None,
                    "created_at": created,
                    "updated_at": _timestamp(item.get("updated_at"), created),
                }
            )

    tasks = snapshot.get("a2a") or {}
    if isinstance(tasks, Mapping):
        for raw_id, task in tasks.items():
            if not isinstance(task, Mapping):
                continue
            status = task.get("status") or {}
            timestamp = status.get("timestamp") if isinstance(status, Mapping) else None
            created = _timestamp(timestamp)
            rows["a2a_tasks"].append(
                {
                    "task_id": str(raw_id),
                    "assistant_id": str(task.get("assistantId", "")),
                    "context_id": str(task.get("contextId", "")),
                    "status": str(status.get("state", "unknown")) if isinstance(status, Mapping) else str(status),
                    "payload": dict(task),
                    "created_at": created,
                    "updated_at": created,
                }
            )
    return rows


def _canonical(value: Any) -> Any:
    if isinstance(value, datetime):
        value = value.astimezone(UTC)
        return value.isoformat().replace("+00:00", "Z")
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, Mapping):
        return {str(key): _canonical(item) for key, item in sorted(value.items())}
    if isinstance(value, (list, tuple)):
        return [_canonical(item) for item in value]
    return value


def rows_checksum(rows: Sequence[Mapping[str, Any]]) -> str:
    normalized = [_canonical(row) for row in rows]
    normalized.sort(key=lambda row: json.dumps(row, sort_keys=True, separators=(",", ":")))
    payload = json.dumps(normalized, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode()).hexdigest()


async def _fetch_rows(connection: Any, table: str) -> list[dict[str, Any]]:
    cursor = await connection.execute(f"SELECT * FROM {table}")
    fetched = await cursor.fetchall()
    if any(not isinstance(row, Mapping) for row in fetched):
        raise RuntimeError("snapshot verification requires mapping row_factory")
    return [dict(row) for row in fetched]


async def _insert_rows(connection: Any, rows: dict[str, list[dict[str, Any]]]) -> None:
    statements = {
        "assistants": """INSERT INTO assistants
            (assistant_id, latest_version, graph_id, config, context, metadata, name, description, created_at, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (assistant_id) DO UPDATE SET
            latest_version=EXCLUDED.latest_version, graph_id=EXCLUDED.graph_id, config=EXCLUDED.config,
            context=EXCLUDED.context, metadata=EXCLUDED.metadata, name=EXCLUDED.name,
            description=EXCLUDED.description, created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at""",
        "assistant_versions": """INSERT INTO assistant_versions
            (assistant_id, version, graph_id, config, context, metadata, name, description, created_at, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (assistant_id,version) DO UPDATE SET
            graph_id=EXCLUDED.graph_id, config=EXCLUDED.config, context=EXCLUDED.context,
            metadata=EXCLUDED.metadata, name=EXCLUDED.name, description=EXCLUDED.description,
            created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at""",
        "threads": """INSERT INTO threads
            (thread_id,created_at,updated_at,state_updated_at,metadata,config,values,interrupts,status,ttl)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (thread_id) DO UPDATE SET
            created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at,state_updated_at=EXCLUDED.state_updated_at,
            metadata=EXCLUDED.metadata,config=EXCLUDED.config,values=EXCLUDED.values,
            interrupts=EXCLUDED.interrupts,status=EXCLUDED.status,ttl=EXCLUDED.ttl""",
        "runs": """INSERT INTO runs
            (run_id,thread_id,assistant_id,created_at,updated_at,status,metadata,kwargs,multitask_strategy,result)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (run_id) DO UPDATE SET
            thread_id=EXCLUDED.thread_id,assistant_id=EXCLUDED.assistant_id,created_at=EXCLUDED.created_at,
            updated_at=EXCLUDED.updated_at,status=EXCLUDED.status,metadata=EXCLUDED.metadata,
            kwargs=EXCLUDED.kwargs,multitask_strategy=EXCLUDED.multitask_strategy,result=EXCLUDED.result""",
        "crons": """INSERT INTO crons
            (cron_id,assistant_id,thread_id,schedule,timezone,enabled,payload,next_run_date,end_time,metadata,created_at,updated_at,user_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (cron_id) DO UPDATE SET
            assistant_id=EXCLUDED.assistant_id,thread_id=EXCLUDED.thread_id,schedule=EXCLUDED.schedule,
            timezone=EXCLUDED.timezone,enabled=EXCLUDED.enabled,payload=EXCLUDED.payload,
            next_run_date=EXCLUDED.next_run_date,end_time=EXCLUDED.end_time,metadata=EXCLUDED.metadata,
            created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at,user_id=EXCLUDED.user_id""",
        "store_items": """INSERT INTO store_items
            (namespace,key,value,index_config,ttl_minutes,expires_at,created_at,updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (namespace,key) DO UPDATE SET
            value=EXCLUDED.value,index_config=EXCLUDED.index_config,ttl_minutes=EXCLUDED.ttl_minutes,
            expires_at=EXCLUDED.expires_at,created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at""",
        "a2a_tasks": """INSERT INTO a2a_tasks
            (task_id,assistant_id,context_id,status,payload,created_at,updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (task_id) DO UPDATE SET
            assistant_id=EXCLUDED.assistant_id,context_id=EXCLUDED.context_id,status=EXCLUDED.status,
            payload=EXCLUDED.payload,created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at""",
    }
    json_columns = {
        "assistants": {"config", "context", "metadata"},
        "assistant_versions": {"config", "context", "metadata"},
        "threads": {"metadata", "config", "values", "interrupts", "ttl"},
        "runs": {"metadata", "kwargs", "result"},
        "crons": {"payload", "metadata"},
        "store_items": {"value", "index_config"},
        "a2a_tasks": {"payload"},
    }
    columns = {
        "assistants": ("assistant_id", "latest_version", "graph_id", "config", "context", "metadata", "name", "description", "created_at", "updated_at"),
        "assistant_versions": ("assistant_id", "version", "graph_id", "config", "context", "metadata", "name", "description", "created_at", "updated_at"),
        "threads": ("thread_id", "created_at", "updated_at", "state_updated_at", "metadata", "config", "values", "interrupts", "status", "ttl"),
        "runs": ("run_id", "thread_id", "assistant_id", "created_at", "updated_at", "status", "metadata", "kwargs", "multitask_strategy", "result"),
        "crons": ("cron_id", "assistant_id", "thread_id", "schedule", "timezone", "enabled", "payload", "next_run_date", "end_time", "metadata", "created_at", "updated_at", "user_id"),
        "store_items": ("namespace", "key", "value", "index_config", "ttl_minutes", "expires_at", "created_at", "updated_at"),
        "a2a_tasks": ("task_id", "assistant_id", "context_id", "status", "payload", "created_at", "updated_at"),
    }
    for table in TABLES:
        for row in rows[table]:
            values = tuple(
                Jsonb(row[key]) if key in json_columns[table] and row[key] is not None else row[key]
                for key in columns[table]
            )
            await connection.execute(statements[table], values)


def _identity(table: str, row: Mapping[str, Any]) -> str:
    if table == "assistant_versions":
        return f"{row['assistant_id']}:{row['version']}"
    if table == "store_items":
        return f"{'/'.join(row['namespace'])}:{row['key']}"
    key = {
        "assistants": "assistant_id", "threads": "thread_id", "runs": "run_id",
        "crons": "cron_id", "a2a_tasks": "task_id",
    }[table]
    return str(row[key])


async def migrate_snapshot(connection: Any) -> BackfillReport | None:
    """Backfill and verify in one transaction; return ``None`` when not needed."""

    async with connection.transaction():
        # Serialize startup attempts without requiring a persistent lock table.
        await connection.execute(
            "SELECT pg_advisory_xact_lock(%s)", (SNAPSHOT_MIGRATION_VERSION,)
        )
        cursor = await connection.execute(
            "SELECT 1 FROM schema_migrations WHERE version=%s",
            (SNAPSHOT_MIGRATION_VERSION,),
        )
        if await cursor.fetchone() is not None:
            return None
        cursor = await connection.execute(
            "SELECT to_regclass('langgraph_fast_resources') AS legacy_table"
        )
        legacy = await cursor.fetchone()
        legacy_table = legacy.get("legacy_table") if isinstance(legacy, Mapping) else legacy[0] if legacy else None
        if legacy_table is None:
            return None
        cursor = await connection.execute(
            "SELECT to_regclass('langgraph_fast_schema_version') AS legacy_version_table"
        )
        legacy_version_table = await cursor.fetchone()
        version_table = (
            legacy_version_table.get("legacy_version_table")
            if isinstance(legacy_version_table, Mapping)
            else legacy_version_table[0] if legacy_version_table else None
        )
        if version_table is not None:
            cursor = await connection.execute(
                "SELECT max(version) AS version FROM langgraph_fast_schema_version"
            )
            legacy_version_row = await cursor.fetchone()
            legacy_version = (
                legacy_version_row.get("version")
                if isinstance(legacy_version_row, Mapping)
                else legacy_version_row[0] if legacy_version_row else None
            )
            if legacy_version is not None and int(legacy_version) > 1:
                raise RuntimeError(
                    f"unsupported legacy metadata schema version: {legacy_version}"
                )
        cursor = await connection.execute(
            """SELECT payload FROM langgraph_fast_resources
            WHERE kind='runtime' AND resource_id='snapshot' FOR SHARE"""
        )
        row = await cursor.fetchone()
        payload = row.get("payload") if isinstance(row, Mapping) else row[0] if row else {}
        source = snapshot_to_rows(payload if isinstance(payload, Mapping) else {})
        await _insert_rows(connection, source)
        all_target = {table: await _fetch_rows(connection, table) for table in TABLES}
        source_ids = {
            table: {_identity(table, item) for item in source[table]} for table in TABLES
        }
        target = {
            table: [item for item in all_target[table] if _identity(table, item) in source_ids[table]]
            for table in TABLES
        }
        source_counts = {table: len(source[table]) for table in TABLES}
        target_counts = {table: len(target[table]) for table in TABLES}
        id_sets_match = all(
            {_identity(table, item) for item in source[table]}
            == {_identity(table, item) for item in target[table]}
            for table in TABLES
        )
        source_latest = {str(row["assistant_id"]): row["latest_version"] for row in source["assistants"]}
        target_latest = {str(row["assistant_id"]): row["latest_version"] for row in target["assistants"]}
        checksum_matches = all(rows_checksum(source[table]) == rows_checksum(target[table]) for table in TABLES)
        report = BackfillReport(
            source_counts, target_counts, id_sets_match,
            source_latest == target_latest, checksum_matches,
        )
        if not report.valid:
            raise RuntimeError(f"snapshot backfill verification failed: {report}")
        checksum = rows_checksum([row for table in TABLES for row in source[table]])
        await connection.execute(
            """INSERT INTO schema_migrations(version,name,checksum)
            VALUES (%s,%s,%s) ON CONFLICT (version) DO UPDATE
            SET name=EXCLUDED.name,checksum=EXCLUDED.checksum,applied_at=now()""",
            (SNAPSHOT_MIGRATION_VERSION, SNAPSHOT_MIGRATION_NAME, checksum),
        )
        return report


async def run_snapshot_backfill(connection: Any) -> BackfillReport | None:
    """Public idempotent startup hook for the additive legacy backfill."""

    return await migrate_snapshot(connection)


async def drop_legacy_tables(connection: Any) -> None:
    """Drop only legacy metadata sources after a verified migration marker exists."""

    async with connection.transaction():
        cursor = await connection.execute(
            "SELECT 1 FROM schema_migrations WHERE version=%s AND name=%s",
            (SNAPSHOT_MIGRATION_VERSION, SNAPSHOT_MIGRATION_NAME),
        )
        if await cursor.fetchone() is None:
            raise RuntimeError("legacy tables cannot be dropped before verified backfill")
        await connection.execute("DROP TABLE IF EXISTS langgraph_fast_resources")
        await connection.execute("DROP TABLE IF EXISTS langgraph_fast_schema_version")
