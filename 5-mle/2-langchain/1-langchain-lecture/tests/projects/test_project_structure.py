from __future__ import annotations

from pathlib import Path


def test_expected_project_modules_exist():
    root = Path(__file__).resolve().parents[2] / "src" / "langchain_lecture"

    assert (root / "shared" / "config.py").exists()
    assert (root / "shared" / "models.py").exists()

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

