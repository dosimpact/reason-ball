import pytest

from infrastructure.postgres.migrations import DDL, prepare_schema


class FakeCursor:
    def __init__(self, row):
        self.row = row

    async def fetchone(self):
        return self.row


class FakeConnection:
    def __init__(self, row=None):
        self.row = row
        self.queries: list[str] = []

    async def execute(self, query: str, params=()):
        self.queries.append(query)
        return FakeCursor(self.row)


@pytest.mark.asyncio
async def test_local_profile_runs_idempotent_ddl_statements() -> None:
    connection = FakeConnection()
    await prepare_schema(connection, profile="local")
    assert connection.queries == list(DDL)


@pytest.mark.asyncio
async def test_non_local_profile_only_reads_current_schema() -> None:
    connection = FakeConnection({"version": 1})
    await prepare_schema(connection, profile="production")
    assert len(connection.queries) == 1
    assert connection.queries[0].startswith("SELECT version")


@pytest.mark.asyncio
async def test_non_local_profile_fails_on_schema_drift_without_ddl() -> None:
    connection = FakeConnection(None)
    with pytest.raises(RuntimeError, match="missing or outdated"):
        await prepare_schema(connection, profile="staging")
    assert len(connection.queries) == 1
    assert connection.queries[0].startswith("SELECT version")
