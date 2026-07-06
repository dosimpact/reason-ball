from __future__ import annotations

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from langchain_lecture.projects_2.project_08_memory_chatbot.app import (
    compare_stateless_and_stateful,
)
from langchain_lecture.projects_2.project_08_memory_chatbot.graph import graph
from langchain_lecture.projects_2.project_08_memory_chatbot.memory_chatbot import (
    MemoryChatbot,
)
from langchain_lecture.projects_2.project_08_memory_chatbot.memory_store import (
    MemoryStore,
)


def test_same_thread_remembers_name():
    chatbot = MemoryChatbot(MemoryStore())

    chatbot.ask("내 이름은 민수야", thread_id="thread-a")
    turn = chatbot.ask("내 이름이 뭐야?", thread_id="thread-a")

    assert "민수" in turn.answer
    assert turn.facts["name"] == "민수"
    assert turn.checkpoint_id == 2


def test_different_thread_ids_keep_context_separate():
    chatbot = MemoryChatbot(MemoryStore())

    chatbot.ask("나는 부산에 살아", thread_id="thread-a")
    chatbot.ask("나는 서울에 살아", thread_id="thread-b")

    answer_a = chatbot.ask("어디에 살아?", thread_id="thread-a").answer
    answer_b = chatbot.ask("어디에 살아?", thread_id="thread-b").answer

    assert "부산" in answer_a
    assert "서울" in answer_b
    assert "서울" not in answer_a
    assert "부산" not in answer_b


def test_stateless_chatbot_does_not_reuse_previous_turns():
    comparison = compare_stateless_and_stateful()

    assert "알지 못합니다" in comparison["stateless"]
    assert "민수" in comparison["stateful"]


def test_history_trimming_summarizes_old_messages_but_keeps_facts():
    store = MemoryStore(max_messages=4)
    chatbot = MemoryChatbot(store)

    chatbot.ask("내 이름은 민수야", thread_id="trim-thread")
    for index in range(5):
        chatbot.ask(f"잡담 {index}", thread_id="trim-thread")

    snapshot = chatbot.snapshot("trim-thread")
    assert len(snapshot.messages) == 4
    assert "Known facts" in snapshot.summary
    assert "민수" in snapshot.summary

    turn = chatbot.ask("내 이름이 뭐야?", thread_id="trim-thread")
    assert "민수" in turn.answer
    assert len(chatbot.snapshot("trim-thread").messages) == 4


def test_memory_store_checkpoints_are_thread_scoped():
    store = MemoryStore(max_messages=4)

    first = store.append(
        "a",
        [HumanMessage(content="hello"), AIMessage(content="hi")],
        facts={"name": "A"},
    )
    second = store.append(
        "a",
        [HumanMessage(content="again"), AIMessage(content="ok")],
    )
    other = store.append(
        "b",
        [HumanMessage(content="hello"), AIMessage(content="hi")],
    )

    assert first.checkpoint_id == 1
    assert second.checkpoint_id == 2
    assert other.checkpoint_id == 1
    assert store.get("a").facts == {"name": "A"}
    assert store.list_thread_ids() == ["a", "b"]


def test_graph_uses_configurable_thread_id():
    config = {"configurable": {"thread_id": "graph-thread"}}

    graph.invoke({"input": "내 이름은 민수야"}, config=config)
    result = graph.invoke({"input": "내 이름이 뭐야?"}, config=config)
    isolated = graph.invoke(
        {"input": "내 이름이 뭐야?"},
        config={"configurable": {"thread_id": "graph-other-thread"}},
    )

    assert result["thread_id"] == "graph-thread"
    assert "민수" in result["answer"]
    assert "알지 못합니다" in isolated["answer"]


def test_memory_store_rejects_too_small_message_window():
    with pytest.raises(ValueError, match="max_messages"):
        MemoryStore(max_messages=1)
