from __future__ import annotations

import importlib


GRAPH_MODULES = [
    "langchain_lecture.projects.project_01_hello_world.graph",
    "langchain_lecture.projects.project_02_search_agent.graph",
    "langchain_lecture.projects.project_03_agents_under_the_hood.graph",
    "langchain_lecture.projects.project_04_rag_gist.graph",
    "langchain_lecture.projects.project_05_code_interpreter.graph",
    "langchain_lecture.projects.project_06_documentation_helper.graph",
]


def test_all_studio_graphs_compile_without_external_clients():
    for module_name in GRAPH_MODULES:
        module = importlib.import_module(module_name)
        assert module.graph is not None
        assert module.graph.get_graph().nodes

