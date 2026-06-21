from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv


@dataclass(frozen=True)
class AppConfig:
    neo4j_uri: str
    neo4j_user: str
    neo4j_password: str
    neo4j_database: str
    collector_api_base_url: str
    collector_api_token: str
    llm_provider: str
    llm_api_key: str
    llm_model: str
    codex_cli_path: str
    codex_profile: str
    codex_sandbox: str
    codex_exec_timeout_sec: int
    log_level: str
    parser_max_workers: int
    parser_chunk_max_chars: int
    parser_chunk_overlap: int
    mock_documents_path: Path
    prompts_dir: Path
    runtime_db_path: Path
    runtime_store_max_threads: int
    runtime_store_retention_days: int
    parser_backend_base_url: str

    @classmethod
    def from_env(cls, env_file: Optional[str] = None) -> "AppConfig":
        if env_file:
            load_dotenv(env_file)
        else:
            load_dotenv()

        root_dir = Path(__file__).resolve().parents[3]

        def read_path(key: str, fallback: Path) -> Path:
            raw = os.getenv(key)
            if raw is None or raw.strip() == "":
                return fallback
            path = Path(raw)
            return path if path.is_absolute() else root_dir / path

        def read_positive_int(key: str, fallback: int) -> int:
            raw = os.getenv(key)
            if raw is None or raw.strip() == "":
                return fallback
            try:
                parsed = int(raw)
            except ValueError:
                return fallback
            return parsed if parsed > 0 else fallback

        return cls(
            neo4j_uri=os.getenv("NEO4J_URI", "bolt://127.0.0.1:7687"),
            neo4j_user=os.getenv("NEO4J_USER", "neo4j"),
            neo4j_password=os.getenv("NEO4J_PASSWORD", "test1234"),
            neo4j_database=os.getenv("NEO4J_DATABASE", "neo4j"),
            collector_api_base_url=os.getenv("COLLECTOR_API_BASE_URL", "http://localhost:8080"),
            collector_api_token=os.getenv("COLLECTOR_API_TOKEN", ""),
            llm_provider=os.getenv("LLM_PROVIDER", "mock").lower(),
            llm_api_key=os.getenv("LLM_API_KEY", ""),
            llm_model=os.getenv("LLM_MODEL", "gpt-5"),
            codex_cli_path=os.getenv("CODEX_CLI_PATH", "codex"),
            codex_profile=os.getenv("CODEX_PROFILE", ""),
            codex_sandbox=os.getenv("CODEX_SANDBOX", "read-only"),
            codex_exec_timeout_sec=read_positive_int("CODEX_EXEC_TIMEOUT_SEC", 45),
            log_level=os.getenv("LOG_LEVEL", "INFO"),
            parser_max_workers=read_positive_int("PARSER_MAX_WORKERS", 4),
            parser_chunk_max_chars=read_positive_int("PARSER_CHUNK_MAX_CHARS", 6000),
            parser_chunk_overlap=int(os.getenv("PARSER_CHUNK_OVERLAP", "400")),
            mock_documents_path=read_path("MOCK_DOCUMENTS_PATH", root_dir / "examples" / "mock_documents.json"),
            prompts_dir=root_dir / "prompts",
            runtime_db_path=read_path("RUNTIME_DB_PATH", root_dir / "data" / "runtime.db"),
            runtime_store_max_threads=read_positive_int("RUNTIME_STORE_MAX_THREADS", 500),
            runtime_store_retention_days=read_positive_int("RUNTIME_STORE_RETENTION_DAYS", 30),
            parser_backend_base_url=os.getenv("PARSER_BACKEND_BASE_URL", "http://localhost:3406"),
        )


_cached_settings: AppConfig | None = None


def get_settings(env_file: Optional[str] = None) -> AppConfig:
    global _cached_settings
    if _cached_settings is None:
        _cached_settings = AppConfig.from_env(env_file=env_file)
    return _cached_settings


def load_settings(env_file: Optional[str] = None) -> AppConfig:
    return get_settings(env_file=env_file)
