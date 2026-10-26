import asyncio

from langchain_core.messages import AIMessage, HumanMessage

from agent.dashboard.validation import ResponseValidationGuard


def test_invalid_chat_structure_retries_without_repeating_tools(monkeypatch):
    async def validate(program, *, allow_artifacts=False):
        assert allow_artifacts is True
        if "SectionItem" in program:
            raise ValueError("SectionItem requires SectionBlock")

    monkeypatch.setattr("agent.dashboard.validation.validate_program", validate)

    async def run():
        guard = ResponseValidationGuard()
        invalid = {
            "messages": [
                HumanMessage("Summarize"),
                AIMessage(id="bad", content='root=Card([SectionItem("r","Risk",[])])'),
            ]
        }
        for _ in range(2):
            retry = await guard.aafter_model(invalid, None)
            assert retry["jump_to"] == "model"
            assert retry["messages"][0].id == "bad"
            assert "do not repeat tools" in retry["messages"][1].content
        fallback = await guard.aafter_model(invalid, None)
        assert "답변 표시 미완료" in fallback["messages"][0].content
        assert (
            await ResponseValidationGuard().aafter_model(
                {"messages": [AIMessage(content="root=Card([])")]}, None
            )
            is None
        )

    asyncio.run(run())


def test_research_requires_current_distinct_original_reads():
    import json

    from langchain_core.messages import ToolMessage

    from agent.dashboard.research_guard import ResearchEvidenceGuard, original_reads

    def read(page, text="Original", name="read_document_page"):
        return [
            AIMessage(
                content="",
                tool_calls=[
                    {
                        "id": f"read-{page}",
                        "name": name,
                        "args": {"document_id": "doc", "page": page},
                    }
                ],
            ),
            ToolMessage(
                content=json.dumps({"text": text}), tool_call_id=f"read-{page}"
            ),
        ]

    messages = [
        HumanMessage("old"),
        *read(1),
        HumanMessage("Verify overview"),
        *read(2),
        *read(2),
        *read(3, ""),
        *read(4, name="search_documents"),
        AIMessage(id="draft", content="Reviewed all"),
    ]
    assert len(original_reads(messages)) == 1

    async def run():
        guard = ResearchEvidenceGuard("overview")
        retry = await guard.aafter_model({"messages": messages}, None)
        assert retry["jump_to"] == "model"
        assert "minimum 4" in retry["messages"][-1].content
        completed = (
            messages[:-1] + read(4) + read(5) + read(6) + [AIMessage(content="Summary")]
        )
        assert await guard.aafter_model({"messages": completed}, None) is None
        assert (
            await ResearchEvidenceGuard("none").aafter_model(
                {"messages": messages}, None
            )
            is None
        )

    asyncio.run(run())


def test_original_scope_uses_current_tool_results_not_model_claims():
    import json

    from agent.dashboard.research_guard import original_scope

    def result(page, **extra):
        return {
            "role": "tool",
            "content": json.dumps(
                {
                    "document_id": "doc",
                    "document": "Report",
                    "page": page,
                    "text": "Original",
                    "offset": 0,
                    "next_offset": None,
                    "url": f"https://example.com/report#page={page}",
                    **extra,
                }
            ),
        }

    scope = original_scope(
        [
            {"role": "user", "content": "old"},
            result(1),
            {"role": "user", "content": "Read page"},
            result(12, next_offset=16000),
            {"role": "assistant", "content": "Read pages 1-100"},
        ]
    )
    assert "12페이지 (부분 범위)" in scope
    assert "1-100" not in scope and "1페이지" not in scope
    assert "전체 보고서와 모든 주석을 검토했다는 뜻은 아닙니다" in scope
    assert original_scope([{"role": "user", "content": "Read"}]) is None


def test_final_response_must_render_published_artifact(monkeypatch):
    import json

    from langchain_core.messages import ToolMessage

    async def validate(program, *, allow_artifacts=False):
        return {
            "valid": True,
            "artifact_ids": ["artifact"] if "DashboardArtifact" in program else [],
        }

    monkeypatch.setattr("agent.dashboard.validation.validate_program", validate)

    async def run():
        messages = [
            HumanMessage("Make a reusable form"),
            AIMessage(
                content="",
                tool_calls=[
                    {
                        "id": "publish",
                        "name": "publish_ui_panel",
                        "args": {"destination": "chat"},
                    }
                ],
            ),
            ToolMessage(
                content=json.dumps({"success": True, "artifact_id": "artifact"}),
                tool_call_id="publish",
            ),
            AIMessage(id="answer", content="root=Card([])"),
        ]
        guard = ResponseValidationGuard()
        retry = await guard.aafter_model({"messages": messages}, None)
        assert retry["jump_to"] == "model"
        assert "DashboardArtifact" in retry["messages"][1].content
        messages[-1] = AIMessage(
            id="fixed", content='root=Card([DashboardArtifact("artifact")])'
        )
        assert await guard.aafter_model({"messages": messages}, None) is None

    asyncio.run(run())
