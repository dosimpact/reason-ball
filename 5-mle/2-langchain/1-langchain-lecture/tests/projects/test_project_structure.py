from __future__ import annotations

import importlib
from pathlib import Path


def test_expected_project_modules_exist():
    root = Path(__file__).resolve().parents[2] / "src" / "langchain_lecture"

    assert (root / "shared" / "config.py").exists()
    assert (root / "shared" / "models.py").exists()
    for name in ["documents.py", "evaluation.py", "events.py", "offline.py", "safety.py"]:
        assert (root / "shared" / name).exists()

    projects = root / "projects"
    for name in [
        "project_01_hello_world",
        "project_02_search_agent",
        "project_03_agents_under_the_hood",
        "project_04_rag_gist",
        "project_05_code_interpreter",
        "project_06_documentation_helper",
    ]:
        assert (projects / name / "__init__.py").exists()
        assert (projects / name / "app.py").exists()

    projects_2 = root / "projects_2"
    for name in [
        "project_07_streaming_chatbot",
        "project_08_memory_chatbot",
        "project_09_structured_output_extractor",
        "project_10_rag_advanced_retrieval",
        "project_11_agent_middleware_guardrails",
        "project_12_langsmith_observability_eval",
        "project_13_mcp_tools_agent",
    ]:
        assert (projects_2 / name / "__init__.py").exists()
        assert (projects_2 / name / "app.py").exists()
        assert (projects_2 / name / "graph.py").exists()
        assert (projects_2 / name / "main.py").exists()

        app = importlib.import_module(f"langchain_lecture.projects_2.{name}.app")
        assert callable(app.main)
