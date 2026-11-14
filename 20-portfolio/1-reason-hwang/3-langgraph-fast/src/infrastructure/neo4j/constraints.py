from __future__ import annotations

from typing import Any, cast

from infrastructure.neo4j.writer import Neo4jWriter
from settings import AppSettings, get_settings

NODE_CONSTRAINTS = {
    "company_id_unique": "Company",
    "filing_id_unique": "Filing",
    "item_id_unique": "Item",
    "xbrl_fact_id_unique": "XbrlFact",
    "concept_id_unique": "Concept",
    "context_id_unique": "Context",
    "dimension_id_unique": "Dimension",
    "member_id_unique": "Member",
    "dimension_value_id_unique": "DimensionValue",
    "unit_id_unique": "Unit",
}
CONSTRAINT_QUERIES = [
    f"CREATE CONSTRAINT {name} IF NOT EXISTS FOR (n:{label}) REQUIRE n.id IS UNIQUE"
    for name, label in NODE_CONSTRAINTS.items()
]
EXPECTED_CONSTRAINT_NAMES = set(NODE_CONSTRAINTS)


def init_neo4j_constraints(
    settings: AppSettings | None = None, database: str | None = None
) -> dict[str, Any]:
    active_settings = settings or get_settings()
    with (
        Neo4jWriter(settings=active_settings, database=database) as writer,
        writer.driver.session(database=writer.database) as session,
    ):
        for query in CONSTRAINT_QUERIES:
            session.run(cast(Any, query))
    return {
        "status": "ok",
        "constraints": len(CONSTRAINT_QUERIES),
        "database": database or active_settings.neo4j_database,
    }


def prepare_neo4j_schema(
    *,
    profile: str,
    settings: AppSettings | None = None,
    database: str | None = None,
) -> dict[str, Any]:
    """Create constraints locally or verify them without DDL elsewhere."""

    if profile not in {"local", "dev", "staging", "production"}:
        raise ValueError("ENV_PROFILE must be one of local, dev, staging, production")
    active_settings = settings or get_settings()
    active_database = database or active_settings.neo4j_database
    if profile == "local":
        return init_neo4j_constraints(
            settings=active_settings, database=active_database
        )

    with (
        Neo4jWriter(settings=active_settings, database=active_database) as writer,
        writer.driver.session(database=writer.database) as session,
    ):
        records = session.run("SHOW CONSTRAINTS YIELD name RETURN name")
        actual_names = {record["name"] for record in records}

    missing = sorted(EXPECTED_CONSTRAINT_NAMES - actual_names)
    if missing:
        raise RuntimeError(
            "Neo4j schema is missing or outdated; migrations are local-only; "
            f"missing constraints: {', '.join(missing)}"
        )
    return {
        "status": "ok",
        "constraints": len(EXPECTED_CONSTRAINT_NAMES),
        "database": active_database,
    }
