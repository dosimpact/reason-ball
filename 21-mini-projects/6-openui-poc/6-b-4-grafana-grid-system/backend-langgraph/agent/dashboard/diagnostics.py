"""Bounded local execution evidence; no report text, programs, or provider credentials."""

import json
from datetime import UTC, datetime

from langchain_core.messages import convert_to_messages

from agent import history
from agent.dashboard.execution import completed_effects, missing_effects


def record(thread_id, run_id, plan, messages, status, grounding_audit=None):
    evidence = convert_to_messages(messages)
    value = {
        "plan": plan.model_dump(),
        "completed": sorted(completed_effects(evidence)),
        "missing": sorted(missing_effects(plan, evidence)),
        "status": status,
        "grounding": grounding_audit or [],
    }
    with history.connect() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS dashboard_run_diagnostics (
            run_id TEXT PRIMARY KEY, thread_id TEXT NOT NULL,
            created_at TEXT NOT NULL, evidence TEXT NOT NULL)""")
        db.execute(
            "INSERT OR REPLACE INTO dashboard_run_diagnostics VALUES (?,?,?,?)",
            (
                run_id,
                history.checked_id(thread_id),
                datetime.now(UTC).isoformat(),
                json.dumps(value, ensure_ascii=False),
            ),
        )
        db.execute(
            """DELETE FROM dashboard_run_diagnostics WHERE thread_id=? AND run_id NOT IN
            (SELECT run_id FROM dashboard_run_diagnostics WHERE thread_id=? ORDER BY created_at DESC LIMIT 100)""",
            (thread_id, thread_id),
        )


def latest(thread_id):
    with history.connect() as db:
        row = db.execute(
            "SELECT evidence FROM dashboard_run_diagnostics WHERE thread_id=? ORDER BY created_at DESC LIMIT 1",
            (history.checked_id(thread_id),),
        ).fetchone()
    return json.loads(row[0]) if row else None
