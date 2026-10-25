import asyncio

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from agent.dashboard.grounding import (
    GroundingFinding,
    GroundingGuard,
    GroundingReview,
    retrieved_evidence,
)


def review(*, issues):
    return GroundingReview(
        findings=[
            GroundingFinding(verdict="unsupported", explanation=i) for i in issues
        ]
    )


def test_supported_findings_do_not_block_but_mixed_findings_do():
    supported = GroundingFinding(
        verdict="supported", explanation="Requested subset matches source"
    )
    unsupported = GroundingFinding(
        verdict="unsupported", explanation="FY2024 amount contradicts source"
    )
    assert GroundingReview(findings=[supported]).issues == []
    assert GroundingReview(findings=[supported, unsupported]).issues == [
        unsupported.explanation
    ]


def test_private_reviewer_uses_nonstreaming_copy_without_changing_chat_model(
    monkeypatch,
):
    from langchain_openai import ChatOpenAI

    captured = []

    def structured(self, schema, **kwargs):
        captured.append(self)
        return object()

    monkeypatch.setattr(ChatOpenAI, "with_structured_output", structured)
    model = ChatOpenAI(api_key="test-not-a-real-key", streaming=True, temperature=0.7)
    GroundingGuard(model)
    assert captured[0] is not model
    assert captured[0].streaming is False
    assert captured[0].temperature == 0
    assert model.streaming is True
    assert model.temperature == 0.7


def messages():
    return [
        HumanMessage("Compare NVIDIA and AMD"),
        AIMessage(
            content="",
            tool_calls=[
                {
                    "id": "read",
                    "name": "read_document_page",
                    "args": {"document_id": "amd", "page": 55},
                }
            ],
        ),
        ToolMessage(
            content='{"text":"AMD Data Center 16,635 million"}', tool_call_id="read"
        ),
        AIMessage(
            id="answer", content='root=Card([TextContent("NVIDIA Data Center $16.6B")])'
        ),
    ]


def test_evidence_is_current_turn_and_preserves_attribution():
    evidence = retrieved_evidence(messages())
    assert evidence[0]["arguments"] == {"document_id": "amd", "page": 55}
    assert "AMD" in evidence[0]["result"]
    assert retrieved_evidence([*messages(), HumanMessage("new")]) == []
    prior = retrieved_evidence([*messages(), HumanMessage("new")], include_history=True)
    assert prior[0]["current_turn"] is False
    assert prior[0]["arguments"]["document_id"] == "amd"


def test_grounding_retries_misattributed_claims_then_withholds():
    class Reviewer:
        def with_structured_output(self, schema, **kwargs):
            return self

        async def ainvoke(self, request):
            assert "AMD" in request[1]["content"]
            assert "NVIDIA" in request[1]["content"]
            return review(issues=["NVIDIA amount is only supported for AMD"])

    async def run():
        guard = GroundingGuard(Reviewer())
        state = {"messages": messages()}
        for _ in range(2):
            retry = await guard.aafter_model(state, None)
            assert retry["jump_to"] == "model"
            assert retry["messages"][0].id == "answer"
            assert "NVIDIA amount" in retry["messages"][1].content
        final = await guard.aafter_model(state, None)
        assert "근거 검증 미완료" in final["messages"][0].content
        assert (
            await guard.aafter_model(
                {"messages": [HumanMessage("A calculator"), AIMessage(content="UI")]},
                None,
            )
            is None
        )

    asyncio.run(run())


def test_supported_answer_passes_without_retry():
    class Reviewer:
        def with_structured_output(self, schema, **kwargs):
            return self

        async def ainvoke(self, request):
            return review(issues=[])

    async def run():
        guard = GroundingGuard(Reviewer())
        state = {"messages": messages()}
        state["messages"][-1] = AIMessage(
            content='root=Card([TextContent("AMD Data Center $16.635 billion")])'
        )
        assert await guard.aafter_model(state, None) is None
        assert guard.retries == 0

    asyncio.run(run())


def test_publish_is_checked_before_handler_and_failure_cannot_write():
    import json
    from types import SimpleNamespace

    class Reviewer:
        def __init__(self):
            self.issues = ["Wrong company"]
            self.unavailable = False

        def with_structured_output(self, schema, **kwargs):
            return self

        async def ainvoke(self, request):
            if self.unavailable:
                raise RuntimeError("provider failure")
            return review(issues=self.issues)

    async def run():
        reviewer = Reviewer()
        guard = GroundingGuard(reviewer)
        writes = []

        async def handler(request):
            writes.append(request.tool_call)
            return ToolMessage(content='{"success":true}', tool_call_id="publish")

        request = SimpleNamespace(
            tool_call={
                "id": "publish",
                "name": "publish_ui_panel",
                "args": {"title": "Revenue", "program": "Unsupported claim"},
            },
            state={"messages": messages()},
        )
        result = await guard.awrap_tool_call(request, handler)
        assert json.loads(result.content)["success"] is False
        assert writes == []
        reviewer.unavailable = True
        result = await guard.awrap_tool_call(request, handler)
        assert "unavailable" in result.content
        assert writes == []
        reviewer.unavailable = False
        reviewer.issues = []
        result = await guard.awrap_tool_call(request, handler)
        assert json.loads(result.content)["success"] is True
        assert len(writes) == 1
        request.tool_call = {
            "id": "publish",
            "name": "modify_dashboard",
            "args": {"action": "update", "payload": {"program": "Bad content"}},
        }
        reviewer.issues = ["No evidence"]
        await guard.awrap_tool_call(request, handler)
        assert len(writes) == 1
        request.tool_call["args"]["payload"] = {"title": "Renamed"}
        await guard.awrap_tool_call(request, handler)
        assert len(writes) == 2

    asyncio.run(run())


