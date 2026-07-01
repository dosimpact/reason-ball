from __future__ import annotations

from pathlib import Path
from typing import Any

from langchain_core.tools import Tool

from langchain_lecture.shared.models import get_chat_model


CODE_INTERPRETER_SYSTEM_PROMPT = """You are an agent designed to write and execute
Python code to answer questions. Use the Python REPL when calculation, file
generation, or data analysis is needed. If code fails, debug and try again."""


def build_python_agent(model=None):
    from langchain.agents import create_agent
    from langchain_experimental.tools import PythonREPLTool

    llm = model or get_chat_model(temperature=0)
    return create_agent(
        model=llm,
        tools=[PythonREPLTool()],
        system_prompt=CODE_INTERPRETER_SYSTEM_PROMPT,
    )


def build_csv_tool(csv_path: str | Path, model=None) -> Tool:
    def run_csv_question(question: str) -> dict[str, Any]:
        from langchain_experimental.agents.agent_toolkits import create_csv_agent

        csv_agent = create_csv_agent(
            llm=model or get_chat_model(temperature=0),
            path=str(csv_path),
            allow_dangerous_code=True,
            verbose=False,
        )
        return csv_agent.invoke({"input": question})

    return Tool(
        name="CSV Agent",
        func=run_csv_question,
        description="Answer questions over the configured CSV file.",
    )


def build_router_agent(csv_path: str | Path | None = None, model=None):
    from langchain.agents import create_agent
    from langchain_experimental.tools import PythonREPLTool

    tools: list[Any] = [PythonREPLTool()]
    if csv_path is not None:
        tools.append(build_csv_tool(csv_path, model=model))

    return create_agent(
        model=model or get_chat_model(temperature=0),
        tools=tools,
        system_prompt=CODE_INTERPRETER_SYSTEM_PROMPT,
    )

