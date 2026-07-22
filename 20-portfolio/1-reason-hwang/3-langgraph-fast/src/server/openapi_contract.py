from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any


def _candidate_paths() -> list[Path]:
    configured = os.getenv("LANGGRAPH_STANDARD_OPENAPI")
    candidates = [Path(configured)] if configured else []
    current = Path(__file__).resolve()
    candidates.extend(
        parent / ".apb-workspace" / "docs" / "01-plan" / "langgraph-standard.json"
        for parent in current.parents
    )
    return candidates


@lru_cache(maxsize=1)
def load_standard_openapi() -> dict[str, Any]:
    for path in _candidate_paths():
        if path.is_file():
            return json.loads(path.read_text(encoding="utf-8"))
    raise RuntimeError(
        "langgraph-standard.json not found; set LANGGRAPH_STANDARD_OPENAPI to its absolute path"
    )