def test_sec_failure_review_includes_separate_prepared_pdf_catalog():
    class Reviewer:
        def with_structured_output(self, schema, **kwargs):
            return self

        async def ainvoke(self, request):
            assert "server_prepared_pdf_catalog" in request[1]["content"]
            assert "NVIDIA prepared PDF" in request[1]["content"]
            return review(issues=["Prepared PDF exists despite SEC failure"])

    async def run():
        guard = GroundingGuard(
            Reviewer(), [{"id": "nvidia", "name": "NVIDIA prepared PDF"}]
        )
        state = {
            "messages": [
                HumanMessage("Find report"),
                AIMessage(
                    content="",
                    tool_calls=[
                        {
                            "id": "sec",
                            "name": "find_sec_company",
                            "args": {"query": "NVIDIA"},
                        }
                    ],
                ),
                ToolMessage(
                    content='{"error":"SEC_HTTP_ERROR","http_status":403}',
                    tool_call_id="sec",
                ),
                AIMessage(id="wrong", content="No local PDFs exist"),
            ]
        }
        result = await guard.aafter_model(state, None)
        assert result["jump_to"] == "model"
        assert "Prepared PDF exists" in result["messages"][1].content

    asyncio.run(run())


def test_requested_filter_reaches_publish_and_answer_reviews_separately_from_evidence():
    import json
    from types import SimpleNamespace

    requests = []

    class Reviewer:
        def with_structured_output(self, schema, **kwargs):
            return self

        async def ainvoke(self, request):
            payload = json.loads(request[1]["content"])
            requests.append(payload)
            assert (
                payload["user_requested_scope"]
                == "Exclude FY2025; show FY2024 and FY2026"
            )
            assert all(
                "Exclude FY2025" not in json.dumps(e) for e in payload["evidence"]
            )
            assert payload["evidence"][-1]["result"] == [{"id": "nvidia"}]
            return review(issues=[])

    async def run():
        guard = GroundingGuard(Reviewer(), [{"id": "nvidia"}])
        state = {"messages": messages()}
        state["messages"][0] = HumanMessage("Exclude FY2025; show FY2024 and FY2026")
        state["messages"][-1] = AIMessage(content="Filtered comparison")
        writes = []

        async def handler(request):
            writes.append(request)
            return ToolMessage(content='{"success":true}', tool_call_id="save")

        request = SimpleNamespace(
            tool_call={
                "id": "save",
                "name": "publish_ui_panel",
                "args": {"program": "Filtered comparison"},
            },
            state=state,
        )
        await guard.awrap_tool_call(request, handler)
        assert len(writes) == 1
        assert await guard.aafter_model(state, None) is None
        assert len(requests) == 2

    asyncio.run(run())


def test_followup_answer_is_audited_against_trusted_prior_evidence():
    import json

    class Reviewer:
        def with_structured_output(self, schema, **kwargs):
            return self

        async def ainvoke(self, request):
            evidence = json.loads(request[1]["content"])["evidence"]
            assert evidence[0]["current_turn"] is False
            assert "AMD Data Center" in evidence[0]["result"]
            return review(
                issues=["The follow-up attributes prior AMD revenue to NVIDIA"]
            )

    async def run():
        state = {
            "messages": [
                *messages(),
                HumanMessage("Explain that again"),
                AIMessage(id="followup", content="NVIDIA Data Center $16.635 billion"),
            ]
        }
        result = await GroundingGuard(Reviewer()).aafter_model(state, None)
        assert result["jump_to"] == "model"
        assert result["messages"][0].id == "followup"

    asyncio.run(run())


def test_incorrect_period_header_blocks_even_when_body_claims_are_supported():
    assessment = GroundingReview(
        period_findings=[
            GroundingFinding(
                explanation="Quarter end mislabeled as fiscal year end",
                verdict="unsupported",
            )
        ],
        findings=[
            GroundingFinding(
                explanation="Revenue values match evidence", verdict="supported"
            )
        ],
    )
    assert assessment.issues == ["Quarter end mislabeled as fiscal year end"]


def test_missing_exception_blocks_even_when_periods_and_numbers_are_supported():
    assessment = GroundingReview(
        qualifier_findings=[
            GroundingFinding(
                explanation="No-change summary omits the listed-risk exception",
                verdict="unsupported",
            )
        ],
        period_findings=[
            GroundingFinding(
                explanation="Report quarter matches evidence", verdict="supported"
            )
        ],
        findings=[
            GroundingFinding(
                explanation="Source quotation is accurate", verdict="supported"
            )
        ],
    )
    assert assessment.issues == ["No-change summary omits the listed-risk exception"]
