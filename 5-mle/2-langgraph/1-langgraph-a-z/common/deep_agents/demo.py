"""CLI 출력만 공유한다. 그래프 구성과 입력은 각 예제 파일에 둔다."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# 그룹별 예제에서 공유하는 프로젝트 루트 경로다.
ROOT = Path(__file__).resolve().parents[2]


def show(result):
    for message in result.get("messages", []):
        if getattr(message, "tool_calls", None):
            print("TOOL CALL", json.dumps(message.tool_calls, ensure_ascii=False))
        elif message.type in ("tool", "ai"):
            print(f"{message.type.upper()}: {str(message.content)[:1400]}")
    for key in ("todos", "files", "__interrupt__"):
        if key in result:
            value = list(result[key]) if key == "files" else result[key]
            print(key, value)


def run(graph, inputs, config=None):
    mode = "live" if "--live" in sys.argv else os.getenv("DEEP_AGENTS_MODE", "scripted")
    print("MODE:", mode)
    result = graph.invoke(inputs, config=config or {"recursion_limit": 60})
    show(result)
    return result
