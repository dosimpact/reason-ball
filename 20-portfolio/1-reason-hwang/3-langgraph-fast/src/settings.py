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
