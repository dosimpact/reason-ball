from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class AppSettings:
    neo4j_uri: str
    neo4j_user: str
    neo4j_password: str
    neo4j_database: str
    llm_provider: str
    parser_chunk_max_chars: int
    parser_chunk_overlap: int
    sec_user_agent: str
    prompts_dir: Path
    env_profile: str | None = None
    postgres_host: str | None = None
    postgres_port: int | None = None
    postgres_user: str | None = None
    postgres_password: str | None = None
    postgres_db: str | None = None
    max_concurrent_runs: int = 10
    max_queued_runs: int = 10

    @classmethod
    def from_env(cls) -> "AppSettings":
        root_dir = Path(__file__).resolve().parents[2]

        def read_positive_int(key: str, fallback: int) -> int:
            raw = os.getenv(key)
            if raw is None or raw.strip() == "":
                return fallback
            try:
                parsed = int(raw)
            except ValueError:
                return fallback
            return parsed if parsed > 0 else fallback

        def read_optional_int(key: str) -> int | None:
            raw = os.getenv(key)
            if raw is None or not raw.strip() or raw.strip().lower() == "your":
                return None
            try:
                return int(raw)
            except ValueError:
                return None

        def read_optional(key: str) -> str | None:
            value = os.getenv(key)
            if value is None or not value.strip() or value.strip().lower() == "your":
                return None
            return value.strip()

        return cls(
            neo4j_uri=os.getenv("NEO4J_URI", "bolt://127.0.0.1:7687"),
            neo4j_user=os.getenv("NEO4J_USER", "neo4j"),
            neo4j_password=os.getenv("NEO4J_PASSWORD", "test1234"),
            neo4j_database=os.getenv("NEO4J_DATABASE", "neo4j"),
            llm_provider=os.getenv("LLM_PROVIDER", "mock").lower(),
            parser_chunk_max_chars=read_positive_int("PARSER_CHUNK_MAX_CHARS", 6000),
            parser_chunk_overlap=read_positive_int("PARSER_CHUNK_OVERLAP", 400),
            sec_user_agent=os.getenv("SEC_USER_AGENT", ""),
            prompts_dir=root_dir / "prompts",
            env_profile=read_optional("ENV_PROFILE"),
            postgres_host=read_optional("POSTGRES_HOST"),
            postgres_port=read_optional_int("POSTGRES_PORT"),
            postgres_user=read_optional("POSTGRES_USER"),
            postgres_password=read_optional("POSTGRES_PASSWORD"),
            postgres_db=read_optional("POSTGRES_DB"),
            max_concurrent_runs=read_positive_int("MAX_CONCURRENT_RUNS", 10),
            max_queued_runs=read_positive_int("MAX_QUEUED_RUNS", 10),
        )

    @property
    def postgres_configured(self) -> bool:
        return all(
            (
                self.env_profile,
                self.postgres_host,
                self.postgres_port,
                self.postgres_user,
                self.postgres_password,
                self.postgres_db,
            )
        )

    def postgres_conninfo(self) -> str:
        if self.env_profile not in {"local", "dev", "staging", "production"}:
            raise ValueError("ENV_PROFILE must be one of local, dev, staging, production")
        if not self.postgres_configured:
            raise ValueError("PostgreSQL environment variables are required")
        return (
            f"host={self.postgres_host} port={self.postgres_port} user={self.postgres_user} "
            f"password={self.postgres_password} dbname={self.postgres_db}"
        )


_cached_settings: AppSettings | None = None


def get_settings() -> AppSettings:
    global _cached_settings
    if _cached_settings is None:
        _cached_settings = AppSettings.from_env()
    return _cached_settings


def reset_settings_cache() -> None:
    global _cached_settings
    _cached_settings = None
