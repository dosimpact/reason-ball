"""Validate graph-basic curriculum files and LangGraph registrations."""

from __future__ import annotations

import importlib.util
import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GRAPH_DIR = ROOT / "graph-basic"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

EXPECTED_STEMS = [
    "01_simple_graph",
    "02_state_updates",
    "03_reducers",
    "04_state_schemas",
    "05_conditional_routing",
    "06_cycles_and_recursion",
    "07_command_routing",
    "08_llm_graph",
    "09_messages_state",
    "10_structured_output",
    "11_runtime_context",
    "12_tool_schema",
    "13_tool_calls",
    "14_tool_node",
    "15_react_tool_loop",
    "16_create_agent",
    "17_streaming",
    "18_custom_streaming",
    "19_retry_policy",
    "20_checkpointer",
    "21_state_snapshots",
    "22_dynamic_interrupt",
    "23_static_breakpoint",
    "24_tool_approval",
    "25_approval_system",
    "26_long_term_memory",
    "27_long_context",
    "28_history_reducer",
    "29_parallel_branches",
    "30_map_reduce",
    "31_basic_subgraph",
    "32_subgraph_state_schemas",
    "33_routed_subgraphs",
    "34_rag",
    "35_qa_pipeline",
    "36_reflection",
    "37_reflection_streaming",
    "38_evaluator_loop",
    "39_verification_flow",
    "40_plan_and_execute",
    "41_supervisor",
    "42_hierarchical_supervisor",
    "43_isolated_team_state",
    "44_reusable_chat_subgraph",
]


def _registered_graphs() -> dict[str, str]:
    config = json.loads((ROOT / "langgraph.json").read_text())
    return config["graphs"]


def _load_graph(stem: str):
    path = GRAPH_DIR / f"{stem}.py"
    spec = importlib.util.spec_from_file_location(f"curriculum_{stem}", path)
    if spec is None or spec.loader is None:
        raise AssertionError(f"Cannot create import spec for {path}")
    module = importlib.util.module_from_spec(spec)
    # TypedDict/Pydantic가 postponed annotation을 해석할 때 module namespace를
    # sys.modules에서 찾으므로 일반 import와 같은 순서로 먼저 등록한다.
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    if not hasattr(module, "graph"):
        raise AssertionError(f"{path} does not expose `graph`")


def main() -> None:
    os.environ.setdefault("OPENAI_API_KEY", "test")

    actual_stems = sorted(path.stem for path in GRAPH_DIR.glob("[0-9]*.py"))
    if actual_stems != EXPECTED_STEMS:
        missing = sorted(set(EXPECTED_STEMS) - set(actual_stems))
        extra = sorted(set(actual_stems) - set(EXPECTED_STEMS))
        raise AssertionError(f"Curriculum mismatch: missing={missing}, extra={extra}")

    expected_graphs = {
        f"b_{stem}": f"./graph-basic/{stem}.py:graph" for stem in EXPECTED_STEMS
    }
    registered = {
        key: value for key, value in _registered_graphs().items() if key.startswith("b_")
    }
    if list(registered.items()) != list(expected_graphs.items()):
        raise AssertionError("langgraph.json basic graph order or paths are out of sync")

    for stem in EXPECTED_STEMS:
        _load_graph(stem)

    print(f"Validated {len(EXPECTED_STEMS)} curriculum graphs.")


if __name__ == "__main__":
    main()
