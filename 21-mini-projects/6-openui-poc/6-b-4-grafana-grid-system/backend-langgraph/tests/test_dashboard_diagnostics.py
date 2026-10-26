from langchain_core.messages import AIMessage, HumanMessage, convert_to_openai_messages

from agent import history
from agent.dashboard import diagnostics
from agent.dashboard.execution import CanvasPlan


def test_diagnostics_store_conditions_not_message_bodies_and_delete_with_thread(
    monkeypatch, tmp_path
):
    monkeypatch.setenv("DOCUMENT_DATA_DIR", str(tmp_path))
    thread = history.create_thread("Diagnostics")["id"]
    plan = CanvasPlan(
        operations=["add"], minimum_new_panels=1, instruction="Add a panel"
    )
    messages = convert_to_openai_messages(
        [HumanMessage("private document content"), AIMessage("raw program")]
    )
    diagnostics.record(thread, "run-1", plan, messages, "finished")
    result = diagnostics.latest(thread)
    assert result["plan"]["minimum_new_panels"] == 1
    assert result["missing"] and not result["completed"]
    assert "private document content" not in str(result) and "raw program" not in str(
        result
    )
    history.delete_thread(thread)
    assert diagnostics.latest(thread) is None


def test_diagnostic_retention_is_bounded_per_thread(monkeypatch, tmp_path):
    monkeypatch.setenv("DOCUMENT_DATA_DIR", str(tmp_path))
    first = history.create_thread("First")["id"]
    other = history.create_thread("Other")["id"]
    plan = CanvasPlan(operations=[], instruction="No changes")
    diagnostics.record(other, "other", plan, [], "finished")
    for index in range(102):
        diagnostics.record(first, f"run-{index}", plan, [], "finished")
    with history.connect() as db:
        assert (
            db.execute(
                "SELECT count(*) FROM dashboard_run_diagnostics WHERE thread_id=?",
                (first,),
            ).fetchone()[0]
            == 100
        )
    assert diagnostics.latest(other) is not None
