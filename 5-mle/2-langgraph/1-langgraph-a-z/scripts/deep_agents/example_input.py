"""Studio/API에 붙여 넣을 예제 입력 JSON을 출력한다."""

import argparse
import json
import os
import runpy
from pathlib import Path

from langchain_core.messages import convert_to_messages


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("number", type=int, choices=range(1, 19))
    args = parser.parse_args()
    os.environ["DEEP_AGENTS_MODE"] = "scripted"
    root = Path(__file__).resolve().parents[2]
    path = next((root / "graphs/deep_agents").rglob(f"{args.number:02d}_*.py"))
    module = runpy.run_path(str(path))
    data = (
        module["sample_input"]()
        if "sample_input" in module
        else {"messages": [("user", module["PROMPT"])]}
    )
    data["messages"] = [
        {"role": {"human": "user", "ai": "assistant"}[m.type], "content": m.content}
        for m in convert_to_messages(data["messages"])
    ]
    print(json.dumps(data, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
