import pytest

from settings import AppSettings


def test_postgres_conninfo_requires_profile(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in (
        "ENV_PROFILE",
        "POSTGRES_HOST",
        "POSTGRES_PORT",
        "POSTGRES_USER",
        "POSTGRES_PASSWORD",
        "POSTGRES_DB",
    ):
        monkeypatch.delenv(key, raising=False)
    settings = AppSettings.from_env()
    with pytest.raises(ValueError, match="ENV_PROFILE"):
        settings.postgres_conninfo()


def test_postgres_conninfo_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    values = {
        "ENV_PROFILE": "local",
        "POSTGRES_HOST": "localhost",
        "POSTGRES_PORT": "55432",
        "POSTGRES_USER": "postgres",
        "POSTGRES_PASSWORD": "secret",
        "POSTGRES_DB": "graph",
    }
    for key, value in values.items():
        monkeypatch.setenv(key, value)
    settings = AppSettings.from_env()
    assert settings.postgres_configured
    assert "host=localhost" in settings.postgres_conninfo()
    assert "port=55432" in settings.postgres_conninfo()
