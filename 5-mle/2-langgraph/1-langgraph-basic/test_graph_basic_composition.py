from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace

from langchain_core.messages import AIMessage, HumanMessage


ROOT = Path(__file__).parent


def load_example(filename: str):
    path = ROOT / "graph-basic" / filename
    module_name = f"test_composition_{path.stem}"
    spec = importlib.util.spec_from_file_location(module_name, path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    # LangGraph evaluates some type hints after module execution. Registering the
    # module makes those forward-reference globals available to get_type_hints().
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def test_static_parallel_branches_join_all_results():
    module = load_example("29_parallel_branches.py")

    out = module.graph.invoke({"text": "LangGraph is amazing and I love it"})
    artifacts = {item["kind"]: item["value"] for item in out["artifacts"]}

    assert set(artifacts) == {"summary", "tags", "sentiment"}
    assert artifacts["sentiment"] == "positive"
    assert out["report"]


def test_map_reduce_handles_normal_and_empty_fanout():
    module = load_example("30_map_reduce.py")

    normal = module.graph.invoke({"topics": ["langgraph", "fastapi"]})
    empty = module.graph.invoke({"topics": []})

    assert {item["topic"] for item in normal["results"]} == {
        "langgraph",
        "fastapi",
    }
    assert "LangGraph" in normal["answer"]
    assert empty["results"] == []
    assert empty["answer"] == ""


def test_basic_subgraph_runs_as_a_parent_node():
    module = load_example("31_basic_subgraph.py")

    out = module.graph.invoke({"text": "  Hello    LangGraph  "})

    assert out["normalized"] == "hello langgraph"
    assert out["decorated"] == "<hello langgraph>"
    assert out["result"] == "subgraph result: <hello langgraph>"


def test_subgraph_output_schema_hides_private_scratch_state():
    module = load_example("32_subgraph_state_schemas.py")

    out = module.graph.invoke(
        {"text": "one two three four five six seven eight nine"}
    )

    assert out["summary"] == "one two three four five six seven eight..."
    assert out["result"].startswith("SUMMARY:")
    assert "cleaned" not in out


class RoutedFakeModel:
    def __init__(self):
        self.schema = None

    def with_structured_output(self, schema):
        self.schema = schema
        return self

    def invoke(self, _messages):
        if self.schema is None:
            return AIMessage(content="번역 결과")
        if self.schema.__name__ == "Intent":
            return SimpleNamespace(intent="translate", rationale="translation request")
        if self.schema.__name__ == "LangDetect":
            return SimpleNamespace(src_lang="en")
        raise AssertionError(f"unexpected schema: {self.schema}")


def test_routed_subgraph_keeps_control_data_out_of_messages(monkeypatch):
    module = load_example("33_routed_subgraphs.py")
    monkeypatch.setattr(module, "create_llm", RoutedFakeModel)

    out = module.graph.invoke(
        {"messages": [HumanMessage(content="Translate hello into Korean")]}
    )

    assert out["intent"] == "translate"
    assert out["src_lang"] == "en"
    assert out["tgt_lang"] == "ko"
    assert len(out["messages"]) == 2
    assert out["messages"][-1].content == "번역 결과"
    assert all(message.name not in {"classifier", "detect_lang"} for message in out["messages"])


def test_rag_and_qa_do_not_match_kubernetes_via_stopwords():
    rag = load_example("34_rag.py")
    qa = load_example("35_qa_pipeline.py")

    assert rag.retrieve({"question": "What is Kubernetes?"})["docs"] == []
    assert qa.retrieve({"question": "What is Kubernetes?"})["docs"] == []

    out = qa.graph.invoke({"question": "What is Kubernetes?"})
    assert out["qa_status"] == "fallback"
    assert out["citation_ok"] is False
    assert "관련 문서를 찾지 못했습니다" in out["answer"]


def test_reflection_requires_an_exact_good_verdict():
    module = load_example("36_reflection.py")

    assert module.should_continue({"critique": "GOOD", "iterations": 1}) == "__end__"
    assert module.should_continue({"critique": " good \n", "iterations": 1}) == "__end__"
    assert module.should_continue({"critique": "NOT GOOD", "iterations": 1}) == "generate"
    assert module.should_continue({"critique": "needs work", "iterations": 3}) == "__end__"


class ReflectionFakeModel:
    def invoke(self, messages):
        first = str(getattr(messages[0], "content", "")) if messages else ""
        if "strict editor" in first:
            return AIMessage(content="GOOD")
        if "안내자" in first:
            return AIMessage(content="진행 중")
        return AIMessage(content="draft")


def test_reflection_streams_node_entry_progress_without_external_api(monkeypatch):
    module = load_example("37_reflection_streaming.py")
    monkeypatch.setattr(module, "create_llm", ReflectionFakeModel)

    events = list(
        module.graph.stream(
            {"messages": [HumanMessage(content="topic")]},
            stream_mode=["custom", "values"],
        )
    )
    phases = [payload["phase"] for mode, payload in events if mode == "custom"]

    assert phases == ["generate", "critic", "finalize"]


def test_streaming_reflection_requires_an_exact_good_verdict():
    module = load_example("37_reflection_streaming.py")

    assert module.should_continue({"critique": "GOOD", "iterations": 1}) == "finalize"
    assert module.should_continue({"critique": "NOT GOOD", "iterations": 1}) == "generate"


class VerificationFakeModel:
    def invoke(self, messages):
        first = str(getattr(messages[0], "content", "")) if messages else ""
        if "Repair the answer" in first:
            body = "LangGraph의 상태, 노드, 엣지, 체크포인트를 함께 설명하는 충분히 긴 한국어 답변입니다. "
            return AIMessage(content=body * 2 + "[source:langgraph]")
        return AIMessage(content="짧은 답변")


def test_rule_validation_repairs_a_failed_draft(monkeypatch):
    module = load_example("39_verification_flow.py")
    monkeypatch.setattr(module, "create_llm", VerificationFakeModel)

    out = module.graph.invoke({"question": "LangGraph란?"})

    assert out["verified"] is True
    assert out["verification_errors"] == []
    assert out["repair_count"] == 1
    assert out["answer"].endswith("[source:langgraph]")


class HierarchyFakeModel:
    def with_structured_output(self, _schema):
        return self

    def invoke(self, _messages):
        return SimpleNamespace(next_team="data", reason="dispatch data again")


def test_hierarchical_supervisor_enforces_team_dispatch_limit(monkeypatch):
    module = load_example("42_hierarchical_supervisor.py")
    monkeypatch.setattr(module, "create_llm", HierarchyFakeModel)

    out = module.top_supervisor(
        {"messages": [], "top_iters": 1, "team_dispatches": {"data": 2}}
    )

    assert out["next_team"] == "FINISH"
    assert out["team_dispatches"] == {"data": 2}
    assert "team dispatch limit reached" in out["messages"][0].content


class ChatFakeModel:
    def invoke(self, _messages):
        return AIMessage(content="summary")


def test_reusable_chat_subgraph_exposes_only_public_output(monkeypatch):
    module = load_example("44_reusable_chat_subgraph.py")
    monkeypatch.setattr(module, "create_llm", ChatFakeModel)

    out = module.graph.invoke(
        {
            "messages": [HumanMessage(content="analyze sales")],
            "stage": "",
            "analysis": "",
            "final": "",
            "chat_command": "",
            "chat_payload": "",
        }
    )

    assert set(out) == {"messages", "stage", "final"}
    assert out["stage"] == "finalized"
    assert out["final"]
    assert "analysis" not in out
    assert "chat_command" not in out
    assert "chat_payload" not in out
    assert "ui_step_count" not in out
