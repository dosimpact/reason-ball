from __future__ import annotations

import ast
from pathlib import Path


def test_talib_imports_are_confined_to_infrastructure_boundary() -> None:
    project_root = Path(__file__).resolve().parents[2]
    source_root = project_root / "src"
    allowed_root = source_root / "infrastructure" / "technical_analysis" / "talib"
    violations: list[str] = []

    for path in source_root.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        imports_talib = any(
            (
                isinstance(node, ast.Import)
                and any(alias.name == "talib" or alias.name.startswith("talib.") for alias in node.names)
            )
            or (
                isinstance(node, ast.ImportFrom)
                and node.module is not None
                and (node.module == "talib" or node.module.startswith("talib."))
            )
            for node in ast.walk(tree)
        )
        if imports_talib and not path.is_relative_to(allowed_root):
            violations.append(str(path.relative_to(project_root)))

    assert violations == []
