# 프롬프트 자산과 그래프가 현재 작업 폴더에 의존하지 않고 로드되는지 확인합니다. 실제 모델 호출은 하지 않습니다.
"""The backend starts from its own packaged prompt, independent of frontend/cwd."""

import importlib
from pathlib import Path


def test_graph_loads_from_an_unrelated_working_directory(monkeypatch, tmp_path):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key-no-network-call")
    monkeypatch.chdir(tmp_path)
    module = importlib.import_module("agent.graph")
    assert module.PROMPT_PATH == Path(module.__file__).with_name("system-prompt.txt")
    assert module.PROMPT_PATH.is_file()
    assert module.graph is not None
    assert module.report_graph is not None
    assert module.REPORT_PROMPT_PATH.is_file()
    assert module.PROMPT_PATH.read_text() != module.REPORT_PROMPT_PATH.read_text()
    assert "REPORT GENERATION MODE" not in module.PROMPT_PATH.read_text()
    assert "REPORT GENERATION MODE" in module.REPORT_PROMPT_PATH.read_text()
    assert module.stream_transformers() == [module.OpenUIStreamTransformer]
