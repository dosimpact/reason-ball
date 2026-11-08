"""Validate the seven numbered basic groups and the standalone UI example."""

from __future__ import annotations

import importlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.validate_integration import BASIC_GROUPS, basic_mapping, validate


def main() -> None:
    os.environ.setdefault("OPENAI_API_KEY", "test")
    validate()
    expected = {row["target"] for row in basic_mapping()}
    expected.add("graphs/basic/47_push_ui_message.py")
    actual = {
        path.relative_to(ROOT).as_posix() for path in (ROOT / "graphs/basic").rglob("[0-9]*.py")
    }
    assert actual == expected, (
        f"Curriculum mismatch: missing={expected - actual}, extra={actual - expected}"
    )
    filenames = [f"{i}-langgraph-basic-{name}.json" for i, name in enumerate(BASIC_GROUPS, 1)]
    filenames.append("langgraph-basic-ui-events.json")
    for filename in filenames:
        config = json.loads((ROOT / filename).read_text())
        for entry in config["graphs"].values():
            module, export = entry.rsplit(":", 1)
            assert hasattr(importlib.import_module(module), export), entry
    print(f"Validated {len(expected)} curriculum graphs in 7 groups + standalone UI.")


if __name__ == "__main__":
    main()
