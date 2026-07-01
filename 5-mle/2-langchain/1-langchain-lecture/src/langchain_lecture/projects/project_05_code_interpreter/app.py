from __future__ import annotations

from langchain_lecture.projects.project_05_code_interpreter.agent import build_router_agent


def main() -> None:
    agent = build_router_agent()
    result = agent.invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": "Generate Python code that computes 15 * 17 and report the result.",
                }
            ]
        }
    )
    print(result["messages"][-1].content)


if __name__ == "__main__":
    main()

