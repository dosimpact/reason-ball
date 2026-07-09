from __future__ import annotations

from typing import Any, cast

from infrastructure.neo4j.writer import Neo4jWriter
from settings import AppSettings, get_settings

CONSTRAINT_QUERIES = [
    "CREATE CONSTRAINT company_id_unique IF NOT EXISTS FOR (n:Company) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT filing_id_unique IF NOT EXISTS FOR (n:Filing) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT item_id_unique IF NOT EXISTS FOR (n:Item) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT section_text_id_unique IF NOT EXISTS FOR (n:SectionText) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT statement_id_unique IF NOT EXISTS FOR (n:Statement) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT fact_id_unique IF NOT EXISTS FOR (n:Fact) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (n:Entity) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT metric_id_unique IF NOT EXISTS FOR (n:Metric) REQUIRE n.id IS UNIQUE",
    "CREATE CONSTRAINT risk_id_unique IF NOT EXISTS FOR (n:Risk) REQUIRE n.id IS UNIQUE",
]


def init_neo4j_constraints(settings: AppSettings | None = None, database: str | None = None) -> dict[str, Any]:
    active_settings = settings or get_settings()
    with Neo4jWriter(settings=active_settings, database=database) as writer:
        with writer.driver.session(database=writer.database) as session:
            for query in CONSTRAINT_QUERIES:
                session.run(cast(Any, query))
    return {"status": "ok", "constraints": len(CONSTRAINT_QUERIES), "database": database or active_settings.neo4j_database}
