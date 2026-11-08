import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    monkeypatch.setenv("DEEP_AGENTS_MODE", "scripted")
    monkeypatch.setenv("LANGSMITH_TRACING", "false")


@pytest.fixture
def example():
    def load(number):
        path = next((ROOT / "graphs/deep_agents").rglob(f"{number:02d}_*.py"))
        spec = importlib.util.spec_from_file_location(path.stem, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    return load
