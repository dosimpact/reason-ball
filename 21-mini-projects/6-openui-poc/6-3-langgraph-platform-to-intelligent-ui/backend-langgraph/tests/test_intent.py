import asyncio
import importlib

import pytest
from pydantic import ValidationError


def test_intent_uses_packaged_prompt_and_one_structured_model_call(monkeypatch, tmp_path):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key-no-network-call")
    monkeypatch.chdir(tmp_path)
    intent = importlib.import_module("agent.intent")
    calls = []

    class FakeModel:
        async def ainvoke(self, messages):
            calls.append(messages)
            return intent.IntentDecision(mode="report", source="history", sourceMessageId="earlier")

    monkeypatch.setattr(intent, "model", FakeModel())
    result = asyncio.run(intent.classify({"messages": [{"id": "latest", "role": "user", "content": "그걸 보고서로 바꿔줘"}]}))
    assert result["decision"] == {"mode": "report", "source": "history", "sourceMessageId": "earlier"}
    assert len(calls) == 1
    assert "Lisbon" in calls[0][0].content
    assert "latest" in calls[0][1].content
    with pytest.raises(ValidationError):
        intent.IntentDecision(mode="unknown", source="none", sourceMessageId=None)
