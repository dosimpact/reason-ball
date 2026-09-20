from contextlib import AbstractContextManager
from types import SimpleNamespace
from typing import Any, ClassVar, Self

import pytest

from infrastructure.neo4j import constraints


class FakeSession(AbstractContextManager):
    def __init__(self, names: set[str]) -> None:
        self.names = names
        self.queries: list[str] = []

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def run(self, query: str) -> list[dict[str, str]]:
        self.queries.append(query)
        return [{"name": name} for name in self.names]


class FakeWriter(AbstractContextManager):
    names: ClassVar[set[str]] = set()
    last_session: ClassVar[FakeSession | None] = None

    def __init__(self, settings: Any = None, database: str | None = None) -> None:
        self.database = database or settings.neo4j_database
        session = FakeSession(self.names)
        type(self).last_session = session
        self.driver = SimpleNamespace(session=lambda database: session)

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *args: object) -> None:
        return None


def test_local_profile_runs_idempotent_constraint_initialization(monkeypatch: pytest.MonkeyPatch) -> None:
    initialized: list[tuple[Any, str | None]] = []
    settings = SimpleNamespace(neo4j_database="neo4j")
    monkeypatch.setattr(constraints, "get_settings", lambda: settings)
    monkeypatch.setattr(
        constraints,
        "init_neo4j_constraints",
        lambda settings, database: initialized.append((settings, database))
        or {"status": "ok", "constraints": 9, "database": database},
    )

    result = constraints.prepare_neo4j_schema(profile="local")

    assert initialized == [(settings, "neo4j")]
    assert result["constraints"] == 9


def test_non_local_profile_only_verifies_constraints(monkeypatch: pytest.MonkeyPatch) -> None:
    FakeWriter.names = constraints.EXPECTED_CONSTRAINT_NAMES
    monkeypatch.setattr(constraints, "Neo4jWriter", FakeWriter)
    monkeypatch.setattr(
        constraints, "get_settings", lambda: SimpleNamespace(neo4j_database="neo4j")
    )

    result = constraints.prepare_neo4j_schema(profile="production")

    assert result["constraints"] == 9
    assert FakeWriter.last_session is not None
    assert FakeWriter.last_session.queries == ["SHOW CONSTRAINTS YIELD name RETURN name"]


def test_non_local_profile_fails_when_constraint_is_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    FakeWriter.names = constraints.EXPECTED_CONSTRAINT_NAMES - {"risk_id_unique"}
    monkeypatch.setattr(constraints, "Neo4jWriter", FakeWriter)
    monkeypatch.setattr(
        constraints, "get_settings", lambda: SimpleNamespace(neo4j_database="neo4j")
    )

    with pytest.raises(RuntimeError, match="risk_id_unique"):
        constraints.prepare_neo4j_schema(profile="staging")


def test_unknown_profile_is_rejected() -> None:
    with pytest.raises(ValueError, match="ENV_PROFILE"):
        constraints.prepare_neo4j_schema(profile="unknown")
