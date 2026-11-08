"""Validate graph groups and audit preserved source files."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASIC_GROUPS = {
    "state-and-flow": 8,
    "llm-base": 8,
    "tool-and-agent": 5,
    "memory-and-approval": 8,
    "parallel-and-subgraph": 5,
    "rag-and-reflection": 8,
    "planning-and-multi-agent": 5,
}
COLLECTIONS = {
    "advanced": ("3-langgraph-advanced.json", "basic", "langgraph-advanced.json", 18),
    "patterns": ("4-langgraph-patterns.json", "patterns", "langgraph.json", 21),
    "ui": ("5-langgraph-ui.json", "sdk", "langgraph.json", 49),
    "deep-agents": ("6-langgraph-deep-agents.json", "deep-agents", "langgraph.json", 18),
}


def basic_mapping():
    return json.loads((ROOT / "docs/provenance/basic-renumbering.json").read_text())


def validate(check_sources: bool = False) -> dict[str, int]:
    seen: set[str] = set()
    counts: dict[str, int] = {}
    mapping = basic_mapping()
    original = json.loads((ROOT / "docs/sources/basic/langgraph.json").read_text())["graphs"]
    source_ids = [row["source_id"] for row in mapping if row["source_id"]]
    assert len(mapping) == 47
    assert len(source_ids) == len(set(source_ids))
    assert set(source_ids) | {"b_47_push_ui_message"} == set(original)
    assert [row["old_stem"] for row in mapping if not row["source_id"]] == ["04_2_runnable_config"]
    configs = []
    for number, (name, count) in enumerate(BASIC_GROUPS.items(), 1):
        group = f"{number}-{name}"
        rows = [row for row in mapping if row["group"] == group]
        assert len(rows) == count
        expected = {}
        for index, row in enumerate(rows, 1):
            stem = row["new_stem"]
            assert stem.startswith(f"{number:02d}_{index:02d}_")
            assert row["target"] == f"graphs/basic/{group}/{stem}.py"
            expected[f"b_{stem}"] = row["target"][:-3].replace("/", ".") + ":graph"
        configs.append((f"basic-{name}", f"{number}-langgraph-basic-{name}.json", expected))
    configs.append(
        (
            "basic-ui-events",
            "langgraph-basic-ui-events.json",
            {"b_47_push_ui_message": "graphs.basic.47_push_ui_message:graph"},
        )
    )
    for name, (filename, source_group, source_name, count) in COLLECTIONS.items():
        expected = json.loads((ROOT / "docs/sources" / source_group / source_name).read_text())[
            "graphs"
        ]
        config = json.loads((ROOT / filename).read_text())
        assert len(config["graphs"]) == count
        assert list(config["graphs"]) == list(expected), name
        for graph_id, entry in config["graphs"].items():
            assert entry.split(":")[-1] == expected[graph_id].split(":")[-1]
            assert entry.startswith(f"graphs.{name.replace('-', '_')}.")
        configs.append((name, filename, config["graphs"]))
    for name, filename, expected in configs:
        config = json.loads((ROOT / filename).read_text())
        assert config["dependencies"] == ["."]
        assert config["env"] == ".env"
        assert list(config["graphs"].items()) == list(expected.items()), name
        for graph_id, entry in config["graphs"].items():
            assert graph_id not in seen, graph_id
            seen.add(graph_id)
            module, export = entry.rsplit(":", 1)
            assert (ROOT / (module.replace(".", "/") + ".py")).is_file(), entry
            if name.startswith("basic"):
                assert export == "graph"
                assert graph_id == f"b_{module.rsplit('.', 1)[-1]}"
        counts[name] = len(config["graphs"])
    manifest = json.loads((ROOT / "docs/provenance/copy-manifest.json").read_text())
    manifest += json.loads((ROOT / "docs/provenance/deep-agents-copy-manifest.json").read_text())
    for entry in manifest:
        target = ROOT / entry["target"]
        if entry.get("retained", True):
            assert target.is_file(), f"Missing copied file: {entry['target']}"
        else:
            assert not target.exists(), f"Retired history unexpectedly restored: {entry['target']}"
        if check_sources:
            source = ROOT.parent / entry["source"]
            assert hashlib.sha256(source.read_bytes()).hexdigest() == entry["sha256"], (
                f"Original changed: {source}"
            )
    return counts


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-sources", action="store_true")
    args = parser.parse_args()
    print(json.dumps(validate(args.check_sources)))
