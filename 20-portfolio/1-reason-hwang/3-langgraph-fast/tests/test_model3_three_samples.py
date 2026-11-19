"""Selection contracts restricted to three supplied issuer samples."""

import json
from pathlib import Path

import httpx
import pytest
from lxml import etree

from domains.sec_modeling import model3_selection as selection
from domains.sec_modeling.decisions_client import validate_answers
from domains.sec_modeling.model3_selection import (
    CATEGORIES,
    dropped,
    link_evidence,
)

SOURCES = Path(__file__).resolve().parents[2] / "docs/human-docs/1-sec-분석"


@pytest.mark.parametrize("ticker", ["aapl", "cpng", "nvda"])
def test_local_issuer_selection_contract(ticker, monkeypatch, tmp_path):
    paths = sorted(SOURCES.glob(f"{ticker}-*-10k.htm"))
    if not paths:
        pytest.skip("Private local sample is not installed")
    source = paths[0].read_text()
    root = etree.fromstring(
        source.encode(),
        etree.XMLParser(resolve_entities=False, no_network=True, huge_tree=True),
    )
    tags = root.xpath('//*[local-name()="nonFraction" or local-name()="nonNumeric"]')
    gaap = next(e for e in tags if e.get("name", "").startswith("us-gaap:"))
    assert dropped({"namespaceUri": gaap.nsmap["us-gaap"]})
    extension = next(
        e for e in tags if e.get("name", "").split(":")[0] == ticker and e.get("id")
    )
    prefix, name = extension.get("name").split(":")
    fact = {
        "candidateId": f"sample:{ticker}",
        "sourceFactId": extension.get("id"),
        "namespaceUri": extension.nsmap[prefix],
        "localName": name,
        "rawValue": "".join(extension.itertext()),
        "normalizedValue": "preserved-source-value",
    }
    assert not dropped(fact)
    original = fact.copy()
    link_evidence(source, [fact])
    assert fact["evidence"] and fact["evidence"][0]["sourceFactId"] == extension.get(
        "id"
    )

    # Exercise real serialization, HTTP transport and typed parsing without live calls.
    def handler(request):
        assert str(request.url) == "https://api.openai.com/v1/decisions"
        body = json.loads(request.content)
        assert body["model"] == "gpt-6-luna"
        content = body["input"][0]["content"][0]
        assert content["type"] == "input_json"
        candidate = content["data"]["candidates"][0]
        assert candidate["candidateId"] == fact["candidateId"]
        assert candidate["normalizedValue"] == original["normalizedValue"]
        assert "rawValue" not in candidate
        questions = body["questions"]
        assert [(q["type"], q["name"]) for q in questions] == [
            ("predicate", "c0_importance"),
            ("choice", "c0_category"),
        ]
        assert {c["value"] for c in questions[1]["choices"]} == set(CATEGORIES)
        return httpx.Response(200, json=answer)

    answer = {
        "model": "gpt-6-luna",
        "answers": [
            {"name": "c0_importance", "type": "predicate", "probability": 0.95},
            {
                "name": "c0_category",
                "type": "choice",
                "choice": CATEGORIES[0],
                "confidence": 1.0,
                "probabilities": [
                    {"value": c, "probability": float(c == CATEGORIES[0])}
                    for c in CATEGORIES
                ],
            },
        ],
        "usage": {"input_tokens": 12, "output_tokens": 3, "total_tokens": 15},
    }
    monkeypatch.setattr(
        selection,
        "decisions_http_client",
        lambda: httpx.Client(transport=httpx.MockTransport(handler)),
    )
    monkeypatch.setattr(
        selection, "_decision_cache_path", lambda *_: tmp_path / "decisions.json"
    )
    progress = []
    selected = selection.select_facts(
        [fact], "gpt-6-luna", lambda **event: progress.append(event), lambda: False
    )
    assert selected == [fact]
    assert fact["selectionProvider"] == "openai-decisions"
    assert fact["selectionModel"] == "gpt-6-luna"
    assert fact["importanceProbability"] == 0.95
    assert fact["rawValue"] == original["rawValue"]
    assert fact["normalizedValue"] == original["normalizedValue"]
    assert progress[0]["processed"] == progress[0]["total"] == 1
    with pytest.raises(ValueError):
        validate_answers(
            {**answer, "answers": answer["answers"] * 2}, 1, CATEGORIES, "gpt-6-luna"
        )
    invalid = json.loads(json.dumps(answer))
    invalid["answers"][0]["probability"] = "0.95"
    with pytest.raises(ValueError):
        validate_answers(invalid, 1, CATEGORIES, "gpt-6-luna")
