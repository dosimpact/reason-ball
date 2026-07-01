from __future__ import annotations

import argparse
from collections.abc import Callable


def _commands() -> dict[str, Callable[[], None]]:
    from langchain_lecture.projects.project_01_hello_world.app import main as hello
    from langchain_lecture.projects.project_02_search_agent.app import main as search
    from langchain_lecture.projects.project_03_agents_under_the_hood.app import (
        main as agent_loop,
    )
    from langchain_lecture.projects.project_04_rag_gist.app import main as rag
    from langchain_lecture.projects.project_05_code_interpreter.app import (
        main as code_interpreter,
    )
    from langchain_lecture.projects.project_06_documentation_helper.app import (
        main as docs_helper,
    )

    return {
        "hello-world": hello,
        "search-agent": search,
        "agents-under-the-hood": agent_loop,
        "rag-gist": rag,
        "code-interpreter": code_interpreter,
        "documentation-helper": docs_helper,
    }


def main() -> None:
    commands = _commands()
    parser = argparse.ArgumentParser()
    parser.add_argument("project", choices=sorted(commands))
    args = parser.parse_args()
    commands[args.project]()

