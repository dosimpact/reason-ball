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
    from langchain_lecture.projects_2.project_07_streaming_chatbot.app import (
        main as streaming_chatbot,
    )
    from langchain_lecture.projects_2.project_08_memory_chatbot.app import (
        main as memory_chatbot,
    )
    from langchain_lecture.projects_2.project_09_structured_output_extractor.app import (
        main as structured_output,
    )
    from langchain_lecture.projects_2.project_10_rag_advanced_retrieval.app import (
        main as advanced_rag,
    )
    from langchain_lecture.projects_2.project_11_agent_middleware_guardrails.app import (
        main as guardrails_agent,
    )
    from langchain_lecture.projects_2.project_12_langsmith_observability_eval.app import (
        main as langsmith_eval,
    )
    from langchain_lecture.projects_2.project_13_mcp_tools_agent.app import (
        main as mcp_tools_agent,
    )

    return {
        "hello-world": hello,
        "search-agent": search,
        "agents-under-the-hood": agent_loop,
        "rag-gist": rag,
        "code-interpreter": code_interpreter,
        "documentation-helper": docs_helper,
        "streaming-chatbot": streaming_chatbot,
        "memory-chatbot": memory_chatbot,
        "structured-output-extractor": structured_output,
        "rag-advanced-retrieval": advanced_rag,
        "agent-middleware-guardrails": guardrails_agent,
        "langsmith-observability-eval": langsmith_eval,
        "mcp-tools-agent": mcp_tools_agent,
    }


def main() -> None:
    commands = _commands()
    parser = argparse.ArgumentParser()
    parser.add_argument("project", choices=sorted(commands))
    args = parser.parse_args()
    commands[args.project]()


if __name__ == "__main__":
    main()
