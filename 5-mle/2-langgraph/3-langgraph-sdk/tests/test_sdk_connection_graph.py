import importlib
import json
from pathlib import Path

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

import common.llm

from graphs import __name__ as graphs_package_name


ROOT = Path(__file__).resolve().parents[1]
GRAPH_ENTRIES = json.loads((ROOT / "langgraph.json").read_text())["graphs"]


def test_graph_package_imports():
    assert graphs_package_name == "graphs"


class ImportOnlyChatModel(FakeListChatModel):
    def bind_tools(self, tools, **kwargs):
        return self


@pytest.fixture
def offline_model(monkeypatch):
    # AG-UI graphs construct a tool-capable model at import time.
    # Only graph construction is tested; no credentials or provider calls are needed.
    monkeypatch.setattr(
        common.llm, "create_llm", lambda *args, **kwargs: ImportOnlyChatModel(responses=["unused"])
    )


@pytest.mark.parametrize("graph_id,entry", GRAPH_ENTRIES.items(), ids=GRAPH_ENTRIES)
def test_registered_graph_modules_import(graph_id, entry, offline_model):
    path, export = entry.split(":")
    source = ROOT / path
    assert source.is_file(), f"{graph_id}: missing {path}"
    module_name = ".".join(Path(path).with_suffix("").parts)
    module = importlib.import_module(module_name)
    assert getattr(module, export) is not None
