"""Run one actual OpenAI-backed graph invocation for smoke testing."""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

from langchain_core.messages import HumanMessage

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from graphs import __name__ as graphs_package_name  # noqa: E402


def main() -> None:
    module = importlib.import_module("graphs.01_sdk_connection")
    result = module.graph.invoke(
        {"messages": [HumanMessage(content="Reply with exactly five words.")]}
    )
    message = result["messages"][-1]
    print(f"package={graphs_package_name}")
    print(f"response={message.content}")


if __name__ == "__main__":
    main()
