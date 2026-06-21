from __future__ import annotations

import importlib.util
from pathlib import Path

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command


ROOT = Path(__file__).parent


def load_module(relative_path: str):
    path = ROOT / relative_path
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_new_practical_pattern_graphs_compile():
    for path in [
        "graph-basic/22_evaluator_loop.py",
        "graph-basic/23_verification_flow.py",
        "graph-basic/24_qa_pipeline.py",
        "graph-basic/25_approval_system.py",
    ]:
        module = load_module(path)
        assert module.graph is not None


def test_qa_pipeline_falls_back_without_docs():
    module = load_module("graph-basic/24_qa_pipeline.py")

    out = module.graph.invoke({"question": "쿠버네티스 파드는 무엇인가요?"})

    assert out["qa_status"] == "fallback"
    assert out["citation_ok"] is False
    assert "관련 문서를 찾지 못했습니다" in out["answer"]


def test_approval_system_executes_low_risk_action():
    module = load_module("graph-basic/25_approval_system.py")

    out = module.graph.invoke({"action": "read customer profile"})

    assert out["risk"] == "low"
    assert out["approved"] is True
    assert out["execution_result"] == "EXECUTED: read customer profile"


def test_approval_system_blocks_rejected_high_risk_action():
    module = load_module("graph-basic/25_approval_system.py")
    builder = StateGraph(module.State)
    builder.add_node("classify_risk", module.classify_risk)
    builder.add_node("request_approval", module.request_approval)
    builder.add_node("execute", module.execute)
    builder.add_edge(START, "classify_risk")
    builder.add_conditional_edges(
        "classify_risk",
        module.route_after_risk,
        {"request_approval": "request_approval", "execute": "execute"},
    )
    builder.add_edge("request_approval", "execute")
    builder.add_edge("execute", END)
    graph = builder.compile(checkpointer=MemorySaver())
    config = {"configurable": {"thread_id": "approval-test-reject"}}

    interrupted = graph.invoke(
        {"action": "delete production database backup"},
        config=config,
    )
    resumed = graph.invoke(Command(resume="reject"), config=config)

    assert interrupted["risk"] == "high"
    assert interrupted["approved"] is False
    assert resumed["approved"] is False
    assert resumed["execution_result"] == "BLOCKED: delete production database backup"
