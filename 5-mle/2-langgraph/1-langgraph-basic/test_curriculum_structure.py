from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).parent


def test_curriculum_files_match_langgraph_registration(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test")
    path = ROOT / "scripts" / "validate_curriculum.py"
    spec = importlib.util.spec_from_file_location("validate_curriculum", path)
    assert spec is not None
    assert spec.loader is not None

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.main()
